#!/usr/bin/env bash
# Obtiene un JWT válido para usar en curl
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/pharmacol-api-url.sh"

API="$(pharmacol_resolve_api_local "$ROOT")"
pharmacol_load_env "$ROOT"
EMAIL="${PHARMACOL_EMAIL:-${SEED_ADMIN_EMAIL:-admin@pharmacol.co}}"
PASSWORD="${PHARMACOL_PASSWORD:-${SEED_ADMIN_PASSWORD:-admin123}}"

TOKEN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

echo "$TOKEN"
