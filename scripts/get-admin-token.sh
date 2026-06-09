#!/usr/bin/env bash
# Obtiene un JWT válido para usar en curl
set -euo pipefail

BASE_PATH="${PHARMACOL_BASE_PATH:-/pharmacol}"
HTTP_PORT="${PHARMACOL_HTTP_PORT:-8080}"
API="${PHARMACOL_API_LOCAL:-${PHARMACOL_API:-http://127.0.0.1:${HTTP_PORT}${BASE_PATH}/v1}}"
EMAIL="${PHARMACOL_EMAIL:-admin@pharmacol.co}"
PASSWORD="${PHARMACOL_PASSWORD:-admin123}"

TOKEN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

echo "$TOKEN"
