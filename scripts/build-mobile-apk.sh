#!/usr/bin/env bash
# Genera APK Android (EAS) — URL del servidor embebida en la app
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE="$ROOT/apps/mobile-expo"
PROFILE="${1:-preview}"

echo "==> PharmaCol — build APK (perfil: ${PROFILE})"
echo "    API: https://20.5.19.8/pharmacol/v1"
echo ""

CERT="$MOBILE/certs/server.pem"
if [[ ! -f "$CERT" ]]; then
  echo "→ Copiando certificado SSL del servidor..."
  bash "$ROOT/scripts/prepare-mobile-cert.sh" || true
fi
if [[ ! -f "$CERT" ]]; then
  echo "ERROR: Falta $CERT — Android no confía en HTTPS autofirmado sin este archivo."
  echo "  scp aven220@20.5.19.8:~/pharma-delivery/infra/ssl/fullchain.pem $CERT"
  exit 1
fi

cd "$ROOT"
echo "→ Dependencias..."
pnpm install

if ! git diff --quiet HEAD -- apps/mobile-expo pnpm-lock.yaml 2>/dev/null; then
  echo ""
  echo "⚠ Hay cambios sin commit en mobile-expo."
  echo "  Recomendado: git add -A && git commit -m 'fix: mobile APK build'"
  echo "  (EAS sube archivos locales, pero commit ayuda a rastrear el build)"
  echo ""
fi

if [[ ! -f "$MOBILE/assets/icon.png" ]]; then
  echo "ERROR: Falta $MOBILE/assets/icon.png"
  exit 1
fi

cd "$MOBILE"

if [[ ! -f .env.production ]]; then
  echo "EXPO_PUBLIC_API_URL=https://20.5.19.8/pharmacol/v1" > .env.production
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
echo "✓ Descarga el .apk del enlace EAS e instálalo."
echo "  Login: admin@pharmacol.co / admin123"
