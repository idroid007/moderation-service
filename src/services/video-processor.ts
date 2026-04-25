import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { config } from "../config.js";

const execFileAsync = promisify(execFile);

export async function getVideoDuration(videoPath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    videoPath,
  ]);
  const duration = parseFloat(stdout.trim());
  if (isNaN(duration)) {
    throw new Error(`Could not determine video duration for: ${videoPath}`);
  }
  return duration;
}

function calculateFrameTimestamps(
  duration: number,
  frameCount: number
): number[] {
  if (frameCount === 1) return [duration / 2];

  // Evenly spaced: first frame at 0, last at duration, rest distributed
  const timestamps: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    timestamps.push((i / (frameCount - 1)) * duration);
  }
  return timestamps;
}

export async function extractFrames(
  videoPath: string,
  outputDir: string,
  frameCount: number
): Promise<string[]> {
  const duration = await getVideoDuration(videoPath);

  if (duration > config.MAX_VIDEO_DURATION_SECONDS) {
    throw new VideoTooLongError(duration, config.MAX_VIDEO_DURATION_SECONDS);
  }

  const timestamps = calculateFrameTimestamps(duration, frameCount);
  const framePaths: string[] = [];

  for (const [index, timestamp] of timestamps.entries()) {
    const framePath = path.join(outputDir, `frame-${index}.jpg`);
    await execFileAsync(config.FFMPEG_PATH, [
      "-ss", String(timestamp),
      "-i", videoPath,
      "-frames:v", "1",
      "-q:v", "2",
      framePath,
    ]);
    framePaths.push(framePath);
  }

  return framePaths;
}

export class VideoTooLongError extends Error {
  constructor(actual: number, max: number) {
    super(`Video too long: ${actual.toFixed(1)}s exceeds ${max}s limit`);
    this.name = "VideoTooLongError";
  }
}
