# syntax=docker/dockerfile:1

# ---- Build stage: full toolchain, compile TS -> dist ----
FROM node:20-slim AS builder
WORKDIR /app

# Native deps (bcrypt) need a compiler at install time.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Include dev deps (nest CLI, ts) — needed to compile.
# Optional proxy/corporate CA: environments that intercept TLS (egress proxies)
# can pass their root CA so the registry handshake validates, without baking the
# cert into the image or the repo:
#   docker build --secret id=npm_ca,src=/etc/ssl/certs/ca-certificates.crt .
# When the secret is absent the mount target simply doesn't exist and Node
# ignores the empty NODE_EXTRA_CA_CERTS path, so public-CA builds are unaffected.
RUN --mount=type=secret,id=npm_ca,target=/run/secrets/npm_ca \
    NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca \
    npm ci --legacy-peer-deps --include=dev --no-audit --no-fund
COPY . .
RUN npm run build

# Prune to production dependencies for the runtime image.
RUN npm prune --omit=dev --legacy-peer-deps

# ---- Runtime stage: slim, non-root ----
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# dumb-init for correct signal handling (graceful shutdown of the worker/API).
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 1001 --create-home appuser

COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/dist ./dist
COPY --from=builder --chown=appuser:appuser /app/package.json ./package.json

USER appuser
EXPOSE 3000

# Container healthcheck hits the readiness probe.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health/ready',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
# Default: the API. The worker overrides this with: node dist/worker
CMD ["node", "dist/main"]
