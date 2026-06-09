#!/usr/bin/env bash
# Instala PharmaCol junto a A-AS Delivery en el mismo HTTPS :443 (ruta /pharmacol/)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SOURCE="$ROOT/infra/nginx/pharmacol-locations.conf"
TARGET="/etc/nginx/pharmacol-locations.conf"
BASE_PATH="${PHARMACOL_BASE_PATH:-/pharmacol}"

echo "==> PharmaCol — convivencia con A-AS Delivery"
echo "    Ruta pública: https://TU_IP${BASE_PATH}/"
echo ""

if [[ ! -f "$SOURCE" ]]; then
  echo "ERROR: Falta $SOURCE"
  exit 1
fi

sudo cp "$SOURCE" "$TARGET"
echo "✓ Copiado → ${TARGET}"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  PASO MANUAL — edita el nginx de A-AS Delivery"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "1. Encuentra el archivo nginx del server :443, por ejemplo:"
echo "   sudo grep -r 'A-AS Delivery' /etc/nginx/ 2>/dev/null"
echo "   sudo grep -r 'listen 443' /etc/nginx/ 2>/dev/null"
echo "   docker ps   # si nginx está en contenedor"
echo ""
echo "2. Dentro del bloque  server { listen 443 ... }  añade:"
echo ""
echo "     include ${TARGET};"
echo ""
echo "3. Valida y recarga:"
echo "     sudo nginx -t && sudo systemctl reload nginx"
echo "     # o si nginx está en Docker:"
echo "     docker exec CONTAINER_NGINX nginx -t && docker exec CONTAINER_NGINX nginx -s reload"
echo ""
echo "4. Verifica:"
echo "     curl -k https://20.5.19.8/pharmacol/v1/health"
echo "     curl -k https://20.5.19.8/   # sigue siendo A-AS Delivery"
echo "════════════════════════════════════════════════════════════"
