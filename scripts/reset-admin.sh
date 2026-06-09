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
echo "    Password: ${PASSWORD}"
echo "    API:      ${API}"
echo ""

if [[ -n "${PHARMACOL_PASSWORD:-}" && "${PHARMACOL_PASSWORD}" != "$PASSWORD" ]]; then
  echo "⚠ PHARMACOL_PASSWORD en .env difiere del admin — sync usará PHARMACOL_PASSWORD"
  echo "  Quita PHARMACOL_PASSWORD del .env o ponlo igual a SEED_ADMIN_PASSWORD"
  echo ""
fi

echo "→ Postgres..."
$COMPOSE up -d postgres >/dev/null
for i in $(seq 1 30); do
  if $COMPOSE exec -T postgres pg_isready -U pharmacol -d pharmacol >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "→ Reset admin en BD..."
$COMPOSE --profile setup run --rm --build \
  -e SEED_ADMIN_EMAIL="$EMAIL" \
  -e SEED_ADMIN_PASSWORD="$PASSWORD" \
  seed pnpm exec tsx scripts/reset-admin-cli.ts

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
  echo "Diagnóstico:"
  echo "  bash scripts/diagnose-auth.sh"
  echo "  bash scripts/fix-postgres-password.sh && bash scripts/reset-admin.sh"
  exit 1
fi

echo ""
echo "✓ Admin listo. Sync INVIMA:"
echo "  bash scripts/sync-invima.sh INVIMA_CUM_VIGENTES sync"
