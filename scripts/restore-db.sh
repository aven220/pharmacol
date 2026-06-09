#!/usr/bin/env bash
# Restaura un dump de PostgreSQL en el contenedor pharmacol-postgres.
# Uso: bash scripts/restore-db.sh [archivo.dump|.sql|.sql.gz]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -p pharmacol -f docker-compose.prod.yml"
DUMP="${1:-infra/backups/pharmacol.dump}"

if [[ ! -f "$DUMP" ]]; then
  echo "ERROR: No existe el archivo: $DUMP"
  echo "Coloca el dump en infra/backups/ o pasa la ruta como argumento."
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "ERROR: Falta .env — copia .env.example y configura POSTGRES_PASSWORD."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

PG_PASS="${POSTGRES_PASSWORD:-pharmacol_dev}"

echo "==> Levantando PostgreSQL..."
$COMPOSE up -d postgres

echo "==> Esperando PostgreSQL..."
for i in $(seq 1 30); do
  if $COMPOSE exec -T postgres pg_isready -U pharmacol -d pharmacol >/dev/null 2>&1; then
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "ERROR: PostgreSQL no respondió."
    exit 1
  fi
  sleep 2
done

echo "==> Aplicando migraciones (estructura actual)..."
$COMPOSE --profile setup run --rm migrate

echo "==> Restaurando: $DUMP"
CONTAINER_DUMP=""
if [[ "$DUMP" == infra/backups/* ]] || [[ "$DUMP" == ./infra/backups/* ]]; then
  BASENAME="$(basename "$DUMP")"
  CONTAINER_DUMP="/backups/$BASENAME"
fi

case "$DUMP" in
  *.dump|*.backup|*.custom)
    if [[ -n "$CONTAINER_DUMP" ]]; then
      $COMPOSE exec -T postgres pg_restore \
        -U pharmacol -d pharmacol --clean --if-exists --no-owner --no-acl \
        "$CONTAINER_DUMP"
    else
      $COMPOSE exec -T postgres pg_restore \
        -U pharmacol -d pharmacol --clean --if-exists --no-owner --no-acl \
        < "$DUMP"
    fi
    ;;
  *.sql.gz)
    gunzip -c "$DUMP" | $COMPOSE exec -T postgres psql -U pharmacol -d pharmacol -v ON_ERROR_STOP=1
    ;;
  *.sql)
    $COMPOSE exec -T postgres psql -U pharmacol -d pharmacol -v ON_ERROR_STOP=1 < "$DUMP"
    ;;
  *)
    echo "ERROR: Extensión no reconocida. Use .dump, .sql o .sql.gz"
    exit 1
    ;;
esac

echo ""
echo "✓ Restauración completada."
echo "  Siguiente paso: bash scripts/deploy-server.sh"
echo "  (sin --first-setup si ya tienes medicamentos y usuarios)"
