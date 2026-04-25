import type { Classifier, ClassifierScores } from "../classifier.js";

/**
 * Future implementation using @huggingface/transformers + Falconsai/nsfw_image_detection.
 *
 * The HuggingFace ViT models return binary (sfw/nsfw) scores, so we map
 * the single nsfw probability to porn/hentai and fill the rest with zeros.
 * To use: set MODEL_PROVIDER=huggingface in env.
 *
 * Swap plan:
 *   1. npm install @huggingface/transformers
 *   2. Replace the stub below with pipeline('image-classification', 'Falconsai/nsfw_image_detection')
 *   3. Map model output { label: 'nsfw', score } → scores.porn = score (or use a finer model)
 */
export class HuggingFaceClassifier implements Classifier {
  readonly name = "huggingface";
  readonly version = "huggingface-stub-v0";

  async load(): Promise<void> {
    throw new Error(
      "HuggingFaceClassifier is not yet implemented. Set MODEL_PROVIDER=nsfwjs."
    );
  }

  async classify(_imageBuffer: Buffer): Promise<ClassifierScores> {
    throw new Error("HuggingFaceClassifier is not yet implemented.");
  }

  dispose(): void {
    // no-op
  }
}
