#!/usr/bin/env bash
# EAS prebuild — cert SSL + paths correctos en monorepo
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
node "$APP_DIR/scripts/ensure-mobile-cert.js"
