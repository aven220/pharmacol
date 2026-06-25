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

  # Desarrollo Mac/local: PHARMACOL_API en .env (ej. http://localhost:3905/v1)
  if [[ -n "${PHARMACOL_API:-}" && ( "$PHARMACOL_API" == *"localhost"* || "$PHARMACOL_API" == *"127.0.0.1"* ) ]]; then
    echo "$PHARMACOL_API"
    return
  fi

  # API_PORT sin nginx (nest directo en dev)
  if [[ -n "${API_PORT:-}" && "${NODE_ENV:-}" == "development" ]]; then
    echo "http://127.0.0.1:${API_PORT}/v1"
    return
  fi

  local base_path="${PHARMACOL_BASE_PATH:-/pharmacol}"
  local http_port="${PHARMACOL_HTTP_PORT:-3906}"
  local expected="http://127.0.0.1:${http_port}${base_path}/v1"

  if [[ -n "${PHARMACOL_API_LOCAL:-}" && "$PHARMACOL_API_LOCAL" == *"${base_path}/v1"* ]]; then
    echo "$PHARMACOL_API_LOCAL"
  else
    echo "$expected"
  fi
}
