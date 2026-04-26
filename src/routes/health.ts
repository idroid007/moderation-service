import type { FastifyInstance, FastifyRequest } from "fastify";
import { getClassifier } from "../services/classifier.js";

const startTime = Date.now();

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (_request: FastifyRequest, reply) => {
    return reply.redirect("https://hiresocials.com", 301);
  });

  app.get("/health", async (_request, reply) => {
    let modelLoaded = false;
    try {
      const classifier = getClassifier();
      // The classifier exposes its name; if it loaded successfully the field is set
      modelLoaded = classifier.name !== "";
    } catch {
      modelLoaded = false;
    }

    await reply.code(200).send({
      status: "ok",
      model_loaded: modelLoaded,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    });
  });
}
