# PharmaCol — Expo Go (desarrollo móvil)

App principal: `apps/mobile-expo` (React Native + Expo Router + TypeScript).

> `apps/mobile/` (Flutter) se conserva como legacy. No eliminar.

## Requisitos

- Node.js ≥ 20, pnpm ≥ 9
- Backend corriendo en `http://localhost:3000`
- App **Expo Go** instalada en tu Android (Play Store)
- Mac y teléfono en la **misma red Wi‑Fi**

## 1. Infraestructura y backend

```bash
cd /Users/anderson/Documents/pharmacol
pnpm install
docker compose up -d
pnpm db:setup          # solo la primera vez
pnpm dev:backend       # API en :3000
```

## 2. Configurar URL de la API

Copia el ejemplo y ajusta según dónde ejecutes la app:

```bash
cp apps/mobile-expo/.env.example apps/mobile-expo/.env
```

| Escenario | `EXPO_PUBLIC_API_URL` |
|-----------|------------------------|
| Simulador iOS en Mac | `http://localhost:3000/v1` |
| Emulador Android | `http://10.0.2.2:3000/v1` |
| **Dispositivo físico (Expo Go)** | `http://<IP-LAN-de-tu-Mac>:3000/v1` |

Obtén la IP de tu Mac:

```bash
ipconfig getifaddr en0
# Ejemplo: http://192.168.1.42:3000/v1
```

## 3. Iniciar Expo

```bash
cd apps/mobile-expo
npx expo start
# o desde la raíz:
pnpm dev:mobile-expo
```

En la terminal de Expo:

1. Escanea el **QR** con Expo Go (Android).
2. O pulsa `a` si usas emulador Android.

## 4. Credenciales de prueba

- Email: `admin@pharmacol.co`
- Password: `admin123`

## Funcionalidades en Expo Go

| Función | Expo Go | Notas |
|---------|---------|-------|
| Login JWT + refresh | ✅ | Secure Store |
| Búsqueda multi-tipo | ✅ | React Query |
| Detalle / favoritos | ✅ | |
| OCR (regex local + backend) | ✅ | Texto de prueba editable |
| IA + antifalsificación | ✅ | Backend local; OpenAI opcional |
| Offline (SQLite) | ✅ | Perfil → “Sincronizar paquete offline” |
| Cámara (`expo-image-picker`) | ✅ | |

## Dev Build (funciones nativas avanzadas)

Estas capacidades **no** están disponibles en Expo Go:

| Función | Motivo | Alternativa |
|---------|--------|-------------|
| ML Kit on-device | Módulo nativo Google | `npx expo prebuild` + `@react-native-ml-kit/text-recognition` |
| Escaneo QR nativo dedicado | Mejor rendimiento | `expo-camera` barcode (SDK 51+) en Dev Build |
| OCR de imagen en servidor | Requiere upload S3 | Dev Build + endpoint multipart |

### Crear Dev Build (cuando lo necesites)

```bash
cd apps/mobile-expo
npx expo install expo-dev-client
npx expo prebuild
npx expo run:android
```

Documentar credenciales EAS en `eas.json` para builds de equipo.

## Solución de problemas

**“Network Error” en dispositivo físico**  
→ Verifica `EXPO_PUBLIC_API_URL` con IP LAN, no `localhost`.

**Backend no responde**  
→ `curl http://localhost:3000/v1/health`

**Metro no resuelve módulos en monorepo**  
→ `metro.config.js` ya incluye `watchFolders` del monorepo.

**CORS**  
→ Backend permite `*` en desarrollo (`CORS_ORIGINS` en `.env`).

## Stack móvil

- Expo SDK 54, Expo Router 6
- React Query, Zustand, Axios
- expo-secure-store, expo-sqlite, expo-image-picker
- TypeScript estricto
