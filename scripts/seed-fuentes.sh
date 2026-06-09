#!/usr/bin/env bash
# Repuebla fuentes INVIMA en BD (botones de sync en el admin web)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -p pharmacol -f docker-compose.prod.yml"

echo "==> Seed fuentes INVIMA (data_sources)..."
$COMPOSE up -d postgres >/dev/null
$COMPOSE --profile setup run --rm --build seed sh -c \
  "pnpm exec prisma generate && pnpm exec tsx scripts/seed-fuentes-cli.ts"

echo "✓ Fuentes listas. Recarga https://20.5.19.8/pharmacol/sync"
