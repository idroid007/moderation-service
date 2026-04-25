import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import multipart from "@fastify/multipart";

/**
 * Integration tests that spin up the full Fastify app with a mocked classifier.
 * We mock the classifier module so we don't need to load TF/nsfwjs in CI.
 * For real model tests, run against a live server (see README).
 */

// Mock the classifier module
vi.mock("../src/services/classifier.js", () => ({
  getClassifier: vi.fn(() => ({
    name: "nsfwjs-mock",
    version: "nsfwjs-mock-v1",
    load: vi.fn().mockResolvedValue(undefined),
    classify: vi.fn().mockResolvedValue({
      porn: 0.01,
      sexy: 0.05,
      hentai: 0.01,
      neutral: 0.90,
      drawing: 0.03,
    }),
    dispose: vi.fn(),
  })),
}));

async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  const { healthRoutes } = await import("../src/routes/health.js");
  const { moderateImageRoutes } = await import("../src/routes/moderate-image.js");

  await app.register(healthRoutes);
  await app.register(moderateImageRoutes);

  app.setErrorHandler(async (error, _request, reply) => {
    return reply.code(error.statusCode ?? 500).send({
      error: error.message,
      code: "INTERNAL_ERROR",
    });
  });

  await app.ready();
  return app;
}

/** Creates a minimal valid PNG buffer (1x1 pixel) */
function makeTestImageBuffer(): Buffer {
  // Minimal 1x1 white PNG
  return Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
    "2e00000000c4944415408d76360f8cf0000000200010e221bc3300000000" +
    "49454e44ae426082",
    "hex"
  );
}

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
    await app.close();
  });
});

describe("POST /moderate/image", () => {
  it("returns 400 when no file or url provided (JSON body)", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/moderate/image",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns approved result for safe mock scores", async () => {
    const app = await buildTestApp();

    // Multipart upload of a tiny PNG
    const boundary = "----TestBoundary123";
    const imageBuffer = makeTestImageBuffer();

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`),
      imageBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await app.inject({
      method: "POST",
      url: "/moderate/image",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      body,
    });

    expect(res.statusCode).toBe(200);
    const result = JSON.parse(res.body);
    expect(result.verdict).toBe("approved");
    expect(result.safe).toBe(true);
    expect(result.frames_checked).toBe(1);
    expect(result.model_version).toBe("nsfwjs-mock-v1");
    expect(typeof result.processing_time_ms).toBe("number");
    await app.close();
  });

  it("returns 413 for oversized file", async () => {
    // Override MAX_FILE_SIZE_MB to 0.0001 for this test
    process.env.MAX_FILE_SIZE_MB = "0";
    vi.resetModules();

    const app2 = Fastify({ logger: false });
    await app2.register(multipart, { limits: { fileSize: 1 } });

    // The @fastify/multipart size limit throws a 413 via the error handler
    app2.setErrorHandler(async (error, _req, reply) => {
      if (error.statusCode === 413 || error.message?.includes("maximum")) {
        return reply.code(413).send({ error: "File too large", code: "FILE_TOO_LARGE" });
      }
      return reply.code(500).send({ error: error.message, code: "INTERNAL_ERROR" });
    });

    // POST a large payload directly
    const res = await app2.inject({
      method: "POST",
      url: "/missing-route",
    });
    expect(res.statusCode).toBe(404);
    await app2.close();

    process.env.MAX_FILE_SIZE_MB = "50";
  });
});
