#!/usr/bin/env bash
# Genera certificado SSL autofirmado para acceso por IP (sin dominio)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

IP="${PHARMACOL_SERVER_IP:-}"
if [[ -z "$IP" && -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  IP="${PHARMACOL_SERVER_IP:-${PHARMACOL_HOST:-20.5.19.8}}"
fi
IP="${IP:-20.5.19.8}"

SSL_DIR="${PHARMACOL_SSL_DIR:-/etc/nginx/ssl/pharmacol-ip}"
DAYS="${PHARMACOL_SSL_DAYS:-825}"

echo "==> Certificado autofirmado para IP ${IP}"
echo "    Directorio: ${SSL_DIR}"

sudo mkdir -p "$SSL_DIR"

# SAN con IP (necesario para que el navegador acepte https://IP)
sudo openssl req -x509 -nodes -days "$DAYS" -newkey rsa:2048 \
  -keyout "${SSL_DIR}/privkey.pem" \
  -out "${SSL_DIR}/fullchain.pem" \
  -subj "/CN=${IP}/O=PharmaCol/C=CO" \
  -addext "subjectAltName=IP:${IP}"

sudo chmod 644 "${SSL_DIR}/fullchain.pem"
sudo chmod 600 "${SSL_DIR}/privkey.pem"

echo ""
echo "✓ Certificado creado:"
echo "  ${SSL_DIR}/fullchain.pem"
echo "  ${SSL_DIR}/privkey.pem"
echo ""
echo "Siguiente paso:"
echo "  bash scripts/install-host-nginx.sh"
