import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fetch } from "undici";
import { authMiddleware } from "../middleware/auth.js";
import { validateVideoFile } from "../middleware/file-validation.js";
import { getClassifier } from "../services/classifier.js";
import { extractFrames, VideoTooLongError } from "../services/video-processor.js";
import { buildVideoResult, computeRiskScore } from "../services/verdict.js";
import { createTempDir, removeTempDir } from "../utils/temp.js";
import { config } from "../config.js";
import type { FrameResult } from "../services/verdict.js";
import type { ErrorResponse } from "../types.js";

interface QueryParams {
  frames?: string;
}

interface UrlBody {
  url: string;
}

export async function moderateVideoRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/moderate/video",
    { preHandler: authMiddleware },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const startMs = Date.now();
      const classifier = getClassifier();

      if (!classifier.name) {
        const body: ErrorResponse = { error: "Model is still loading, try again in a few seconds", code: "MODEL_NOT_READY" };
        return reply.code(503).send(body);
      }

      const query = request.query as QueryParams;
      const frameCount = Math.min(
        parseInt(query.frames ?? String(config.DEFAULT_FRAME_COUNT), 10) || config.DEFAULT_FRAME_COUNT,
        30
      );

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
          const err: ErrorResponse = { error: "Failed to fetch video from URL", code: "FETCH_FAILED" };
          return reply.code(422).send(err);
        }
        fileBuffer = Buffer.from(await response.arrayBuffer());
        mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "application/octet-stream";
      }

      const validation = validateVideoFile(fileBuffer, mimeType);
      if (!validation.valid) {
        return reply.code(validation.statusCode).send(validation.body);
      }

      const requestId = crypto.randomUUID();
      const tempDir = await createTempDir(requestId);

      try {
        // Write video buffer to temp file
        const videoPath = path.join(tempDir, "input.video");
        await fs.writeFile(videoPath, fileBuffer);

        let framePaths: string[];
        try {
          framePaths = await extractFrames(videoPath, tempDir, frameCount);
        } catch (err) {
          if (err instanceof VideoTooLongError) {
            const body: ErrorResponse = { error: err.message, code: "VIDEO_TOO_LONG" };
            return reply.code(422).send(body);
          }
          request.log.error(err, "ffmpeg frame extraction failed");
          const body: ErrorResponse = { error: "Video processing failed", code: "VIDEO_PROCESSING_FAILED" };
          return reply.code(500).send(body);
        }

        // Classify each frame sequentially — dispose tensors between frames
        const frameResults: FrameResult[] = [];
        for (const [index, framePath] of framePaths.entries()) {
          const frameBuffer = await fs.readFile(framePath);
          const scores = await classifier.classify(frameBuffer);
          frameResults.push({
            frameIndex: index,
            scores,
            riskScore: computeRiskScore(scores),
          });
        }

        const result = buildVideoResult(frameResults, Date.now() - startMs, classifier.version);

        request.log.info({
          verdict: result.verdict,
          frames_checked: result.frames_checked,
          worst_frame: result.worst_frame_index,
          processing_ms: result.processing_time_ms,
          file_size: fileBuffer.byteLength,
        }, "video moderation complete");

        return reply.code(200).send(result);
      } finally {
        await removeTempDir(tempDir);
      }
    }
  );
}
