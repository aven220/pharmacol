#!/usr/bin/env bash
# Restablece admin@pharmacol.co → admin123 (o SEED_ADMIN_* del .env)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/lib/pharmacol-api-url.sh"

COMPOSE="docker compose -p pharmacol -f docker-compose.prod.yml"

if [[ -f .env ]]; then
  pharmacol_load_env "$ROOT"
fi

EMAIL="${SEED_ADMIN_EMAIL:-admin@pharmacol.co}"
PASSWORD="${SEED_ADMIN_PASSWORD:-admin123}"
API="$(pharmacol_resolve_api_local "$ROOT")"

echo "==> Restablecer usuario admin"
echo "    Email:    ${EMAIL}"
echo "    API:      ${API}"
echo ""

echo "→ Seed (roles + admin)..."
$COMPOSE --profile setup run --rm \
  -e SEED_ADMIN_EMAIL="$EMAIL" \
  -e SEED_ADMIN_PASSWORD="$PASSWORD" \
  seed

echo "→ Desbloquear cuenta..."
$COMPOSE exec -T postgres psql -U pharmacol -d pharmacol -c \
  "UPDATE users SET status = 'ACTIVO', intentos_fallidos = 0, bloqueado_hasta = NULL
   WHERE email = '${EMAIL}';"

echo ""
echo "→ Verificar login..."
LOGIN=$(curl -sS -w "\n%{http_code}" -X POST "${API}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")
HTTP=$(echo "$LOGIN" | tail -n1)
BODY=$(echo "$LOGIN" | sed '$d')

if [[ "$HTTP" == "200" || "$HTTP" == "201" ]]; then
  echo "✓ Login OK"
else
  echo "✗ Login aún falla (HTTP ${HTTP})"
  echo "$BODY"
  echo ""
  echo "Revisa POSTGRES_PASSWORD en .env vs contraseña real de Postgres:"
  echo "  bash scripts/fix-postgres-password.sh"
  exit 1
fi

echo ""
echo "✓ Admin listo. Sync INVIMA:"
echo "  bash scripts/sync-invima.sh INVIMA_CUM_VIGENTES sync"
