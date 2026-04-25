import Fastify from "fastify";
import { config } from "../config.js";

// Standalone logger for pre-server use (model loading, startup).
// Uses Fastify's bundled pino so no extra pino dependency is needed.
const _app = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    transport:
      process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
});

export const logger = _app.log;
