#!/usr/bin/env bash
# Carga .env de la raíz del monorepo y ejecuta un comando (Prisma, seeds, etc.)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

export DATABASE_URL="${DATABASE_URL:-postgresql://pharmacol:pharmacol_dev@localhost:5433/pharmacol?schema=public}"

cd "$ROOT/database"
exec "$@"
