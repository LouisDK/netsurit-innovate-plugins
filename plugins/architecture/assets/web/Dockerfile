# ============================================================================
# Dockerfile for Next.js Web App (Frontend)
#
# This is a reference template. Copy to apps/web/Dockerfile
# and adapt package names and paths.
#
# Multi-stage build with Next.js standalone output.
# Requires `output: 'standalone'` in next.config.
# Build from project root: docker build -f apps/web/Dockerfile .
# ============================================================================

# Stage 1: Base with pnpm
FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Stage 2: Install dependencies
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# Stage 3: Build
FROM deps AS builder
ARG BUILD_VERSION=unknown
ENV BUILD_VERSION=${BUILD_VERSION}
ENV NEXT_PUBLIC_BUILD_VERSION=${BUILD_VERSION}
COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/
RUN pnpm --filter @{app-name}/shared build
RUN pnpm --filter @{app-name}/web build

# Stage 4: Production
FROM node:22-slim AS production
ARG BUILD_VERSION=unknown
ENV BUILD_VERSION=${BUILD_VERSION}
ENV NEXT_PUBLIC_BUILD_VERSION=${BUILD_VERSION}
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
WORKDIR /app

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Copy standalone build
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
