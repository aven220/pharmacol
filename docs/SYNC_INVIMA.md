# Sincronización INVIMA — Cómo cargar datos reales

Los datos oficiales vienen de **Datos Abiertos Colombia** (API Socrata / INVIMA) y se guardan en PostgreSQL. La app móvil los consulta vía backend — **no descarga INVIMA directamente**.

## Requisitos

```bash
docker compose up -d          # PostgreSQL + Redis
pnpm dev:backend              # API en :3000
```

Opcional en `.env`:
```bash
INVIMA_APP_TOKEN=""   # Token de datos.gov.co — mejora límites de API
```

Regístrate en https://www.datos.gov.co/profile/edit/developer para obtener el token.

---

## Opción 1 — Script rápido (recomendado)

```bash
# Medicamentos vigentes (primera vez: 5–30 min según red)
pnpm sync:invima

# Dispositivos médicos
pnpm sync:invima INVIMA_DISPOSITIVOS

# Medicamentos vencidos
pnpm sync:invima INVIMA_CUM_VENCIDOS
```

---

## Opción 2 — Panel admin

```bash
pnpm dev:admin    # http://localhost:5173
```

1. Login: `admin@pharmacol.co` / `admin123`
2. Menú **Sincronización**
3. Pulsa **Ejecutar** en la fuente deseada

---

## Opción 3 — Swagger / curl

Abre http://localhost:3000/docs → **Sincronización INVIMA** → `POST /v1/admin/sync/ejecutar-sync`

Body:
```json
{ "fuenteCodigo": "INVIMA_CUM_VIGENTES" }
```

---

## Fuentes disponibles

| Código | Contenido |
|--------|-----------|
| `INVIMA_CUM_VIGENTES` | Medicamentos con registro vigente + CUM |
| `INVIMA_CUM_VENCIDOS` | Medicamentos vencidos |
| `INVIMA_DISPOSITIVOS` | Dispositivos médicos |

---

## Después del sync — App móvil

1. **Búsqueda en línea:** pestaña Consulta → busca por nombre, INVIMA, CUM, etc.
2. **Modo offline:** Perfil → **Sincronizar paquete offline** (cachea los primeros 500 vigentes en el teléfono)

---

## Sync automático (cron)

Con el backend corriendo, se programa solo:

| Variable | Default | Fuente |
|----------|---------|--------|
| `SYNC_CRON_CUM` | `0 3 * * *` | CUM vigentes (3am) |
| `SYNC_CRON_DM` | `0 4 * * *` | Dispositivos (4am) |

---

## Verificar datos cargados

```bash
pnpm db:studio
```

Tablas: `medicamentos`, `codigos_cum`, `registros_invima`, `sync_jobs`.

O en Swagger: `GET /v1/medicamentos/search?q=acetaminofen`

---

## Datos demo vs INVIMA real

| Origen | Cuándo |
|--------|--------|
| **Seed** (`pnpm db:seed`) | 3 medicamentos de prueba (ALERCET, etc.) |
| **Sync INVIMA** | Base completa oficial de datos.gov.co |

El seed **no** reemplaza al sync. Para producción usa solo datos del sync.

---

## Problemas frecuentes

| Síntoma | Solución |
|---------|----------|
| Sync muy lento | Normal la primera vez (~40k+ registros CUM) |
| Error 429 API | Agrega `INVIMA_APP_TOKEN` en `.env` |
| App sin resultados | Confirma sync terminó: admin → Sincronización → Historial |
| Redis error | `docker compose up -d` |
