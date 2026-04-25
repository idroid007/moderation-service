import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { fetch } from "undici";
import { authMiddleware } from "../middleware/auth.js";
import { validateImageFile } from "../middleware/file-validation.js";
import { getClassifier } from "../services/classifier.js";
import { buildImageResult } from "../services/verdict.js";
import type { ErrorResponse } from "../types.js";

interface UrlBody {
  url: string;
}

export async function moderateImageRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/moderate/image",
    { preHandler: authMiddleware },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const startMs = Date.now();
      const classifier = getClassifier();

      // Check model loaded
      if (!classifier.name) {
        const body: ErrorResponse = { error: "Model is still loading, try again in a few seconds", code: "MODEL_NOT_READY" };
        return reply.code(503).send(body);
      }

      let fileBuffer: Buffer;
      let mimeType: string;

      const contentType = request.headers["content-type"] ?? "";

      if (contentType.includes("multipart/form-data")) {
        const data = await request.file();
        if (!data) {
          return reply.code(400).send({ error: "No file provided", code: "INVALID_FILE_TYPE" });
        }
        fileBuffer = await data.toBuffer();
        mimeType = data.mimetype;
      } else {
        const body = request.body as UrlBody;
        if (!body?.url) {
          return reply.code(400).send({ error: "Provide 'file' (multipart) or 'url' (JSON)", code: "INVALID_FILE_TYPE" });
        }
        const response = await fetch(body.url).catch(() => null);
        if (!response || !response.ok) {
          const err: ErrorResponse = { error: "Failed to fetch image from URL", code: "FETCH_FAILED" };
          return reply.code(422).send(err);
        }
        fileBuffer = Buffer.from(await response.arrayBuffer());
        mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "application/octet-stream";
      }

      const validation = validateImageFile(fileBuffer, mimeType);
      if (!validation.valid) {
        return reply.code(validation.statusCode).send(validation.body);
      }

      const scores = await classifier.classify(fileBuffer);
      const result = buildImageResult(scores, Date.now() - startMs, classifier.version);

      request.log.info({
        verdict: result.verdict,
        risk: Math.max(scores.porn, scores.hentai, scores.sexy * 0.7),
        processing_ms: result.processing_time_ms,
        file_size: fileBuffer.byteLength,
      }, "image moderation complete");

      return reply.code(200).send(result);
    }
  );
}
