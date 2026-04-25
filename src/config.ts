import { z } from "zod";

const commaSeparated = z
  .string()
  .transform((s) => s.split(",").map((v) => v.trim()).filter(Boolean));

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Model
  MODEL_PROVIDER: z.enum(["nsfwjs", "huggingface"]).default("nsfwjs"),
  MODEL_PATH: z.string().optional(),

  // Thresholds
  REJECT_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  FLAG_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
  SEXY_WEIGHT: z.coerce.number().min(0).max(1).default(0.7),

  // Video
  DEFAULT_FRAME_COUNT: z.coerce.number().int().min(1).max(30).default(5),
  MAX_VIDEO_DURATION_SECONDS: z.coerce.number().int().min(1).default(300),
  FFMPEG_PATH: z.string().default("/usr/bin/ffmpeg"),

  // Limits
  MAX_FILE_SIZE_MB: z.coerce.number().int().min(1).default(50),
  ALLOWED_IMAGE_TYPES: commaSeparated.default("image/jpeg,image/png,image/webp"),
  ALLOWED_VIDEO_TYPES: commaSeparated.default("video/mp4,video/quicktime,video/webm"),

  // Auth
  API_KEY: z.string().optional(),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

export const config = loadConfig();
export type Config = typeof config;
