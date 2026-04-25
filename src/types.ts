export interface ModerationResult {
  verdict: "approved" | "flagged" | "rejected";
  safe: boolean;
  scores: {
    porn: number;
    sexy: number;
    hentai: number;
    neutral: number;
    drawing: number;
  };
  thresholds: {
    reject_above: number;
    flag_above: number;
  };
  frames_checked: number;
  worst_frame_index: number | null;
  worst_frame_scores: Record<string, number> | null;
  processing_time_ms: number;
  model_version: string;
}

export interface ErrorResponse {
  error: string;
  code: ErrorCode;
}

export type ErrorCode =
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "VIDEO_TOO_LONG"
  | "MODEL_NOT_READY"
  | "VIDEO_PROCESSING_FAILED"
  | "FETCH_FAILED"
  | "REQUEST_TIMEOUT"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";
