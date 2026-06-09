# PharmaCol

Plataforma farmacéutica profesional para Colombia — consulta INVIMA, OCR, IA y detección de falsificaciones.

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | NestJS, Prisma, PostgreSQL, Redis, BullMQ |
| Mobile (primary) | **Expo Go** — React Native, Expo Router, React Query, Zustand |
| Mobile (legacy) | Flutter (`apps/mobile/`) |
| Admin | React + Vite |
| Infra | Docker, Nginx, GitHub Actions |

## Inicio rápido

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:setup
pnpm dev:backend          # http://localhost:3000/v1 — Swagger /docs
pnpm dev:mobile-expo      # Expo Go — ver docs/EXPO_GO.md
pnpm dev:admin            # http://localhost:5173
```

## Mobile con Expo Go (Android)

Ver guía completa: **[docs/EXPO_GO.md](docs/EXPO_GO.md)**

```bash
# Terminal 1 — API
pnpm dev:backend

# Terminal 2 — Expo (desde apps/mobile-expo o raíz)
npx expo start
# Escanea QR con Expo Go; usa IP LAN de tu Mac en EXPO_PUBLIC_API_URL
```

## Credenciales seed

- Admin: `admin@pharmacol.co` / `admin123`
- Demo: ver `database/prisma/seeds/demo-data.ts`

## Estructura

```
pharmacol/
├── apps/
│   ├── backend/       # NestJS API
│   ├── mobile-expo/   # App móvil principal (Expo Go)
│   ├── mobile/        # Flutter legacy (conservar)
│   └── admin/         # Dashboard administrativo
├── database/          # Prisma schema, migraciones, seeds
├── docs/              # Auditoría, Expo Go, mobile legacy
├── infra/             # Nginx, backups
└── .github/workflows/ # CI
```

## API destacada

| Endpoint | Descripción |
|----------|-------------|
| `POST /v1/auth/login` | JWT + refresh token |
| `GET /v1/medicamentos/search` | Búsqueda multi-tipo |
| `GET /v1/medicamentos/offline-pack` | Paquete offline |
| `POST /v1/ocr/analyze` | Análisis OCR |
| `POST /v1/ia/identify` | Identificación IA |
| `POST /v1/antifalsificacion/evaluar` | Detección inconsistencias |
| `GET /v1/admin/dashboard/stats` | Dashboard admin |
| `POST /v1/admin/sync/ejecutar` | Sync INVIMA (cola) |

## Producción

```bash
docker compose -f docker-compose.prod.yml up -d
# Nginx profile: docker compose -f docker-compose.prod.yml --profile production up -d
```

## Tests

```bash
pnpm test:backend
```

## Documentación

- [Auditoría y plan de migración](docs/AUDIT_AND_MIGRATION_PLAN.md)
- [Sincronización INVIMA](docs/SYNC_INVIMA.md)
- [Expo Go — desarrollo móvil](docs/EXPO_GO.md)
- [Flutter legacy](docs/MOBILE.md)
