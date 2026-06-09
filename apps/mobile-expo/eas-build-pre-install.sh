#!/usr/bin/env bash
# EAS Build — pnpm hoisted + install en monorepo
set -euo pipefail

echo "==> eas-build-pre-install: pnpm hoisted para Expo"
npm install -g pnpm@9.15.0

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
pnpm install --frozen-lockfile
