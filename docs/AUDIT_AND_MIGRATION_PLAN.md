# Fase 1 — Informe de Auditoría Técnica PharmaCol

**Fecha:** 2026-06-08  
**Repositorio:** `/Users/anderson/Documents/pharmacol`  
**Decisión arquitectónica:** Migrar mobile de Flutter → **Expo (Expo Go)** sin eliminar código Flutter existente.

---

## 1. Estado actual

| Componente | Tecnología | Estado | Completitud |
|------------|------------|--------|-------------|
| Monorepo | pnpm + turbo | ✅ Activo | 100% |
| Base de datos | PostgreSQL 17 + Prisma (30 modelos) | ✅ Migrado + seed | 95% |
| Backend API | NestJS 11 | ✅ Core operativo | 55% |
| Mobile Flutter | `apps/mobile/` | ⚠️ MVP lib/ sin plataformas | 40% → **legacy** |
| Mobile Expo | — | ❌ No existía | 0% → **nuevo primary** |
| Admin web | — | ❌ | 0% |
| Docker prod | postgres + redis only | ⚠️ Parcial | 25% |
| CI/CD | — | ❌ | 0% |
| Tests | — | ❌ | 0% |
| OCR / IA | Schema DB only | ❌ | 10% |

---

## 2. Backend — endpoints existentes (NO romper)

```
POST /v1/auth/{register,login,refresh,logout}
GET  /v1/auth/me
GET  /v1/medicamentos/search|/:id|registro/:n|cum/:c|barcode/:c
GET  /v1/dispositivos/search|/:id|registro/:n
GET/POST/DELETE /v1/favoritos
GET  /v1/historial
GET/POST /v1/admin/sync/*
GET  /v1/health|/ready
```

**Gaps detectados:**
- Historial no se registra en búsquedas
- Sync dispositivos INVIMA no implementado
- Sin cron programado (`SYNC_CRON_*` sin usar)
- Sin módulos OCR, IA, antifalsificación
- Sin admin users/roles/audit REST
- Password reset en schema sin API

---

## 3. Mobile Flutter (`apps/mobile/`) — reutilizable

| Archivo lógica | Migrar a Expo |
|----------------|---------------|
| `lib/core/models/models.dart` | `types/index.ts` |
| `lib/core/network/dio_client.dart` | `services/api.ts` (axios) |
| `lib/features/auth/*` | `store/auth.store.ts` + `app/login.tsx` |
| `lib/features/medicamentos/*` | hooks + `(tabs)/index.tsx` |
| `lib/core/storage/hive_service.dart` | `storage/search-cache.ts` (SQLite) |

**No migrar:** Riverpod, GoRouter, Hive, Dart models generator.

**Conservar:** `apps/mobile/` intacto como referencia/legacy.

---

## 4. Referencia pharma-delivery (`../pharma-delivery`)

Reutilizable desde `apps/mobile-expo`:
- `app.config.js` + env pipeline
- `services/api.ts` patrón interceptors
- `store/auth.store.ts` + SecureStore
- `metro.config.js` monorepo
- `eas.json` + `prepare-eas-build.js`

**No portar:** delivery SQLite, socket.io, GPS, camera evidence.

---

## 5. Plan de migración Expo (Fase 2)

### Stack objetivo mobile
- React Native + **Expo SDK 54**
- **Expo Router 6**
- **TypeScript**
- **React Query** + **Zustand**
- **Axios**
- **Expo Secure Store**
- **expo-sqlite** (offline cache)

### Compatibilidad Expo Go vs Dev Build

| Funcionalidad | Expo Go | Dev Build |
|---------------|---------|-----------|
| Login, búsqueda, favoritos | ✅ | ✅ |
| Offline cache SQLite | ✅ | ✅ |
| Barcode scan | ✅ `expo-camera` | ✅ |
| OCR texto (backend) | ✅ upload imagen | ✅ |
| ML Kit on-device | ❌ | ✅ plugin nativo |
| Biometría | ⚠️ limitado | ✅ `expo-local-authentication` |

**Estrategia OCR Fase 5:** Expo Go → captura con `expo-image-picker`, envío a `POST /v1/ocr/analyze`. ML Kit on-device documentado para EAS Dev Build futuro.

---

## 6. Archivos afectados por migración

### Nuevos
```
apps/mobile-expo/**          (app Expo completa)
apps/admin/**                (dashboard React)
packages/types/**            (tipos compartidos)
infra/docker/**              (Dockerfiles, nginx)
.github/workflows/**         (CI/CD)
docs/AUDIT_AND_MIGRATION_PLAN.md
docs/EXPO_GO.md
```

### Modificados
```
package.json                 (scripts dev:mobile-expo)
pnpm-workspace.yaml          (sin cambio estructural)
docker-compose.yml           (+ backend, admin)
apps/backend/src/app.module.ts (+ ocr, ia, admin, scheduler)
apps/backend/src/modules/**  (nuevos módulos)
docs/MOBILE.md               (Expo como primary)
README.md
```

### Conservados (sin eliminar)
```
apps/mobile/**               (Flutter legacy)
apps/backend/**              (extendido, no reemplazado)
database/**                  (sin cambios breaking)
```

---

## 7. Riesgos e incompatibilidades

| Riesgo | Mitigación |
|--------|------------|
| API `/v1` vs `/api` pharma-delivery | Axios baseURL incluye `/v1` |
| Android localhost | Usar IP LAN Mac en `.env` para Expo Go |
| ML Kit en Expo Go | OCR vía backend en fase inicial |
| Flutter + Expo coexisten | Documentar; Flutter no se elimina |
| OpenAI costos | Cache Redis + feature flag |

---

## 8. Orden de implementación

1. ✅ Auditoría (este documento)
2. `apps/mobile-expo` — Expo Go MVP
3. Backend: historial, OCR, IA, antifalsificación, admin API
4. Sync: cron + dispositivos INVIMA
5. `apps/admin` — dashboard
6. Docker + nginx + CI/CD
7. Tests (objetivo 80% incremental)

---

## 9. Ejecución Expo Go desde Mac

```bash
# Terminal 1 — infra + API
cd pharmacol && docker compose up -d && pnpm dev:backend

# Terminal 2 — mobile (IP de tu Mac, no localhost en dispositivo físico)
cd apps/mobile-expo
cp .env.example .env
# EXPO_PUBLIC_API_URL=http://192.168.x.x:3000/v1
npx expo start
# Escanear QR con Expo Go (Android)
```

Emulador Android: `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/v1`
