#!/usr/bin/env bash
# Instala locations /pharmacol/ para convivir con A-AS Delivery (nginx en Docker o host)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="${1:-docker}"
BASE_PATH="${PHARMACOL_BASE_PATH:-/pharmacol}"

case "$MODE" in
  docker|host) ;;
  -h|--help)
    echo "Uso: bash scripts/install-nginx-coexist.sh [docker|host]"
    echo "  docker  — nginx de A-AS en contenedor (default, usa 172.17.0.1:8080)"
    echo "  host    — nginx instalado en el servidor (usa 127.0.0.1:8080)"
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
  PROXY_NOTE="172.17.0.1:8080 (gateway Docker → host)"
else
  SOURCE="$ROOT/infra/nginx/pharmacol-locations.conf"
  TARGET="/etc/nginx/pharmacol-locations.conf"
  PROXY_NOTE="127.0.0.1:8080"
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
fi
  echo "════════════════════════════════════════════════════════════"
  echo ""
  echo "1. Busca el contenedor A-AS:"
  echo "     bash scripts/find-aas-nginx.sh"
  echo "     docker ps"
  echo ""
  echo "2. Copia el bloque location de arriba al nginx de ESE contenedor."
  echo "   Suele estar en: /etc/nginx/conf.d/default.conf"
  echo ""
  echo "3. Ejemplo — editar montando volumen o entrando al contenedor:"
  echo "     docker exec -it NOMBRE_CONTENEDOR sh"
  echo "     vi /etc/nginx/conf.d/default.conf"
  echo "     nginx -t && nginx -s reload"
  echo ""
  echo "4. Si 172.17.0.1 no funciona, prueba IP del host:"
  echo "     curl http://172.17.0.1:8080/pharmacol/v1/health"
  echo "     # cambia proxy_pass a http://20.5.19.8:8080/pharmacol/;"
  echo ""
  echo "5. Verifica:"
  echo "     curl -k https://20.5.19.8/pharmacol/v1/health"
else
  sudo cp "$SOURCE" /etc/nginx/pharmacol-locations.conf
  echo "  Añade dentro del server { listen 443 ... } de A-AS:"
  echo "     include /etc/nginx/pharmacol-locations.conf;"
  echo "  sudo nginx -t && sudo systemctl reload nginx"
fi

echo "════════════════════════════════════════════════════════════"
