# HireSocials Moderation Service

A self-hosted NSFW/content-safety microservice for the HireSocials platform. Receives images and videos, runs them through NSFW.js (TensorFlow.js), and returns a structured verdict.

## Quick Start

```bash
cp .env.example .env
pnpm install
pnpm dev          # starts on :3100 with hot-reload
```

## API

### `GET /health`

```json
{ "status": "ok", "model_loaded": true, "uptime": 123 }
```

### `POST /moderate/image`

**Multipart upload:**
```bash
curl -X POST http://localhost:3100/moderate/image \
  -H "X-Api-Key: $API_KEY" \
  -F "file=@photo.jpg"
```

**JSON URL:**
```bash
curl -X POST http://localhost:3100/moderate/image \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-minio/bucket/photo.jpg"}'
```

### `POST /moderate/video`

Same as image, plus optional `?frames=5` query param (1–30 frames to sample).

```bash
curl -X POST "http://localhost:3100/moderate/video?frames=8" \
  -H "X-Api-Key: $API_KEY" \
  -F "file=@clip.mp4"
```

### Response shape

```json
{
  "verdict": "approved",
  "safe": true,
  "scores": {
    "porn": 0.01,
    "sexy": 0.04,
    "hentai": 0.01,
    "neutral": 0.91,
    "drawing": 0.03
  },
  "thresholds": { "reject_above": 0.8, "flag_above": 0.5 },
  "frames_checked": 1,
  "worst_frame_index": null,
  "worst_frame_scores": null,
  "processing_time_ms": 87,
  "model_version": "nsfwjs-4.2.1-tfjs-4.x"
}
```

| verdict | meaning |
|---------|---------|
| `approved` | Safe to publish |
| `flagged` | Borderline — queue for human review |
| `rejected` | Block immediately |

### Error responses

```json
{ "error": "Human-readable message", "code": "FILE_TOO_LARGE" }
```

| code | HTTP | trigger |
|------|------|---------|
| `FILE_TOO_LARGE` | 413 | file > `MAX_FILE_SIZE_MB` |
| `INVALID_FILE_TYPE` | 415 | mime type not in allowed list |
| `VIDEO_TOO_LONG` | 422 | video > `MAX_VIDEO_DURATION_SECONDS` |
| `FETCH_FAILED` | 422 | URL unreachable |
| `MODEL_NOT_READY` | 503 | model still loading at startup |
| `UNAUTHORIZED` | 401 | missing/wrong `X-Api-Key` |
| `VIDEO_PROCESSING_FAILED` | 500 | ffmpeg error |
| `INTERNAL_ERROR` | 500 | unexpected error |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Listen port |
| `HOST` | `0.0.0.0` | Listen address |
| `LOG_LEVEL` | `info` | `debug\|info\|warn\|error` |
| `MODEL_PROVIDER` | `nsfwjs` | `nsfwjs\|huggingface` |
| `MODEL_PATH` | — | Custom model path (empty = default) |
| `REJECT_THRESHOLD` | `0.80` | Risk score → rejected |
| `FLAG_THRESHOLD` | `0.50` | Risk score → flagged |
| `SEXY_WEIGHT` | `0.70` | Multiplier on `sexy` score (reduces beach/fitness false positives) |
| `DEFAULT_FRAME_COUNT` | `5` | Video frames to extract |
| `MAX_VIDEO_DURATION_SECONDS` | `300` | Max video length (5 min) |
| `FFMPEG_PATH` | `/usr/bin/ffmpeg` | ffmpeg binary path |
| `MAX_FILE_SIZE_MB` | `50` | Max upload size |
| `ALLOWED_IMAGE_TYPES` | `image/jpeg,image/png,image/webp` | Accepted image MIME types |
| `ALLOWED_VIDEO_TYPES` | `video/mp4,video/quicktime,video/webm` | Accepted video MIME types |
| `API_KEY` | — | If set, require `X-Api-Key` header on all requests |

## Verdict Logic

```
risk_score = max(porn, hentai, sexy × SEXY_WEIGHT)

risk_score ≥ REJECT_THRESHOLD  →  rejected
risk_score ≥ FLAG_THRESHOLD     →  flagged
otherwise                       →  approved

For video: worst frame determines verdict.
```

The `SEXY_WEIGHT` reduces false positives on fitness/beach/swimwear content — nsfwjs's `sexy` category fires on exposed skin even when the image is clearly non-explicit.

## Architecture

```
src/
├── index.ts                    Server bootstrap, model loading
├── config.ts                   Zod-validated env vars
├── types.ts                    ModerationResult, ErrorResponse
├── routes/
│   ├── health.ts               GET /health
│   ├── moderate-image.ts       POST /moderate/image
│   └── moderate-video.ts       POST /moderate/video
├── services/
│   ├── classifier.ts           Classifier interface + factory
│   ├── classifiers/
│   │   ├── nsfwjs.ts           NSFW.js (MobileNetV2/InceptionV3 via TF.js)
│   │   └── huggingface.ts      HuggingFace ViT stub (future)
│   ├── video-processor.ts      ffmpeg frame extraction
│   └── verdict.ts              Score → verdict logic
├── middleware/
│   ├── auth.ts                 API key validation
│   └── file-validation.ts      Size/type checks
└── utils/
    ├── temp.ts                 Temp directory lifecycle
    └── logger.ts               Standalone pino logger
```

### Swapping the model

To switch to a HuggingFace ViT model later:

1. `pnpm add @huggingface/transformers`
2. Implement `src/services/classifiers/huggingface.ts` (the interface is already defined)
3. Set `MODEL_PROVIDER=huggingface` in env
4. Map the binary `sfw/nsfw` output to the `ClassifierScores` shape

## Deployment on Coolify

1. Create a new service in Coolify → "Docker Compose" or "Dockerfile"
2. Point it at this repo
3. Set env vars in Coolify's environment panel (copy from `.env.example`)
4. Set `API_KEY` to a secret shared with the HireSocials Remix app
5. The health check at `/health` is used by Coolify to determine readiness
6. **Note:** The model loads in ~10–30s on first start — `start_period: 60s` in the health check accounts for this

### Internal networking

The HireSocials Remix app should call this service via the internal Coolify network hostname, not via the public port:

```
POST http://moderation:3100/moderate/image
X-Api-Key: <shared secret>
```

## Running Tests

```bash
pnpm test           # unit + integration (mocked classifier)
pnpm typecheck      # TypeScript strict check
pnpm lint           # ESLint
```

For real model integration tests (requires model download):

```bash
pnpm dev &
curl -X POST http://localhost:3100/moderate/image -F "file=@tests/fixtures/safe-white.png"
```

See [tests/fixtures/README.md](tests/fixtures/README.md) for how to generate test images.
