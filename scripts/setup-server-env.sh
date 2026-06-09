#!/usr/bin/env bash
# Prepara .env de producción en el servidor (primera vez)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  echo "Ya existe .env — no se sobrescribe."
  echo "Plantilla de referencia: .env.server.example"
  exit 0
fi

if [[ ! -f .env.server.example ]]; then
  echo "ERROR: Falta .env.server.example"
  exit 1
fi

cp .env.server.example .env
echo "✓ Creado .env desde .env.server.example"
echo ""
echo "Edita al menos:"
echo "  nano .env"
echo "    PHARMACOL_SERVER_IP=20.5.19.8   (tu IP si es distinta)"
echo "    JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / AES_ENCRYPTION_KEY"
echo ""
echo "Luego:"
echo "  bash scripts/deploy-server.sh --skip-seed"
echo "  bash scripts/install-nginx-coexist.sh"
