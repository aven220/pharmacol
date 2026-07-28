# PharmaCol — Móvil APK (servidor Windows LAN)

## URL embebida en la APK

```
http://192.168.20.26:3906/pharmacol/v1
```

Celular y servidor deben estar en la **misma Wi‑Fi**.

## 1. Servidor Windows (API)

```powershell
cd G:\PROGRAMAS\pharmacol
git pull
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-windows-server.ps1
```

Probar desde el navegador del celular:

```
http://192.168.20.26:3906/pharmacol/v1/health
```

Debe responder JSON con `success: true`. Si no carga, abre el firewall de Windows al puerto **3906**.

## 2. Generar APK (en la Mac)

```bash
cd ~/Documents/pharmacol
git pull
pnpm install
cd apps/mobile-expo
pnpm exec eas login   # solo primera vez
cd ../..
pnpm mobile:apk
```

Descarga el `.apk` del enlace EAS e instálalo en el Android.

## 3. Login en la app

- Email: `admin@pharmacol.co`
- Contraseña: `admin123`

Ya **no** hay botón “Probar / Reintentar conexión”. Al pulsar **Iniciar sesión** conecta directo al servidor.

## Cambiar IP del servidor

Si la IP del Windows cambia, edita antes del build:

- `apps/mobile-expo/.env.production`
- `apps/mobile-expo/eas.json` (`EXPO_PUBLIC_API_URL`)
- `apps/mobile-expo/config/api.ts` (`DEFAULT_LAN_API_URL`)

Luego vuelve a generar la APK (`pnpm mobile:apk`).
