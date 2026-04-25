import { config } from "../config.js";
import type { ErrorResponse } from "../types.js";

export interface ValidationResult {
  valid: true;
  buffer: Buffer;
  mimeType: string;
}

export interface ValidationError {
  valid: false;
  statusCode: number;
  body: ErrorResponse;
}

export function validateImageFile(
  buffer: Buffer,
  mimeType: string
): ValidationResult | ValidationError {
  const maxBytes = config.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (buffer.byteLength > maxBytes) {
    return {
      valid: false,
      statusCode: 413,
      body: {
        error: `File exceeds maximum size of ${config.MAX_FILE_SIZE_MB}MB`,
        code: "FILE_TOO_LARGE",
      },
    };
  }

  if (!config.ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return {
      valid: false,
      statusCode: 415,
      body: {
        error: `Unsupported file type. Allowed: ${config.ALLOWED_IMAGE_TYPES.join(", ")}`,
        code: "INVALID_FILE_TYPE",
      },
    };
  }

  return { valid: true, buffer, mimeType };
}

export function validateVideoFile(
  buffer: Buffer,
  mimeType: string
): ValidationResult | ValidationError {
  const maxBytes = config.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (buffer.byteLength > maxBytes) {
    return {
      valid: false,
      statusCode: 413,
      body: {
        error: `File exceeds maximum size of ${config.MAX_FILE_SIZE_MB}MB`,
        code: "FILE_TOO_LARGE",
      },
    };
  }

  if (!config.ALLOWED_VIDEO_TYPES.includes(mimeType)) {
    return {
      valid: false,
      statusCode: 415,
      body: {
        error: `Unsupported file type. Allowed: ${config.ALLOWED_VIDEO_TYPES.join(", ")}`,
        code: "INVALID_FILE_TYPE",
      },
    };
  }

  return { valid: true, buffer, mimeType };
}
