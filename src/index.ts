import Fastify, { type FastifyError } from "fastify";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { getClassifier } from "./services/classifier.js";
import { cleanupStaleTempDirs } from "./utils/temp.js";
import { healthRoutes } from "./routes/health.js";
import { moderateImageRoutes } from "./routes/moderate-image.js";
import { moderateVideoRoutes } from "./routes/moderate-video.js";

async function bootstrap() {
  // Clean up any stale temp dirs from a previous unclean shutdown
  await cleanupStaleTempDirs();

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
    // Image/video moderation timeout: 60s for videos, 10s for images
    // We set 60s at the server level and rely on route-level handling
    requestTimeout: 60_000,
  });

  // Plugins
  await app.register(multipart, {
    limits: {
      fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024,
    },
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // Routes
  await app.register(healthRoutes);
  await app.register(moderateImageRoutes);
  await app.register(moderateVideoRoutes);

  // Global error handler
  app.setErrorHandler(async (error: FastifyError, _request, reply) => {
    if (error.statusCode === 413) {
      return reply.code(413).send({
        error: `File exceeds maximum size of ${config.MAX_FILE_SIZE_MB}MB`,
        code: "FILE_TOO_LARGE",
      });
    }
    app.log.error(error, "Unhandled error");
    return reply.code(500).send({ error: "Internal moderation error", code: "INTERNAL_ERROR" });
  });

  // Load model before accepting traffic
  logger.info("Loading moderation model...");
  const modelLoadStart = Date.now();
  const classifier = getClassifier();
  try {
    await classifier.load();
    const loadMs = Date.now() - modelLoadStart;
    const memMB = process.memoryUsage().rss / 1024 / 1024;
    logger.info(
      { load_ms: loadMs, rss_mb: memMB.toFixed(1), model: classifier.version },
      `Model loaded in ${loadMs}ms, RSS: ${memMB.toFixed(0)}MB`
    );
  } catch (err) {
    logger.error(err, "Failed to load model — aborting startup");
    process.exit(1);
  }

  await app.listen({ port: config.PORT, host: config.HOST });
  logger.info(`Moderation service listening on ${config.HOST}:${config.PORT}`);
}

bootstrap().catch((err) => {
  logger.error(err, "Fatal startup error");
  process.exit(1);
});
