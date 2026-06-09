#!/usr/bin/env bash
# Añade PharmaCol (/pharmacol/) al nginx de pharma-edge-prod (contenedor A-AS Delivery)
# La config NO está en ~/pharmacol — vive en el contenedor pharma-edge-prod
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE="${PHARMA_EDGE_CONTAINER:-pharma-edge-prod}"
SNIPPET_SRC="$ROOT/infra/nginx/pharmacol-locations-docker.conf"
SNIPPET_DST="/etc/nginx/pharmacol-locations.conf"
DEFAULT_CONF="/etc/nginx/conf.d/default.conf"

echo "==> Parche nginx en contenedor: ${EDGE}"
echo ""

if ! docker inspect "$EDGE" >/dev/null 2>&1; then
  echo "ERROR: Contenedor ${EDGE} no existe. Ver: docker ps"
  exit 1
fi

echo "→ Volúmenes montados (config en el HOST de A-AS Delivery, si existe):"
docker inspect "$EDGE" --format '{{range .Mounts}}  {{.Source}} → {{.Destination}}{{"\n"}}{{end}}' || true
echo ""

echo "→ Probar red Docker pharmacol-web..."
if ! docker exec "$EDGE" wget -qO- http://pharmacol-web/pharmacol/v1/health >/dev/null 2>&1; then
  echo "ERROR: ${EDGE} no llega a pharmacol-web."
  echo "  bash scripts/connect-pharma-network.sh"
  exit 1
fi
echo "  ✓ pharmacol-web accesible"
echo ""

echo "→ Copiar snippet al contenedor..."
docker cp "$SNIPPET_SRC" "${EDGE}:${SNIPPET_DST}"

echo "→ Incluir snippet en ${DEFAULT_CONF} (dentro del server 443)..."
docker exec -u root "$EDGE" sh -c "
  if grep -q 'pharmacol-locations.conf' '${DEFAULT_CONF}' 2>/dev/null; then
    echo '  include ya presente'
  else
    # Insertar include tras la primera línea 'listen 443'
    sed -i '/listen 443 ssl/a\\    include ${SNIPPET_DST};' '${DEFAULT_CONF}'
    echo '  include añadido'
  fi
"

echo "→ Validar y recargar nginx..."
docker exec -u root "$EDGE" sh -c "nginx -t && nginx -s reload"

echo ""
echo "✓ Listo. Prueba:"
echo "  curl -k https://20.5.19.8/pharmacol/v1/health"
echo "  https://20.5.19.8/pharmacol/"
echo ""
echo "NOTA: Si recreas ${EDGE}, repite:"
echo "  bash scripts/connect-pharma-network.sh"
echo "  bash scripts/patch-pharma-edge-nginx.sh"
