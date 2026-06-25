#!/usr/bin/env bash
# Repuebla fuentes INVIMA en BD (botones de sync en el admin web)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ "${PHARMACOL_USE_DOCKER_SEED:-}" = "1" ]; then
  COMPOSE="docker compose -p pharmacol -f docker-compose.prod.yml"
  echo "==> Seed fuentes INVIMA (Docker / servidor)..."
  $COMPOSE up -d postgres
  $COMPOSE --profile setup run --rm --build seed sh -c \
    "pnpm exec prisma generate && pnpm exec tsx scripts/seed-fuentes-cli.ts"
else
  echo "==> Seed fuentes INVIMA (local Mac)..."
  bash "$ROOT/scripts/run-with-env.sh" tsx scripts/seed-fuentes-cli.ts
fi

echo "✓ Fuentes listas. Recarga el admin → Sincronización o Alertas INVIMA."
