#!/usr/bin/env bash
# Conecta pharma-edge-prod ↔ pharmacol-web en la misma red Docker
set -euo pipefail

EDGE="${PHARMA_EDGE_CONTAINER:-pharma-edge-prod}"
WEB="${PHARMACOL_WEB_CONTAINER:-pharmacol-web}"

echo "==> Conectar ${EDGE} → red de ${WEB}"

if ! docker inspect "$WEB" >/dev/null 2>&1; then
  echo "ERROR: No existe ${WEB}. Levanta PharmaCol:"
  echo "  docker compose -p pharmacol -f docker-compose.prod.yml up -d web backend"
  exit 1
fi

if ! docker inspect "$EDGE" >/dev/null 2>&1; then
  echo "ERROR: No existe ${EDGE}. Ajusta PHARMA_EDGE_CONTAINER si el nombre es otro."
  exit 1
fi

# Red principal de pharmacol-web (primera red listada)
PHARMACOL_NET="$(docker inspect "$WEB" --format '{{range $name, $cfg := .NetworkSettings.Networks}}{{$name}} {{end}}' | awk '{print $1}')"

if [[ -z "$PHARMACOL_NET" ]]; then
  echo "ERROR: ${WEB} no tiene red Docker."
  exit 1
fi

echo "    Red PharmaCol: ${PHARMACOL_NET}"

if docker inspect "$EDGE" --format '{{range $name, $cfg := .NetworkSettings.Networks}}{{$name}} {{end}}' | grep -q "${PHARMACOL_NET}"; then
  echo "    ✓ ${EDGE} ya está en ${PHARMACOL_NET}"
else
  docker network connect "$PHARMACOL_NET" "$EDGE"
  echo "    ✓ ${EDGE} conectado a ${PHARMACOL_NET}"
fi

echo ""
echo "==> Probar desde ${EDGE}:"
if docker exec "$EDGE" wget -qO- "http://${WEB}/pharmacol/v1/health" 2>/dev/null; then
  echo ""
  echo "✓ OK — usa en nginx de ${EDGE}:"
  echo "  proxy_pass http://${WEB}/pharmacol/;"
else
  echo ""
  echo "⚠ Aún no responde. Verifica:"
  echo "  curl http://127.0.0.1:8080/pharmacol/v1/health"
  echo "  docker logs ${WEB} --tail 20"
  exit 1
fi
