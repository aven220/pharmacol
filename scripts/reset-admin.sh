#!/usr/bin/env bash
# Restablece admin@pharmacol.co → admin123 (o SEED_ADMIN_* del .env)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -p pharmacol -f docker-compose.prod.yml"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

EMAIL="${SEED_ADMIN_EMAIL:-admin@pharmacol.co}"
PASSWORD="${SEED_ADMIN_PASSWORD:-admin123}"

echo "==> Restablecer usuario admin"
echo "    Email: ${EMAIL}"
echo ""

$COMPOSE --profile setup run --rm \
  -e SEED_ADMIN_EMAIL="$EMAIL" \
  -e SEED_ADMIN_PASSWORD="$PASSWORD" \
  seed

echo ""
echo "✓ Listo. Prueba login:"
echo "  curl -s -X POST http://127.0.0.1:8080/pharmacol/v1/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}'"
