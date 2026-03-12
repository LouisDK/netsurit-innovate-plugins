# ============================================================================
# Dockerfile for Fastify Orchestrator (Backend API)
#
# This is a reference template. Copy to apps/orchestrator/Dockerfile
# and adapt package names and paths.
#
# Multi-stage build for minimal production image.
# Build from project root: docker build -f apps/orchestrator/Dockerfile .
# ============================================================================

# Stage 1: Base with pnpm
FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Stage 2: Install dependencies
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/orchestrator/package.json ./apps/orchestrator/
RUN pnpm install --frozen-lockfile

# Stage 3: Build
FROM deps AS builder
COPY packages/shared/ ./packages/shared/
COPY apps/orchestrator/ ./apps/orchestrator/
# Build shared package first (orchestrator depends on it)
RUN pnpm --filter @{app-name}/shared build
RUN pnpm --filter @{app-name}/orchestrator build

# Stage 4: Production
FROM node:22-slim AS production
ARG BUILD_VERSION=unknown
ENV BUILD_VERSION=${BUILD_VERSION}
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs appuser

# Copy build artifacts and production dependencies
COPY --from=builder /app/apps/orchestrator/dist ./apps/orchestrator/dist
COPY --from=builder /app/apps/orchestrator/package.json ./apps/orchestrator/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN chown -R appuser:nodejs /app
USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "apps/orchestrator/dist/index.js"]
