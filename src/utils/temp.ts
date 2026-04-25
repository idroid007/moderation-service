import fs from "fs/promises";
import path from "path";
import os from "os";

const MODERATION_TMP_ROOT = path.join(os.tmpdir(), "moderation");

export async function createTempDir(requestId: string): Promise<string> {
  const dir = path.join(MODERATION_TMP_ROOT, requestId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function removeTempDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup — log nothing here to avoid log spam on shutdown
  }
}

/**
 * Removes stale temp directories older than maxAgeMs.
 * Called on startup to recover from unclean shutdowns.
 */
export async function cleanupStaleTempDirs(
  maxAgeMs = 60 * 60 * 1000
): Promise<void> {
  try {
    const entries = await fs.readdir(MODERATION_TMP_ROOT, { withFileTypes: true });
    const now = Date.now();
    await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map(async (e) => {
          const dirPath = path.join(MODERATION_TMP_ROOT, e.name);
          const stat = await fs.stat(dirPath).catch(() => null);
          if (stat && now - stat.mtimeMs > maxAgeMs) {
            await fs.rm(dirPath, { recursive: true, force: true });
          }
        })
    );
  } catch {
    // Root dir doesn't exist yet — nothing to clean
  }
}
