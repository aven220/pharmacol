#!/usr/bin/env bash
# Encuentra dónde corre nginx (host o Docker) en el servidor A-AS
set -euo pipefail

echo "=== Buscar nginx / puerto 443 ==="
echo ""

echo "→ Nginx en el host:"
if command -v nginx >/dev/null 2>&1; then
  nginx -v 2>&1 || true
  echo "  Config: /etc/nginx/"
else
  echo "  (no instalado — normal si todo va en Docker)"
fi

echo ""
echo "→ Contenedores con puerto 443 o 80:"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}' 2>/dev/null | grep -E '443|80->|NAMES' || docker ps --format 'table {{.Names}}\t{{.Ports}}'

echo ""
echo "→ Contenedores con 'nginx' en el nombre o imagen:"
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}' 2>/dev/null | grep -i nginx || echo "  (ninguno con nombre nginx)"

echo ""
echo "→ Probar gateway Docker → host (PharmaCol en :8080):"
if curl -sf -m 3 http://127.0.0.1:8080/pharmacol/v1/health >/dev/null 2>&1; then
  echo "  ✓ http://127.0.0.1:8080/pharmacol/v1/health OK (desde el host)"
else
  echo "  ✗ PharmaCol no responde en 127.0.0.1:8080 — levanta: docker compose -p pharmacol -f docker-compose.prod.yml up -d web backend"
fi

GW="${DOCKER_GATEWAY:-172.17.0.1}"
if curl -sf -m 3 "http://${GW}:8080/pharmacol/v1/health" >/dev/null 2>&1; then
  echo "  ✓ http://${GW}:8080/pharmacol/v1/health OK (como lo ve un contenedor Docker)"
else
  echo "  ⚠ http://${GW}:8080 no responde — desde contenedor usar IP del host o extra_hosts"
fi

echo ""
echo "=== Siguiente paso ==="
echo "1. Identifica el contenedor que publica :443 (A-AS Delivery)"
echo "2. Edita SU nginx y añade el bloque location /pharmacol/"
echo "3. Usa la plantilla:"
echo "     infra/nginx/pharmacol-locations-docker.conf  (nginx en Docker)"
echo "     infra/nginx/pharmacol-locations.conf         (nginx en host)"
echo ""
echo "Ejemplo — ver nginx dentro del contenedor:"
echo "  docker exec -it NOMBRE_CONTENEDOR sh"
echo "  cat /etc/nginx/conf.d/default.conf"
echo "  # o: ls /etc/nginx/"
