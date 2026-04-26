# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml .pnpmfile.cjs ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

# ffmpeg for video frame extraction, curl for health check
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg curl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

WORKDIR /app

# Production deps only
COPY package.json pnpm-lock.yaml .pnpmfile.cjs ./
RUN pnpm install --frozen-lockfile --prod

# Compiled JS from builder
COPY --from=builder /app/dist ./dist

# Pre-download the nsfwjs model into /app/model_cache at build time so the
# container never needs outbound internet access at runtime.
# MODEL_PATH env var tells the classifier to load from this directory.
ENV MODEL_PATH=/app/model_cache
RUN node -e " \
  process.env.MODEL_PATH = '/app/model_cache'; \
  const tf = require('@tensorflow/tfjs'); \
  require('@tensorflow/tfjs-backend-wasm'); \
  const nsfw = require('nsfwjs'); \
  tf.setBackend('wasm').then(() => tf.ready()).then(() => \
    nsfw.load(undefined, { size: 299 }) \
  ).then(() => { \
    console.log('Model pre-cached to /app/model_cache'); \
    process.exit(0); \
  }).catch(e => { \
    console.warn('Pre-cache skipped (will fetch at runtime):', e.message); \
    process.exit(0); \
  })" || true

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD curl -fsS http://localhost:3100/health || exit 1

# Run as non-root
RUN useradd -r -s /bin/false appuser && chown -R appuser /app
USER appuser

CMD ["node", "dist/index.js"]
