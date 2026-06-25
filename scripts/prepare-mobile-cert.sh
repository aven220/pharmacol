#!/usr/bin/env bash
# Copia certificado SSL del servidor para Dev Build móvil
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/apps/mobile-expo/certs/server.pem"
HOST="${PHARMACOL_SERVER:-aven220@20.5.19.8}"
REMOTE="${PHARMACOL_SERVER_CERT_PATH:-~/pharma-delivery/infra/ssl/fullchain.pem}"

mkdir -p "$(dirname "$DEST")"

echo "==> Certificado SSL para APK Android"
echo "    Destino: ${DEST}"
echo ""

if scp "${HOST}:${REMOTE}" "$DEST" 2>/dev/null; then
  echo "✓ Copiado desde ${HOST}:${REMOTE}"
else
  echo "→ scp no disponible; descargando certificado por HTTPS (openssl)..."
  if ! echo | openssl s_client -connect 20.5.19.8:443 -servername 20.5.19.8 -showcerts 2>/dev/null \
    | awk '/BEGIN CERTIFICATE/,/END CERTIFICATE/{print}' > "$DEST"; then
    echo "ERROR: no se pudo obtener el certificado."
    exit 1
  fi
  echo "✓ Certificado obtenido de https://20.5.19.8"
fi

openssl x509 -in "$DEST" -noout -subject -dates 2>/dev/null || true
echo ""
echo "Siguiente paso:"
echo "  bash scripts/build-mobile-apk.sh"
