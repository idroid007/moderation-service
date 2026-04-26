# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

# ffmpeg for video, curl for health check, python3/make/g++ for tfjs-node native bindings
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg curl python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

WORKDIR /app

# Production deps only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Compiled JS from builder
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD curl -fsS http://localhost:3100/health || exit 1

# Run as non-root
RUN useradd -r -s /bin/false appuser && chown -R appuser /app
USER appuser

CMD ["node", "dist/index.js"]
