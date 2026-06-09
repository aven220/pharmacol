#!/usr/bin/env bash
# Alinea la contraseña de PostgreSQL con POSTGRES_PASSWORD del .env
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -p pharmacol -f docker-compose.prod.yml"

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

echo "==> Levantando PostgreSQL..."
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

echo "==> Actualizando contraseña del usuario pharmacol..."
if $COMPOSE exec -T postgres psql -U pharmacol -d pharmacol -c "SELECT 1" >/dev/null 2>&1; then
  $COMPOSE exec -T postgres psql -U pharmacol -d pharmacol \
    -c "ALTER USER pharmacol PASSWORD '${PASS_SQL}';"
  echo "✓ Contraseña actualizada (Postgres ya aceptaba la del .env o usaba trust local)."
else
  echo "La clave del .env no funciona. Probando con pharmacol_dev (default inicial)..."
  if PGPASSWORD=pharmacol_dev $COMPOSE exec -T -e PGPASSWORD=pharmacol_dev postgres \
    psql -U pharmacol -d pharmacol -c "ALTER USER pharmacol PASSWORD '${PASS_SQL}';" 2>/dev/null; then
    echo "✓ Contraseña cambiada de pharmacol_dev → la de tu .env"
  else
    echo "ERROR: No se pudo conectar a Postgres."
    echo "Si el volumen es nuevo, asegúrate de que POSTGRES_PASSWORD en .env"
    echo "coincida con la que se usó al crear el contenedor por primera vez."
    exit 1
  fi
fi

echo ""
echo "Siguiente paso:"
echo "  docker compose -p pharmacol -f docker-compose.prod.yml up -d backend"
echo "  curl http://localhost:3005/v1/health"
