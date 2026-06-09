#!/usr/bin/env bash
# Genera carpetas android/ e ios/ si Flutter está instalado
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v flutter >/dev/null 2>&1; then
  echo "Flutter no encontrado. Instala Flutter: https://docs.flutter.dev/get-started/install"
  exit 1
fi

if [ ! -d android ]; then
  echo "Generando proyecto Flutter (android + ios)..."
  flutter create . --org co.pharmacol --project-name pharmacol_mobile
  echo "✅ Plataformas generadas. Ejecuta: flutter pub get"
else
  echo "android/ ya existe — omitido"
fi
