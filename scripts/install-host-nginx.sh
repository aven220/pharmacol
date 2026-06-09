#!/usr/bin/env bash
# Instala el virtual host nginx (HTTPS :443) para PharmaCol en el servidor host
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DOMAIN="${PHARMACOL_DOMAIN:-}"
if [[ -z "$DOMAIN" && -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  DOMAIN="${PHARMACOL_DOMAIN:-}"
fi

if [[ -z "$DOMAIN" ]]; then
  echo "ERROR: Define PHARMACOL_DOMAIN en .env o como variable de entorno."
  echo "  PHARMACOL_DOMAIN=pharmacol.midominio.com bash scripts/install-host-nginx.sh"
  exit 1
fi

TEMPLATE="$ROOT/infra/nginx/host-443.example.conf"
TARGET="/etc/nginx/sites-available/pharmacol"
ENABLED="/etc/nginx/sites-enabled/pharmacol"
MAP_SNIPPET="$ROOT/infra/nginx/http-upgrade-map.conf"
NGINX_CONF="/etc/nginx/nginx.conf"

echo "==> PharmaCol — nginx host para ${DOMAIN}"

TMP="$(mktemp)"
sed "s/pharmacol.tudominio.com/${DOMAIN}/g" "$TEMPLATE" > "$TMP"

echo "==> Escribiendo ${TARGET} (requiere sudo)..."
sudo cp "$TMP" "$TARGET"
rm -f "$TMP"

sudo ln -sf "$TARGET" "$ENABLED"

if ! grep -q 'connection_upgrade' "$NGINX_CONF" 2>/dev/null; then
  echo ""
  echo "⚠ Falta el map WebSocket en nginx.conf."
  echo "  Añade dentro de http { } el contenido de:"
  echo "  ${MAP_SNIPPET}"
  echo ""
fi

if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  echo "==> Certificado SSL no encontrado. Ejecuta:"
  echo "  sudo certbot certonly --nginx -d ${DOMAIN}"
  echo ""
fi

echo "==> Validando nginx..."
sudo nginx -t

echo "==> Recargando nginx..."
sudo systemctl reload nginx

echo ""
echo "✓ Nginx configurado para https://${DOMAIN}/"
echo "  Proxy → http://127.0.0.1:8080"
echo ""
echo "Verifica:"
echo "  curl -k https://${DOMAIN}/v1/health"
echo "  curl http://127.0.0.1:8080/v1/health   # en el servidor"
