# Generar APK Android (PharmaCol)

La URL del servidor va **embebida en la APK** — el usuario no la configura.

```
https://20.5.19.8/pharmacol/v1
```

## Requisitos

- Cuenta gratis en [expo.dev](https://expo.dev)
- Mac con Node.js y pnpm

## Generar APK

```bash
cd ~/Documents/pharmacol
git pull
pnpm install
bash scripts/build-mobile-apk.sh
```

Primera vez (login EAS):

```bash
cd apps/mobile-expo
pnpm exec eas login
pnpm exec eas init
```

Descarga el `.apk` del enlace EAS e instálalo en el Android.

## HTTPS en el servidor

La APK usa HTTPS estándar (sin certificado embebido). Para que conecte desde el móvil, el servidor debe tener un **certificado válido** (Let's Encrypt con dominio).

Si el servidor usa certificado autofirmado (solo IP), el navegador del celular puede funcionar pero **la app no** hasta instalar Let's Encrypt:

```bash
# En el servidor, con un dominio apuntando a 20.5.19.8
bash scripts/setup-letsencrypt-edge.sh tudominio.com
```

Luego rebuild APK con la nueva URL:

```bash
EXPO_PUBLIC_API_URL=https://tudominio.com/pharmacol/v1 bash scripts/build-mobile-apk.sh
```

## Login

- `admin@pharmacol.co` / `admin123`
