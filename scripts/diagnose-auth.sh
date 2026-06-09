#!/usr/bin/env bash
# Diagnóstico login admin + URL API local
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/lib/pharmacol-api-url.sh"

COMPOSE="docker compose -p pharmacol -f docker-compose.prod.yml"
EMAIL="${SEED_ADMIN_EMAIL:-admin@pharmacol.co}"
API="$(pharmacol_resolve_api_local "$ROOT")"

echo "==> PharmaCol — diagnóstico auth"
echo ""

if [[ -f .env ]]; then
  pharmacol_load_env "$ROOT"
  echo "→ .env PHARMACOL_API_LOCAL=${PHARMACOL_API_LOCAL:-<vacío>}"
  if [[ -n "${PHARMACOL_API_LOCAL:-}" && "$PHARMACOL_API_LOCAL" != *"/pharmacol/v1"* ]]; then
    echo "  ⚠ Valor antiguo sin /pharmacol — corrige en .env o usa el script reset/sync"
  fi
fi
echo "→ API local usada: ${API}"
echo ""

echo "→ Health API..."
if curl -sf "${API}/health" >/dev/null; then
  echo "  ✓ ${API}/health"
else
  echo "  ✗ No responde ${API}/health"
  echo "    docker compose -p pharmacol -f docker-compose.prod.yml ps"
  exit 1
fi
echo ""

echo "→ Usuario en PostgreSQL (${EMAIL}):"
$COMPOSE exec -T postgres psql -U pharmacol -d pharmacol -c \
  "SELECT email, status, intentos_fallidos, bloqueado_hasta IS NOT NULL AS bloqueado,
          CASE WHEN password_hash LIKE '%:%' THEN 'scrypt' ELSE 'otro-formato' END AS hash_tipo
   FROM users WHERE email = '${EMAIL}';" || true
echo ""

echo "→ Login curl..."
LOGIN=$(curl -sS -w "\n%{http_code}" -X POST "${API}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"admin123\"}") || true
HTTP=$(echo "$LOGIN" | tail -n1)
BODY=$(echo "$LOGIN" | sed '$d')

if [[ "$HTTP" == "200" || "$HTTP" == "201" ]]; then
  echo "  ✓ Login OK con admin123"
  exit 0
fi

echo "  ✗ Login falló (HTTP ${HTTP})"
echo "  ${BODY}"
echo ""
echo "→ Solución: restablecer admin y desbloquear cuenta"
echo "    bash scripts/reset-admin.sh"
echo "    bash scripts/diagnose-auth.sh"
