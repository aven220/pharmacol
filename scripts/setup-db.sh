#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export DATABASE_URL="${DATABASE_URL:-postgresql://pharmacol:pharmacol_dev@localhost:5433/pharmacol?schema=public}"

echo "==> Levantando PostgreSQL y Redis..."
docker compose up -d postgres redis

echo "==> Esperando PostgreSQL..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U pharmacol -d pharmacol >/dev/null 2>&1; then
    echo "    PostgreSQL listo."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: PostgreSQL no respondió a tiempo."
    exit 1
  fi
  sleep 2
done

echo "==> Aplicando migraciones..."
npx pnpm --filter @pharmacol/database db:migrate:deploy

echo "==> Índices avanzados (GIN trigram, BRIN)..."
docker compose exec -T postgres psql -U pharmacol -d pharmacol \
  < database/scripts/002_indexes.sql || echo "    (índices ya existen o tablas vacías — OK)"

echo "==> Vista materializada..."
docker compose exec -T postgres psql -U pharmacol -d pharmacol \
  < database/scripts/004_materialized_views.sql || echo "    (vista ya existe — OK)"

echo "==> Ejecutando seed..."
npx pnpm --filter @pharmacol/database db:seed

echo ""
echo "✅ Base de datos configurada."
echo "   Admin: admin@pharmacol.co / PharmaCol2026!Admin"
echo "   Studio: pnpm db:studio"
