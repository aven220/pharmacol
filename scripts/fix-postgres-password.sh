#!/usr/bin/env bash
# Alinea la contraseña de PostgreSQL con POSTGRES_PASSWORD del .env
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${PHARMACOL_COMPOSE_FILE:-docker-compose.yml}"
COMPOSE="docker compose -f ${COMPOSE_FILE}"

if [[ ! -f .env ]]; then
  echo "ERROR: Falta .env"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

PASS="${POSTGRES_PASSWORD:-}"
if [[ -z "$PASS" ]]; then
  echo "ERROR: POSTGRES_PASSWORD vacío en .env"
  exit 1
fi

echo "==> Levantando PostgreSQL (${COMPOSE_FILE})..."
$COMPOSE up -d postgres

echo "==> Esperando PostgreSQL..."
for i in $(seq 1 30); do
  if $COMPOSE exec -T postgres pg_isready -U pharmacol -d pharmacol >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# Escapar comillas simples en la contraseña para SQL
PASS_SQL="${PASS//\'/\'\'}"

echo "==> Actualizando contraseña del usuario pharmacol (conexión desde Mac / Prisma)..."
$COMPOSE exec -T postgres psql -U pharmacol -d pharmacol \
  -c "ALTER USER pharmacol PASSWORD '${PASS_SQL}';"

echo "✓ Contraseña alineada con POSTGRES_PASSWORD del .env"
echo ""
echo "Siguiente paso:"
echo "  pnpm db:migrate:dev"
echo "  pnpm dev:backend"
