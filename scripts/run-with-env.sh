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

export DATABASE_URL="${DATABASE_URL:-postgresql://pharmacol:pharmacol_dev@localhost:5543/pharmacol?schema=public}"

cd "$ROOT/database"

# Binarios del workspace raíz (evita symlink roto en database/node_modules/prisma)
export PATH="$ROOT/node_modules/.bin:$PATH"

if [ "${1:-}" = "prisma" ]; then
  exec "$ROOT/node_modules/.bin/prisma" "${@:2}"
fi

exec "$@"
