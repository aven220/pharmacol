#!/usr/bin/env bash
# Despliegue PharmaCol en servidor (Docker Compose prod)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -p pharmacol -f docker-compose.prod.yml"
FIRST_SETUP=false
RUN_SEED=false
RUN_SYNC=false
SKIP_SEED=false

usage() {
  cat <<EOF
Uso: bash scripts/deploy-server.sh [opciones]

Opciones:
  --first-setup   Migraciones + seed (primera instalación)
  --seed          Solo ejecutar seed
  --skip-seed     No ejecutar seed (BD ya restaurada con datos)
  --sync          Ejecutar sync INVIMA tras desplegar (largo)
  -h, --help      Ayuda

Ejemplo primera vez en servidor:
  bash scripts/deploy-server.sh --first-setup

Actualización de código:
  git pull && bash scripts/deploy-server.sh
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --first-setup) FIRST_SETUP=true; RUN_SEED=true; shift ;;
    --seed) RUN_SEED=true; shift ;;
    --skip-seed) SKIP_SEED=true; shift ;;
    --sync) RUN_SYNC=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Opción desconocida: $1"; usage; exit 1 ;;
  esac
done

if [[ ! -f .env ]]; then
  echo "ERROR: Falta .env — copia .env.example y configura contraseñas."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

API_PORT="${API_PORT:-3005}"
PHARMACOL_HTTP_PORT="${PHARMACOL_HTTP_PORT:-8080}"
PHARMACOL_HOST="${PHARMACOL_HOST:-20.5.19.8}"
PHARMACOL_PUBLIC_URL="${PHARMACOL_PUBLIC_URL:-https://${PHARMACOL_HOST}}"
PHARMACOL_API="${PHARMACOL_API:-${PHARMACOL_PUBLIC_URL}/v1}"

echo "==> PharmaCol — despliegue servidor"
echo "    API interna: :${API_PORT}  |  Portal web: :${PHARMACOL_HTTP_PORT}"
echo ""

echo "==> 1/5 PostgreSQL + Redis..."
$COMPOSE up -d postgres redis

echo "==> Esperando PostgreSQL..."
for i in $(seq 1 30); do
  if $COMPOSE exec -T postgres pg_isready -U pharmacol -d pharmacol >/dev/null 2>&1; then
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "ERROR: PostgreSQL no respondió."
    exit 1
  fi
  sleep 2
done

if $SKIP_SEED; then
  RUN_SEED=false
fi

if $FIRST_SETUP || $RUN_SEED; then
  echo "==> 2/5 Migraciones..."
  $COMPOSE --profile setup run --rm migrate

  if $RUN_SEED; then
    echo "==> 3/5 Seed (admin + roles)..."
    $COMPOSE --profile setup run --rm seed
  else
    echo "==> 3/5 Seed omitido"
  fi
else
  echo "==> 2/5 Migraciones (deploy)..."
  $COMPOSE --profile setup run --rm migrate || true
  echo "==> 3/5 Seed omitido (usa --first-setup la primera vez)"
fi

echo "==> 4/5 Build + Backend + Portal web..."
$COMPOSE up -d --build backend web

echo "==> 5/5 Verificando salud..."
sleep 5
if curl -sf "http://127.0.0.1:${PHARMACOL_HTTP_PORT}/v1/health" >/dev/null; then
  echo "    ✓ Web/API OK  http://127.0.0.1:${PHARMACOL_HTTP_PORT}/v1/health"
else
  echo "    ⚠ Web no responde aún — revisa: $COMPOSE logs web backend"
fi

if $RUN_SYNC; then
  echo ""
  echo "==> Sync INVIMA (puede tardar 20–40 min)..."
  PHARMACOL_API="$PHARMACOL_API" bash scripts/sync-invima.sh INVIMA_CUM_VIGENTES sync
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Despliegue listo"
echo "  Portal (HTTPS):  ${PHARMACOL_PUBLIC_URL}/"
echo "  API pública:     ${PHARMACOL_API}"
echo "  Swagger:         ${PHARMACOL_PUBLIC_URL}/docs"
echo "  Docker local:    http://127.0.0.1:${PHARMACOL_HTTP_PORT}/ (solo servidor)"
echo ""
echo "  Login admin por defecto (seed): admin@pharmacol.co / admin123"
echo "  Cambia la contraseña tras el primer acceso."
echo ""
if ! $RUN_SYNC; then
  echo "  Cargar medicamentos INVIMA (primera vez):"
  echo "    bash scripts/deploy-server.sh --sync"
  echo "  o Admin → Sincronización → Ejecutar"
fi
echo "════════════════════════════════════════════════════════"
