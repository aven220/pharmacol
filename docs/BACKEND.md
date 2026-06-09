# Fase 3 — Backend NestJS

## Inicio rápido

```bash
# Desde la raíz del monorepo
docker compose up -d          # PostgreSQL + Redis
pnpm install
pnpm dev:backend
```

- **API:** http://localhost:3000/v1
- **Swagger:** http://localhost:3000/docs
- **Health:** http://localhost:3000/v1/health

## Autenticación

```bash
# Login
TOKEN=$(bash scripts/get-admin-token.sh)
curl -X POST http://localhost:3000/v1/admin/sync/ejecutar-sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fuenteCodigo":"INVIMA_CUM_VIGENTES"}'
```

## Módulos implementados

| Módulo | Rutas | Permiso |
|--------|-------|---------|
| Auth | `/v1/auth/*` | Público (login/register) |
| Medicamentos | `/v1/medicamentos/*` | `medicamentos:read` |
| Dispositivos | `/v1/dispositivos/*` | `dispositivos:read` |
| Favoritos | `/v1/favoritos/*` | `favoritos:manage` |
| Historial | `/v1/historial/*` | `historial:own` |
| Sync INVIMA | `/v1/admin/sync/*` | `sync:execute`, `sync:view` |
| Health | `/v1/health/*` | Público |

## Sync INVIMA

```bash
# Síncrono (desarrollo)
curl -X POST http://localhost:3000/v1/admin/sync/ejecutar-sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fuenteCodigo":"INVIMA_CUM_VIGENTES"}'

# Asíncrono via BullMQ
curl -X POST http://localhost:3000/v1/admin/sync/ejecutar \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fuenteCodigo":"INVIMA_CUM_VIGENTES"}'
```

## Variables de entorno

Ver `.env.example` en la raíz del monorepo.
