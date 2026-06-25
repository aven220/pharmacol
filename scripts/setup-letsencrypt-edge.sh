#!/usr/bin/env bash
# Let's Encrypt en nginx edge (A-AS Delivery) — certificado válido para app móvil
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-admin@pharmacol.co}"
PHARMA_DELIVERY="${PHARMA_DELIVERY_DIR:-$HOME/pharma-delivery}"

if [[ -z "$DOMAIN" ]]; then
  echo "Uso: bash scripts/setup-letsencrypt-edge.sh DOMINIO [email]"
  echo "  Ej: bash scripts/setup-letsencrypt-edge.sh pharmacol.tuempresa.com"
  echo ""
  echo "Antes: registro DNS A  ${DOMAIN:-tudominio.com} → 20.5.19.8"
  exit 1
fi

if [[ ! -d "$PHARMA_DELIVERY" ]]; then
  echo "ERROR: No existe $PHARMA_DELIVERY"
  exit 1
fi

echo "==> Let's Encrypt para ${DOMAIN}"
echo "    Proyecto: ${PHARMA_DELIVERY}"
echo ""

cd "$PHARMA_DELIVERY"

echo "→ Detener edge (:80/:443)..."
docker compose -f docker-compose.prod.yml stop edge 2>/dev/null || true

echo "→ Obtener certificado..."
sudo certbot certonly --standalone -d "$DOMAIN" --agree-tos -m "$EMAIL" --non-interactive

echo "→ Copiar certs a infra/ssl..."
sudo cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" infra/ssl/fullchain.pem
sudo cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" infra/ssl/privkey.pem
sudo chown "$(whoami):$(whoami)" infra/ssl/*.pem

echo "→ Levantar edge..."
docker compose -f docker-compose.prod.yml up -d edge
docker exec -u root pharma-edge-prod nginx -t
docker exec -u root pharma-edge-prod nginx -s reload

echo ""
echo "✓ HTTPS válido:"
echo "  curl https://${DOMAIN}/pharmacol/v1/health"
echo ""
echo "Rebuild APK con:"
echo "  EXPO_PUBLIC_API_URL=https://${DOMAIN}/pharmacol/v1 bash scripts/build-mobile-apk.sh"
