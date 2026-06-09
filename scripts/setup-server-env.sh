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
echo "    PHARMACOL_DOMAIN=tu-subdominio.real.com"
echo "    PHARMACOL_PUBLIC_URL=https://tu-subdominio.real.com"
echo "    PHARMACOL_API=https://tu-subdominio.real.com/v1"
echo "    JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / AES_ENCRYPTION_KEY"
echo ""
echo "Luego:"
echo "  bash scripts/deploy-server.sh --skip-seed"
echo "  PHARMACOL_DOMAIN=tu-subdominio.real.com bash scripts/install-host-nginx.sh"
