# Stage 1: Build frontend (cache bust: 2026-03-24)
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

# Copy workspace config and lockfile first for layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ packages/shared/
COPY apps/server/ apps/server/
COPY apps/web/ apps/web/

# Build shared + web (server runs via tsx, no compile needed)
RUN pnpm --filter @runway/shared build

# Vite bakes VITE_* env vars at build time — set for production
ARG VITE_TELLER_ENV=development
ENV VITE_TELLER_ENV=${VITE_TELLER_ENV}
RUN pnpm --filter @runway/web build

# Stage 2: Production
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

ENV NODE_ENV=production

# Copy everything from build stage (includes node_modules)
COPY --from=build /app /app

EXPOSE 3001

CMD ["pnpm", "--filter", "@runway/server", "exec", "tsx", "src/index.ts"]
