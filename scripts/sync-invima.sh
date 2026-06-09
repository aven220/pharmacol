#!/usr/bin/env bash
# Sincroniza datos INVIMA desde datos.gov.co hacia PostgreSQL
set -euo pipefail

API="${PHARMACOL_API:-http://127.0.0.1:8080/v1}"
EMAIL="${PHARMACOL_EMAIL:-admin@pharmacol.co}"
PASSWORD="${PHARMACOL_PASSWORD:-admin123}"
FUENTE="${1:-INVIMA_CUM_VIGENTES}"
MODE="${2:-sync}"  # sync = síncrono | async = cola BullMQ
FORCE="${3:-false}"

FORCE_JSON="false"
if [ "$FORCE" = "force" ] || [ "$FORCE" = "true" ]; then
  FORCE_JSON="true"
fi

echo "=== PharmaCol — Sync INVIMA ==="
echo "API:    $API"
echo "Fuente: $FUENTE"
echo ""

# Login
LOGIN_RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}") || {
  echo "✗ No se pudo conectar a $API — ¿Está corriendo el backend? (pnpm dev:backend)"
  exit 1
}

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo "✗ Login falló (HTTP $HTTP_CODE)"
  echo "$BODY"
  exit 1
fi

TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])") || {
  echo "✗ Respuesta de login inválida:"
  echo "$BODY"
  exit 1
}

echo "✓ Autenticado"

if [ "$MODE" = "async" ]; then
  ENDPOINT="/admin/sync/ejecutar"
  echo "→ Encolando sync (BullMQ)..."
else
  ENDPOINT="/admin/sync/ejecutar-sync"
  echo "→ Ejecutando sync (puede tardar varios minutos)..."
fi

RESULT=$(curl -sf -X POST "$API$ENDPOINT" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"fuenteCodigo\":\"$FUENTE\",\"force\":$FORCE_JSON}")

echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"

echo ""
echo "Fuentes disponibles:"
echo "  INVIMA_CUM_VIGENTES   — Medicamentos vigentes (recomendado primero)"
echo "  INVIMA_CUM_VENCIDOS   — Medicamentos vencidos"
echo "  INVIMA_DISPOSITIVOS   — Dispositivos médicos"
echo ""
echo "Ejemplos:"
echo "  pnpm sync:invima"
echo "  pnpm sync:invima INVIMA_DISPOSITIVOS"
echo "  bash scripts/sync-invima.sh INVIMA_CUM_VIGENTES async"
