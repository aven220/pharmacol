#!/usr/bin/env bash
# Obtiene un JWT válido para usar en curl
set -euo pipefail

API="${PHARMACOL_API:-http://20.5.19.8:8080/v1}"
EMAIL="${PHARMACOL_EMAIL:-admin@pharmacol.co}"
PASSWORD="${PHARMACOL_PASSWORD:-admin123}"

TOKEN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

echo "$TOKEN"
