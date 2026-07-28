#!/usr/bin/env bash
# Genera APK Android (EAS) — apunta al servidor LAN 192.168.20.26:3906
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE="$ROOT/apps/mobile-expo"
PROFILE="${1:-preview}"
API_URL="${EXPO_PUBLIC_API_URL:-http://192.168.20.26:3906/pharmacol/v1}"

echo "==> PharmaCol — build APK (perfil: ${PROFILE})"
echo "    API: ${API_URL}"
echo ""

cd "$ROOT"
echo "→ Dependencias..."
pnpm install

if [[ ! -f "$MOBILE/assets/icon.png" ]]; then
  echo "ERROR: Falta $MOBILE/assets/icon.png"
  exit 1
fi

cd "$MOBILE"

# Embebe URL del servidor Windows LAN
echo "EXPO_PUBLIC_API_URL=${API_URL}" > .env.production
export EXPO_PUBLIC_API_URL="$API_URL"
export PHARMACOL_SERVER_HOST="${PHARMACOL_SERVER_HOST:-192.168.20.26}"

# Certificado SSL opcional (solo si usas HTTPS autofirmado)
CERT="$MOBILE/certs/server.pem"
if [[ ! -f "$CERT" ]]; then
  echo "→ (opcional) Sin certs/server.pem — OK para HTTP LAN"
fi

EAS=(pnpm exec eas)

echo "→ Iniciando EAS Build (APK)..."
echo "   Primera vez: pnpm exec eas login && pnpm exec eas init"
echo ""

if [[ "${BUILD_LOCAL:-}" == "1" ]]; then
  "${EAS[@]}" build --platform android --profile "$PROFILE" --local --clear-cache --non-interactive
else
  "${EAS[@]}" build --platform android --profile "$PROFILE" --clear-cache --non-interactive
fi

echo ""
echo "✓ Descarga el .apk del enlace EAS e instálalo en el celular."
echo "  Requisitos: celular y servidor en la MISMA Wi‑Fi (192.168.20.x)"
echo "  Login: admin@pharmacol.co / admin123"
echo "  API embebida: ${API_URL}"
