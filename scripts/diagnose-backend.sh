#!/usr/bin/env bash
# Diagnóstico rápido cuando pharmacol-backend está unhealthy
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -p pharmacol -f docker-compose.prod.yml"
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "=== PharmaCol — diagnóstico backend ==="
echo ""

# 1. .env
if [[ ! -f .env ]]; then
  echo -e "${RED}✗ Falta .env${NC} — cp .env.server.example .env"
  exit 1
fi
echo -e "${GREEN}✓${NC} .env existe"

set -a
# shellcheck disable=SC1091
source .env
set +a

missing=0
for var in POSTGRES_PASSWORD JWT_ACCESS_SECRET JWT_REFRESH_SECRET; do
  if [[ -z "${!var:-}" ]]; then
    echo -e "${RED}✗ $var está vacío en .env${NC}"
    missing=1
  else
    echo -e "${GREEN}✓${NC} $var configurado"
  fi
done
[[ "$missing" -eq 1 ]] && echo "" && echo "Completa las variables en .env y vuelve a intentar."

# 2. Postgres password
echo ""
echo "→ Probando contraseña PostgreSQL..."
if $COMPOSE exec -T postgres psql -U pharmacol -d pharmacol -c "SELECT 1" >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Postgres acepta POSTGRES_PASSWORD del .env"
else
  echo -e "${RED}✗ Contraseña Postgres NO coincide con .env${NC}"
  echo "  El volumen se creó con otra clave. Opciones:"
  echo "  A) Ajusta POSTGRES_PASSWORD en .env a la clave original (pharmacol_dev si nunca la cambiaste)"
  echo "  B) Cambia la clave en Postgres:"
  echo "     docker exec -it pharmacol-postgres psql -U pharmacol -d pharmacol \\"
  echo "       -c \"ALTER USER pharmacol PASSWORD 'TU_CLAVE_DEL_ENV';\""
fi

# 3. Logs backend
echo ""
echo "→ Últimas líneas del backend:"
$COMPOSE logs backend --tail 30 2>/dev/null || docker logs pharmacol-backend --tail 30 2>/dev/null || true

# 4. Health
echo ""
echo "→ Health check:"
if curl -sf -m 5 "http://localhost:${API_PORT:-3005}/v1/health" 2>/dev/null; then
  echo ""
  echo -e "${GREEN}✓ API responde${NC}"
else
  echo -e "${RED}✗ API no responde en :${API_PORT:-3005}${NC}"
fi

echo ""
echo "=== Fin diagnóstico ==="
