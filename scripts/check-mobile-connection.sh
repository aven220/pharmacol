#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")"

echo "=== PharmaCol — Diagnóstico conexión móvil ==="
echo ""

# 1. Docker
echo "1. Docker (PostgreSQL + Redis):"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q pharmacol-postgres; then
  echo "   ✓ PostgreSQL corriendo"
else
  echo "   ✗ PostgreSQL NO corriendo → docker compose up -d"
fi

# 2. Backend
echo ""
echo "2. Backend API (:3000):"
if curl -sf -m 3 http://localhost:3000/v1/health >/dev/null 2>&1; then
  echo "   ✓ Backend OK en localhost"
else
  echo "   ✗ Backend NO responde → pnpm dev:backend"
fi

# 3. LAN IP
echo ""
echo "3. IP LAN de tu Mac:"
if [ -n "$IP" ]; then
  echo "   IP: $IP"
  if curl -sf -m 3 "http://${IP}:3000/v1/health" >/dev/null 2>&1; then
    echo "   ✓ Backend accesible desde LAN (Expo Go puede conectar)"
  else
    echo "   ✗ Backend no accesible por LAN — revisa firewall de macOS"
    echo "     Preferencias → Red → Firewall → permitir Node"
  fi
else
  echo "   ✗ No se detectó IP Wi‑Fi (¿estás conectado?)"
fi

# 4. Actualizar .env mobile
echo ""
echo "4. Actualizar apps/mobile-expo/.env:"
if [ -n "$IP" ]; then
  ENV_FILE="$ROOT/apps/mobile-expo/.env"
  echo "EXPO_PUBLIC_API_URL=http://${IP}:3000/v1" > "$ENV_FILE"
  echo "   ✓ Escrito: http://${IP}:3000/v1"
  echo "   → Reinicia Expo: cd apps/mobile-expo && npx expo start --clear"
else
  echo "   (omitido — sin IP)"
fi

# 5. Seed
echo ""
echo "5. Seed (solo para login, NO para conexión):"
echo "   Si el login falla con 'credenciales inválidas':"
echo "   DATABASE_URL=... pnpm db:seed"
echo "   Credenciales: admin@pharmacol.co / admin123"

echo ""
echo "6. Prueba DESDE EL TELÉFONO (crítico):"
if [ -n "$IP" ]; then
  echo "   Abre en Chrome del Android:"
  echo "   http://${IP}:3000/v1/health"
  echo "   Si NO carga → firewall macOS bloquea tu teléfono."
  echo "   Preferencias Sistema → Red → Firewall → permitir Node.js"
fi

echo ""
echo "=== Fin diagnóstico ==="
