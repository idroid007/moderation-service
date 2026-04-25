import { config } from "../config.js";
import type { ClassifierScores } from "./classifier.js";
import type { ModerationResult } from "../types.js";

export interface FrameResult {
  frameIndex: number;
  scores: ClassifierScores;
  riskScore: number;
}

export function computeRiskScore(scores: ClassifierScores): number {
  return Math.max(scores.porn, scores.hentai, scores.sexy * config.SEXY_WEIGHT);
}

export function verdictFromRisk(
  riskScore: number
): "approved" | "flagged" | "rejected" {
  if (riskScore >= config.REJECT_THRESHOLD) return "rejected";
  if (riskScore >= config.FLAG_THRESHOLD) return "flagged";
  return "approved";
}

export function buildImageResult(
  scores: ClassifierScores,
  processingTimeMs: number,
  modelVersion: string
): ModerationResult {
  const riskScore = computeRiskScore(scores);
  const verdict = verdictFromRisk(riskScore);

  return {
    verdict,
    safe: verdict !== "rejected",
    scores,
    thresholds: {
      reject_above: config.REJECT_THRESHOLD,
      flag_above: config.FLAG_THRESHOLD,
    },
    frames_checked: 1,
    worst_frame_index: null,
    worst_frame_scores: null,
    processing_time_ms: processingTimeMs,
    model_version: modelVersion,
  };
}

export function buildVideoResult(
  frameResults: FrameResult[],
  processingTimeMs: number,
  modelVersion: string
): ModerationResult {
  // Determine worst frame by highest risk score
  let worstFrame = frameResults[0];
  for (const frame of frameResults) {
    if (frame.riskScore > worstFrame.riskScore) {
      worstFrame = frame;
    }
  }

  // If any frame is rejected → whole video rejected
  // If any frame is flagged → whole video flagged
  // Otherwise → approved
  let verdict: "approved" | "flagged" | "rejected" = "approved";
  for (const frame of frameResults) {
    const frameVerdict = verdictFromRisk(frame.riskScore);
    if (frameVerdict === "rejected") {
      verdict = "rejected";
      break;
    }
    if (frameVerdict === "flagged") {
      verdict = "flagged";
    }
  }

  return {
    verdict,
    safe: verdict !== "rejected",
    scores: worstFrame.scores,
    thresholds: {
      reject_above: config.REJECT_THRESHOLD,
      flag_above: config.FLAG_THRESHOLD,
    },
    frames_checked: frameResults.length,
    worst_frame_index: worstFrame.frameIndex,
    worst_frame_scores: worstFrame.scores as unknown as Record<string, number>,
    processing_time_ms: processingTimeMs,
    model_version: modelVersion,
  };
}
