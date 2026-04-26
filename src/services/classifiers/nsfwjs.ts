import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-wasm";
import * as nsfw from "nsfwjs";
import sharp from "sharp";
import { config } from "../../config.js";
import type { Classifier, ClassifierScores } from "../classifier.js";

// nsfwjs category labels returned by the model
type NsfwCategory = "Drawing" | "Hentai" | "Neutral" | "Porn" | "Sexy";

interface NsfwPrediction {
  className: NsfwCategory;
  probability: number;
}

export class NsfwjsClassifier implements Classifier {
  readonly name = "nsfwjs";
  readonly version = `nsfwjs-${(nsfw as unknown as { version?: string }).version ?? "4.x"}-tfjs-${tf.version.tfjs}`;

  private model: nsfw.NSFWJS | null = null;

  async load(): Promise<void> {
    // Use WASM backend — no native binaries required, works on any Node version
    await tf.setBackend("wasm");
    await tf.ready();

    // nsfw.load() expects a URL string or undefined (uses TF Hub default).
    // When MODEL_PATH is set (e.g. /app/model_cache), convert to file:// URL.
    let modelUrl: string | undefined;
    if (config.MODEL_PATH) {
      modelUrl = config.MODEL_PATH.startsWith("http")
        ? config.MODEL_PATH
        : `file://${config.MODEL_PATH}/`;
    }

    this.model = await nsfw.load(modelUrl, { size: 224 });
  }

  async classify(imageBuffer: Buffer): Promise<ClassifierScores> {
    if (!this.model) {
      throw new Error("Classifier not loaded — call load() first");
    }

    // Decode to raw pixels via sharp, then build a tf.Tensor3D manually.
    // nsfwjs.classify() accepts an HTMLImageElement in the browser; in Node.js
    // we construct the tensor directly and call classify() on it.
    const { data, info } = await sharp(imageBuffer)
      .resize(224, 224, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);

    let predictions: NsfwPrediction[];
    try {
      predictions = (await this.model.classify(
        tensor as unknown as Parameters<nsfw.NSFWJS["classify"]>[0]
      )) as NsfwPrediction[];
    } finally {
      tensor.dispose();
    }

    const scores: ClassifierScores = {
      porn: 0,
      sexy: 0,
      hentai: 0,
      neutral: 0,
      drawing: 0,
    };

    for (const p of predictions) {
      switch (p.className) {
        case "Porn":    scores.porn    = p.probability; break;
        case "Sexy":    scores.sexy    = p.probability; break;
        case "Hentai":  scores.hentai  = p.probability; break;
        case "Neutral": scores.neutral = p.probability; break;
        case "Drawing": scores.drawing = p.probability; break;
      }
    }

    return scores;
  }

  dispose(): void {
    const internal = this.model as unknown as { model?: { dispose?: () => void } };
    internal?.model?.dispose?.();
    this.model = null;
  }
}
