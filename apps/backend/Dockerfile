# Backend multi-stage — monorepo pnpm + Prisma
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

FROM base AS builder
# Copiar fuentes ANTES de pnpm install (evita conflicto node_modules ↔ COPY)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/backend ./apps/backend
COPY database ./database

RUN pnpm install --frozen-lockfile \
    --filter @pharmacol/backend \
    --filter @pharmacol/database \
    --config.optional=false

WORKDIR /app/database
RUN pnpm exec prisma generate

WORKDIR /app
RUN pnpm build:backend

FROM node:20-alpine AS runner
WORKDIR /app/apps/backend
ENV NODE_ENV=production
RUN apk add --no-cache wget openssl libc6-compat
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend /app/apps/backend
COPY --from=builder --chown=nestjs:nodejs /app/database /app/database

USER nestjs
EXPOSE 3905
ENV API_PORT=3905
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://localhost:3905/v1/health || exit 1
CMD ["node", "dist/main.js"]
