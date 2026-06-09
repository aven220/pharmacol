#!/usr/bin/env bash
# Instala nginx HTTPS (:443) para PharmaCol — dominio o IP
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="ip"
DOMAIN=""
IP="20.5.19.8"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

IP="${PHARMACOL_SERVER_IP:-${PHARMACOL_HOST:-20.5.19.8}}"
DOMAIN="${PHARMACOL_DOMAIN:-}"

# Si el "dominio" es una IP, usar plantilla IP
if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || [[ "${PHARMACOL_USE_IP:-}" == "1" ]]; then
  MODE="ip"
  IP="$DOMAIN"
  [[ -z "$IP" || "$IP" == "pharmacol.tudominio.com" ]] && IP="20.5.19.8"
else
  MODE="domain"
  DOMAIN="${DOMAIN:-pharmacol.tudominio.com}"
fi

TARGET="/etc/nginx/sites-available/pharmacol"
ENABLED="/etc/nginx/sites-enabled/pharmacol"
MAP_SNIPPET="$ROOT/infra/nginx/http-upgrade-map.conf"
NGINX_CONF="/etc/nginx/nginx.conf"

TMP="$(mktemp)"

if [[ "$MODE" == "ip" ]]; then
  echo "==> Nginx HTTPS por IP: ${IP}"
  sed "s/20.5.19.8/${IP}/g" "$ROOT/infra/nginx/host-443-ip.conf" > "$TMP"

  SSL_DIR="${PHARMACOL_SSL_DIR:-/etc/nginx/ssl/pharmacol-ip}"
  if [[ ! -f "${SSL_DIR}/fullchain.pem" ]]; then
    echo "ERROR: Falta certificado autofirmado. Ejecuta primero:"
    echo "  PHARMACOL_SERVER_IP=${IP} bash scripts/generate-selfsigned-ip.sh"
    rm -f "$TMP"
    exit 1
  fi
else
  echo "==> Nginx HTTPS por dominio: ${DOMAIN}"
  sed "s/pharmacol.tudominio.com/${DOMAIN}/g" "$ROOT/infra/nginx/host-443.example.conf" > "$TMP"

  if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
    echo "⚠ Certificado Let's Encrypt no encontrado. Ejecuta:"
    echo "  sudo certbot certonly --nginx -d ${DOMAIN}"
  fi
fi

sudo cp "$TMP" "$TARGET"
rm -f "$TMP"
sudo ln -sf "$TARGET" "$ENABLED"

if ! grep -q 'connection_upgrade' "$NGINX_CONF" 2>/dev/null; then
  echo ""
  echo "⚠ Añade en /etc/nginx/nginx.conf dentro de http { }:"
  cat "$MAP_SNIPPET"
  echo ""
fi

sudo nginx -t
sudo systemctl reload nginx

if [[ "$MODE" == "ip" ]]; then
  echo ""
  echo "✓ https://${IP}/ → 127.0.0.1:8080"
  echo "  (El navegador avisará certificado no confiable — es normal con IP.)"
else
  echo ""
  echo "✓ https://${DOMAIN}/ → 127.0.0.1:8080"
fi
