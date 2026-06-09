#!/usr/bin/env bash
# Copia certificado SSL del servidor para Dev Build móvil
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/apps/mobile-expo/certs/server.pem"
HOST="${PHARMACOL_SERVER:-aven220@20.5.19.8}"
REMOTE="${PHARMACOL_SERVER_CERT_PATH:-~/pharma-delivery/infra/ssl/fullchain.pem}"

mkdir -p "$(dirname "$DEST")"

echo "==> Copiar certificado SSL"
echo "    Origen: ${HOST}:${REMOTE}"
echo "    Destino: ${DEST}"
echo ""

scp "${HOST}:${REMOTE}" "$DEST"

echo "✓ Certificado listo."
echo ""
echo "Siguiente paso (Android, teléfono con USB):"
echo "  cd apps/mobile-expo"
echo "  npx expo prebuild --clean"
echo "  npx expo run:android"
