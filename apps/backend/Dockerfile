# Backend multi-stage — monorepo pnpm + Prisma
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS builder
# Manifests + schema Prisma (necesario antes de install/generate)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY database/package.json ./database/
COPY database/prisma ./database/prisma

# Backend + database (prisma CLI vive en devDependencies de database)
RUN pnpm install --frozen-lockfile \
    --filter @pharmacol/backend \
    --filter @pharmacol/database

COPY apps/backend ./apps/backend
COPY database ./database

RUN pnpm db:generate && pnpm build:backend

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/package.json ./package.json
USER nestjs
EXPOSE 3005
ENV API_PORT=3005
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3005/v1/health || exit 1
CMD ["node", "dist/main.js"]
