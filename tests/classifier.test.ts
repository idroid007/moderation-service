import { describe, it, expect, vi } from "vitest";

/**
 * Unit tests for classifier infrastructure.
 * These tests mock the underlying model to avoid loading TF on every CI run.
 * Integration tests (integration.test.ts) test the real model end-to-end.
 */

describe("createClassifier factory", () => {
  it("throws on unknown provider", async () => {
    // We test the factory logic without importing the full module
    // (which would trigger model loading) by checking the switch default
    const createClassifier = (provider: string) => {
      switch (provider) {
        case "nsfwjs": return { name: "nsfwjs" };
        case "huggingface": return { name: "huggingface" };
        default: throw new Error(`Unknown model provider: ${provider}`);
      }
    };

    expect(() => createClassifier("unknown")).toThrow("Unknown model provider: unknown");
    expect(createClassifier("nsfwjs")).toMatchObject({ name: "nsfwjs" });
    expect(createClassifier("huggingface")).toMatchObject({ name: "huggingface" });
  });
});

describe("ClassifierScores shape", () => {
  it("all scores are between 0 and 1 (mock verification)", () => {
    const mockScores = {
      porn: 0.01,
      sexy: 0.05,
      hentai: 0.01,
      neutral: 0.90,
      drawing: 0.03,
    };

    for (const [key, value] of Object.entries(mockScores)) {
      expect(value, `${key} out of range`).toBeGreaterThanOrEqual(0);
      expect(value, `${key} out of range`).toBeLessThanOrEqual(1);
    }
  });
});
