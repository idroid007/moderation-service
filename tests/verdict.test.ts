import { describe, it, expect } from "vitest";

import {
  computeRiskScore,
  verdictFromRisk,
  buildImageResult,
  buildVideoResult,
} from "../src/services/verdict.js";
import type { ClassifierScores } from "../src/services/classifier.js";
import type { FrameResult } from "../src/services/verdict.js";

const safeScores: ClassifierScores = {
  porn: 0.01,
  sexy: 0.05,
  hentai: 0.01,
  neutral: 0.90,
  drawing: 0.03,
};

const flaggedScores: ClassifierScores = {
  porn: 0.0,
  sexy: 0.80, // * 0.70 = 0.56 → above FLAG (0.50) but below REJECT (0.80)
  hentai: 0.05,
  neutral: 0.10,
  drawing: 0.05,
};

const rejectedScores: ClassifierScores = {
  porn: 0.92,
  sexy: 0.05,
  hentai: 0.02,
  neutral: 0.01,
  drawing: 0.00,
};

describe("computeRiskScore", () => {
  it("uses max of porn and weighted sexy", () => {
    const score = computeRiskScore(flaggedScores);
    // sexy=0.80 * 0.70=0.56, porn=0, hentai=0.05 → 0.56
    expect(score).toBeCloseTo(0.56);
  });

  it("picks porn when higher than weighted sexy", () => {
    const score = computeRiskScore(rejectedScores);
    expect(score).toBeCloseTo(0.92);
  });

  it("returns near-zero for safe content", () => {
    const score = computeRiskScore(safeScores);
    expect(score).toBeLessThan(0.1);
  });
});

describe("verdictFromRisk", () => {
  it("returns approved below flag threshold", () => {
    expect(verdictFromRisk(0.49)).toBe("approved");
    expect(verdictFromRisk(0.0)).toBe("approved");
  });

  it("returns flagged between thresholds", () => {
    expect(verdictFromRisk(0.50)).toBe("flagged");
    expect(verdictFromRisk(0.79)).toBe("flagged");
  });

  it("returns rejected at or above reject threshold", () => {
    expect(verdictFromRisk(0.80)).toBe("rejected");
    expect(verdictFromRisk(1.0)).toBe("rejected");
  });
});

describe("buildImageResult", () => {
  it("builds approved result for safe scores", () => {
    const result = buildImageResult(safeScores, 42, "nsfwjs-test");
    expect(result.verdict).toBe("approved");
    expect(result.safe).toBe(true);
    expect(result.frames_checked).toBe(1);
    expect(result.worst_frame_index).toBeNull();
    expect(result.model_version).toBe("nsfwjs-test");
    expect(result.processing_time_ms).toBe(42);
  });

  it("builds flagged result for borderline sexy content", () => {
    const result = buildImageResult(flaggedScores, 10, "nsfwjs-test");
    expect(result.verdict).toBe("flagged");
    expect(result.safe).toBe(true); // safe=true for flagged (caller decides to flag, not block)
  });

  it("builds rejected result for explicit content", () => {
    const result = buildImageResult(rejectedScores, 10, "nsfwjs-test");
    expect(result.verdict).toBe("rejected");
    expect(result.safe).toBe(false);
  });

  it("exposes thresholds in response", () => {
    const result = buildImageResult(safeScores, 10, "nsfwjs-test");
    expect(result.thresholds.reject_above).toBe(0.80);
    expect(result.thresholds.flag_above).toBe(0.50);
  });
});

describe("buildVideoResult", () => {
  it("rejects if any frame is rejected", () => {
    const frames: FrameResult[] = [
      { frameIndex: 0, scores: safeScores, riskScore: computeRiskScore(safeScores) },
      { frameIndex: 1, scores: rejectedScores, riskScore: computeRiskScore(rejectedScores) },
      { frameIndex: 2, scores: safeScores, riskScore: computeRiskScore(safeScores) },
    ];
    const result = buildVideoResult(frames, 200, "nsfwjs-test");
    expect(result.verdict).toBe("rejected");
    expect(result.worst_frame_index).toBe(1);
    expect(result.frames_checked).toBe(3);
  });

  it("flags if any frame is flagged and none rejected", () => {
    const frames: FrameResult[] = [
      { frameIndex: 0, scores: safeScores, riskScore: computeRiskScore(safeScores) },
      { frameIndex: 1, scores: flaggedScores, riskScore: computeRiskScore(flaggedScores) },
    ];
    const result = buildVideoResult(frames, 100, "nsfwjs-test");
    expect(result.verdict).toBe("flagged");
    expect(result.worst_frame_index).toBe(1);
  });

  it("approves all-safe video", () => {
    const frames: FrameResult[] = [
      { frameIndex: 0, scores: safeScores, riskScore: computeRiskScore(safeScores) },
      { frameIndex: 1, scores: safeScores, riskScore: computeRiskScore(safeScores) },
    ];
    const result = buildVideoResult(frames, 80, "nsfwjs-test");
    expect(result.verdict).toBe("approved");
  });

  it("identifies worst frame correctly", () => {
    const frames: FrameResult[] = [
      { frameIndex: 0, scores: safeScores, riskScore: 0.02 },
      { frameIndex: 1, scores: flaggedScores, riskScore: 0.56 },
      { frameIndex: 2, scores: safeScores, riskScore: 0.03 },
    ];
    const result = buildVideoResult(frames, 90, "nsfwjs-test");
    expect(result.worst_frame_index).toBe(1);
    expect(result.worst_frame_scores).not.toBeNull();
  });
});
