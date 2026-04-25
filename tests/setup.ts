// Global test environment setup — runs before any test file imports modules.
// This ensures config.ts parses valid env values on first load.
process.env.PORT = "3100";
process.env.HOST = "127.0.0.1";
process.env.LOG_LEVEL = "error";
process.env.MODEL_PROVIDER = "nsfwjs";
process.env.REJECT_THRESHOLD = "0.80";
process.env.FLAG_THRESHOLD = "0.50";
process.env.SEXY_WEIGHT = "0.70";
process.env.DEFAULT_FRAME_COUNT = "5";
process.env.MAX_VIDEO_DURATION_SECONDS = "300";
process.env.FFMPEG_PATH = "/usr/bin/ffmpeg";
process.env.MAX_FILE_SIZE_MB = "50";
process.env.ALLOWED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";
process.env.ALLOWED_VIDEO_TYPES = "video/mp4,video/quicktime,video/webm";
