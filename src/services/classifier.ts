import { config } from "../config.js";

export interface ClassifierScores {
  porn: number;
  sexy: number;
  hentai: number;
  neutral: number;
  drawing: number;
}

export interface Classifier {
  readonly name: string;
  readonly version: string;
  load(): Promise<void>;
  classify(imageBuffer: Buffer): Promise<ClassifierScores>;
  dispose(): void;
}

let instance: Classifier | null = null;

export function createClassifier(provider: string): Classifier {
  switch (provider) {
    case "nsfwjs": {
      const { NsfwjsClassifier } = require("./classifiers/nsfwjs.js") as {
        NsfwjsClassifier: new () => Classifier;
      };
      return new NsfwjsClassifier();
    }
    case "huggingface": {
      const { HuggingFaceClassifier } = require("./classifiers/huggingface.js") as {
        HuggingFaceClassifier: new () => Classifier;
      };
      return new HuggingFaceClassifier();
    }
    default:
      throw new Error(`Unknown model provider: ${provider}`);
  }
}

export function getClassifier(): Classifier {
  if (!instance) {
    instance = createClassifier(config.MODEL_PROVIDER);
  }
  return instance;
}
