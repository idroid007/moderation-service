import pino from "pino";
import { config } from "../config.js";

const isProd = process.env.NODE_ENV === "production";
const lokiHost = process.env.LOKI_HOST;
const lokiUser = process.env.LOKI_USER;
const lokiToken = process.env.LOKI_TOKEN;

const lokiEnabled = isProd && lokiHost && lokiUser && lokiToken;

export const logger = pino({
  level: config.LOG_LEVEL,
  transport: lokiEnabled
    ? {
        target: "pino-loki",
        options: {
          host: lokiHost,
          basicAuth: { username: lokiUser, password: lokiToken },
          batching: true,
          interval: 5,
          labels: {
            service: "moderation-service",
            env: process.env.NODE_ENV ?? "production",
          },
        },
      }
    : !isProd
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
