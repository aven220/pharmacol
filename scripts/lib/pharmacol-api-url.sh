#!/usr/bin/env bash
# Resuelve PHARMACOL_API_LOCAL ignorando valores viejos sin subpath (/pharmacol)
pharmacol_load_env() {
  local root="${1:-.}"
  if [[ -f "$root/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$root/.env"
    set +a
  fi
}

pharmacol_resolve_api_local() {
  local root="${1:-.}"
  pharmacol_load_env "$root"

  local base_path="${PHARMACOL_BASE_PATH:-/pharmacol}"
  local http_port="${PHARMACOL_HTTP_PORT:-8080}"
  local expected="http://127.0.0.1:${http_port}${base_path}/v1"

  if [[ -n "${PHARMACOL_API_LOCAL:-}" && "$PHARMACOL_API_LOCAL" == *"${base_path}/v1"* ]]; then
    echo "$PHARMACOL_API_LOCAL"
  else
    echo "$expected"
  fi
}
