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
| `INVIMA_ALERTAS_SANITARIAS` | Alertas sanitarias e informes de seguridad (farmacoepidemiología) |

---

## Alertas Sanitarias

Dos fuentes complementarias:

| Fuente | Código | Actualización | Contenido |
|--------|--------|---------------|-----------|
| **Portal INVIMA** (principal) | `INVIMA_ALERTAS_PORTAL` | 4× al día (7, 11, 15, 19h) | Alertas del día en [app.invima.gov.co/alertas](https://app.invima.gov.co/alertas) |
| **Datos.gov.co** (complemento) | `INVIMA_ALERTAS_SANITARIAS` | 1× al día (5am) | Texto detallado, consolidado mensual (puede ir con retraso) |

```bash
# Alertas de hoy (recomendado para trabajo diario)
pnpm sync:invima INVIMA_ALERTAS_PORTAL

# Texto detallado farmacovigilancia (mensual)
pnpm sync:invima INVIMA_ALERTAS_SANITARIAS
```

En el panel admin: **Alertas INVIMA → Sync portal (hoy)** o **Sync completo**.

Las alertas del portal se marcan con origen **Portal**; las de datos.gov.co con **Datos.gov**. Si la misma alerta existe en ambas, se unifica por número (ej. `184-2026`) y se conserva el PDF del portal + la descripción de datos.gov cuando esté disponible.

### Resumen diario por correo

Tras cada sync de alertas (manual o cron), se envía un resumen a **tu correo ya configurado** en PharmaCol:

1. `PHARMACOL_EMAIL` o `SEED_ADMIN_EMAIL` del `.env` (el mismo que usan `sync-invima.sh` y el login admin)
2. Si no hay variable, los usuarios con rol **ADMINISTRADOR** o **SUPERVISOR** activos en la BD
3. Opcional: `ALERTAS_DIGEST_EMAIL` para destinatarios adicionales (separados por coma)

Para envío real por correo, configura SMTP en `.env`. Sin SMTP, el resumen queda en los **logs del backend** (no se pierde la información).

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
| `SYNC_CRON_ALERTAS` | `0 5 * * *` | Alertas datos.gov (5am) |
| `SYNC_CRON_ALERTAS_PORTAL` | `0 7,11,15,19 * * *` | Portal INVIMA (4× día) |

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
| Sync muy lento | Normal la primera vez (~157.000 filas CUM vigentes en datos.gov.co) |
| Error 429 API / segunda sync FALLIDA | Agrega `INVIMA_APP_TOKEN` en `.env`, espera 15–30 min entre intentos y reinicia backend |
| Solo ~7k medicamentos | Normal: hay ~157k filas CUM pero ~7k–15k medicamentos únicos (un producto tiene varios CUM) |
| Siempre 157146 leídos, 0 insertados | Normal en re-sync: la base ya está cargada; mire omitidos altos = OK |
| PARCIAL con pocos errores | Con el fix reciente se marca COMPLETADA si hay &lt;100 errores (~22 es aceptable) |
| Segunda sync FALLIDA con pocos leídos | Límite de datos.gov.co o red del servidor; ver logs del backend |
| App sin resultados | Confirma sync terminó: admin → Sincronización → Historial |
| Redis error | `docker compose up -d` |

### Diagnóstico en el servidor Windows

```powershell
cd G:\PROGRAMAS\pharmacol

# Logs del backend (busque "429", "INVIMA", "falló")
docker compose -p pharmacol -f docker-compose.prod.yml logs backend --tail 150

# Conteos en base de datos
docker compose -p pharmacol -f docker-compose.prod.yml exec postgres psql -U pharmacol -d pharmacol -c "
  SELECT COUNT(*) AS medicamentos FROM medicamentos;
  SELECT COUNT(*) AS codigos_cum FROM codigos_cum;
  SELECT status, registros_leidos, registros_insertados, registros_omitidos, metadata
  FROM sync_jobs ORDER BY created_at DESC LIMIT 5;
"
```

## Token INVIMA (opcional, gratis)

**No es obligatorio.** La API de datos.gov.co responde sin token; PharmaCol ya funcionó así antes.
El token solo evita límites (error 429) en syncs muy largas o muchos reintentos.

**No puedo darte un token** — es personal, como una contraseña. Cada usuario crea el suyo:

1. Abra [datos.gov.co](https://www.datos.gov.co/) → **Registrarse** (o iniciar sesión).
2. Icono de perfil (arriba derecha) → **Configuración de desarrollador** / *Developer settings*.
3. Sección **Application Tokens** → **Create new app token** (o copie uno existente).
4. En el servidor, archivo `G:\PROGRAMAS\pharmacol\.env`:
   ```env
   INVIMA_APP_TOKEN="pegue-aqui-el-token-largo"
   ```
5. Reinicie: `docker compose -p pharmacol -f docker-compose.prod.yml restart backend`

Si no recuerda la cuenta, cree una nueva con su correo — el token tarda 2 minutos.

---

## Si la sync no arranca o no actualiza

Causa habitual: quedó un job **EN_PROCESO** en la BD tras reiniciar Docker o cancelar.

**Opción A — Script (servidor Windows):**
```powershell
cd G:\PROGRAMAS\pharmacol
powershell -ExecutionPolicy Bypass -File .\scripts\clear-sync-stuck.ps1
```

**Opción B — Admin:** botón **Liberar syncs colgadas** → luego **Ejecutar** solo `INVIMA_CUM_VIGENTES`.

**¿Por qué ve 0 insertados?** En un re-sync es normal: los datos ya están. Mire **Leídos** (~40.000) y **Omitidos** altos = base verificada OK.

---

### Sincronización limpia (paso a paso)

1. **Reiniciar backend** si canceló o borró jobs a mitad de sync (mata procesos huérfanos):
   ```powershell
   docker compose -p pharmacol -f docker-compose.prod.yml restart backend
   ```
2. Espere 1–2 minutos hasta que no aparezcan líneas `Sync INVIMA_` en los logs.
3. Configure `INVIMA_APP_TOKEN` en `.env` si aún no lo tiene.
4. Admin → Sincronización → **solo** `INVIMA_CUM_VIGENTES` → **Ejecutar** (no Reimportar).
5. **No lance otra fuente** hasta que esta termine (~40.000 leídos en logs).
6. **No cancele ni borre** el job mientras `EN_PROCESO`.
7. Cuando termine, verifique conteos (`medicamentos` y `codigos_cum`).
8. Opcional después: `INVIMA_DISPOSITIVOS` en un segundo intento, solo.

| Error en logs | Causa | Qué hacer |
|---------------|-------|-----------|
| `No record was found for an update` | Borró el job mientras el backend seguía | `restart backend`, espere, vuelva a **Ejecutar** una sola fuente |
| Dos fuentes intercaladas en logs | Dos syncs en paralelo | Reinicie backend; una fuente a la vez |
