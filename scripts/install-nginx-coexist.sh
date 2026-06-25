#!/usr/bin/env bash
# Instala locations /pharmacol/ para convivir con A-AS Delivery (nginx en Docker o host)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

MODE="${1:-docker}"
BASE_PATH="${PHARMACOL_BASE_PATH:-/pharmacol}"
HTTP_PORT="${PHARMACOL_HTTP_PORT:-3906}"

case "$MODE" in
  docker|host) ;;
  -h|--help)
    echo "Uso: bash scripts/install-nginx-coexist.sh [docker|host]"
    echo "  docker  — nginx de A-AS en contenedor (default, red Docker → pharmacol-web)"
    echo "  host    — nginx instalado en el servidor (usa 127.0.0.1:${HTTP_PORT})"
    exit 0
    ;;
  *)
    echo "Modo desconocido: $MODE (usa docker o host)"
    exit 1
    ;;
esac

if [[ "$MODE" == "docker" ]]; then
  SOURCE="$ROOT/infra/nginx/pharmacol-locations-docker.conf"
  TARGET="/tmp/pharmacol-locations.conf"
  PROXY_NOTE="pharmacol-web (red Docker) o 172.17.0.1:${HTTP_PORT}"
else
  SOURCE="$ROOT/infra/nginx/pharmacol-locations.conf"
  TARGET="/etc/nginx/pharmacol-locations.conf"
  PROXY_NOTE="127.0.0.1:${HTTP_PORT}"
fi

echo "==> PharmaCol + A-AS Delivery (modo: ${MODE})"
echo "    Pública: https://20.5.19.8${BASE_PATH}/"
echo "    Proxy:   ${PROXY_NOTE}"
echo ""

cp "$SOURCE" "$TARGET"
echo "✓ Plantilla copiada → ${TARGET}"
echo ""
cat "$TARGET"
echo ""
echo "════════════════════════════════════════════════════════════"

if [[ "$MODE" == "docker" ]]; then
  echo "  PASO PREVIO — conectar redes Docker:"
  echo "     bash scripts/connect-pharma-network.sh"
  echo ""
  echo "  Luego edita el archivo en el HOST (montado en pharma-edge-prod):"
  echo "     ~/pharma-delivery/infra/nginx/edge.prod.conf"
  echo "  Añade el bloque location /pharmacol/ antes de 'location / {'"
  echo "  Recarga: docker exec -u root pharma-edge-prod nginx -t && docker exec -u root pharma-edge-prod nginx -s reload"
  echo ""
  echo "1. Busca el contenedor A-AS:"
  echo "     bash scripts/find-aas-nginx.sh"
  echo "     docker ps"
  echo ""
  echo "2. Copia el bloque location de arriba al nginx de ESE contenedor."
  echo ""
  echo "3. Si la red Docker no aplica, prueba gateway → host:"
  echo "     curl http://172.17.0.1:${HTTP_PORT}/pharmacol/v1/health"
  echo ""
  echo "4. Verifica:"
  echo "     curl -k https://20.5.19.8/pharmacol/v1/health"
else
  sudo cp "$SOURCE" /etc/nginx/pharmacol-locations.conf
  echo "  Añade dentro del server { listen 443 ... } de A-AS:"
  echo "     include /etc/nginx/pharmacol-locations.conf;"
  echo "  sudo nginx -t && sudo systemctl reload nginx"
  echo ""
  echo "  Verifica:"
  echo "     curl http://127.0.0.1:${HTTP_PORT}/pharmacol/v1/health"
fi

echo "════════════════════════════════════════════════════════════"
