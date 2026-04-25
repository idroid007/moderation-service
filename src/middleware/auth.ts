import type { FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config.js";
import type { ErrorResponse } from "../types.js";

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!config.API_KEY) return; // auth disabled

  const provided = request.headers["x-api-key"];
  if (!provided || provided !== config.API_KEY) {
    const body: ErrorResponse = {
      error: "Invalid or missing API key",
      code: "UNAUTHORIZED",
    };
    await reply.code(401).send(body);
  }
}
