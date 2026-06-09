#!/usr/bin/env bash
# Añade PharmaCol (/pharmacol/) al nginx de pharma-edge-prod (A-AS Delivery)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE="${PHARMA_EDGE_CONTAINER:-pharma-edge-prod}"
SNIPPET_SRC="$ROOT/infra/nginx/pharmacol-locations-docker.conf"
DEFAULT_CONF="/etc/nginx/conf.d/default.conf"

echo "==> Parche nginx en contenedor: ${EDGE}"
echo ""

if ! docker inspect "$EDGE" >/dev/null 2>&1; then
  echo "ERROR: Contenedor ${EDGE} no existe. Ver: docker ps"
  exit 1
fi

HOST_CONF="$(docker inspect "$EDGE" --format '{{range .Mounts}}{{if eq .Destination "/etc/nginx/conf.d/default.conf"}}{{.Source}}{{end}}{{end}}')"

if [[ -n "$HOST_CONF" && -f "$HOST_CONF" ]]; then
  echo "→ Config persistente en el host:"
  echo "    ${HOST_CONF}"
  echo ""
  if grep -q 'location /pharmacol/' "$HOST_CONF"; then
    echo "  ✓ Bloque /pharmacol/ ya presente"
  else
    echo "ERROR: Falta el bloque /pharmacol/ en ${HOST_CONF}"
    echo ""
    echo "Edita ese archivo (proyecto pharma-delivery) y pega el contenido de:"
    echo "  ${SNIPPET_SRC}"
    echo ""
    echo "O copia desde el repo actualizado:"
    echo "  ~/pharma-delivery/infra/nginx/edge.prod.conf"
    exit 1
  fi
else
  echo "→ Sin volumen en host; parche temporal dentro del contenedor..."
  SNIPPET_DST="/etc/nginx/pharmacol-locations.conf"
  docker cp "$SNIPPET_SRC" "${EDGE}:${SNIPPET_DST}"
  docker exec -u root "$EDGE" sh -c "
    if grep -q 'pharmacol-locations.conf' '${DEFAULT_CONF}' 2>/dev/null; then
      echo '  include ya presente'
    else
      sed -i '/listen 443 ssl/a\\    include ${SNIPPET_DST};' '${DEFAULT_CONF}'
      echo '  include añadido'
    fi
  "
fi

echo ""
echo "→ Probar red Docker pharmacol-web..."
if ! docker exec "$EDGE" wget -qO- http://pharmacol-web/pharmacol/v1/health >/dev/null 2>&1; then
  echo "ERROR: ${EDGE} no llega a pharmacol-web."
  echo "  bash scripts/connect-pharma-network.sh"
  exit 1
fi
echo "  ✓ pharmacol-web accesible"

echo "→ Validar y recargar nginx..."
docker exec -u root "$EDGE" sh -c "nginx -t && nginx -s reload"

echo ""
echo "✓ Listo. Prueba:"
echo "  curl -k https://20.5.19.8/pharmacol/v1/health"
echo "  https://20.5.19.8/pharmacol/"
