# PharmaCol

Plataforma farmacéutica profesional para Colombia — consulta INVIMA, alertas sanitarias, OCR, IA y detección de falsificaciones.

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | NestJS, Prisma, PostgreSQL, Redis, BullMQ |
| Mobile | Expo (React Native) |
| Admin web | React + Vite |
| Infra | Docker, Nginx |

---

## Mapa de puertos (evita conflictos con 4000, 4401, 8080…)

| Servicio | Variable | Puerto por defecto | Uso |
|----------|----------|-------------------|-----|
| API NestJS | `API_PORT` | **3905** | Backend directo (dev Mac) |
| Admin Vite (dev) | `ADMIN_PORT` | **3907** | Panel web en desarrollo |
| Nginx Docker (servidor) | `PHARMACOL_HTTP_PORT` | **3906** | Gateway interno → `/pharmacol/` |
| PostgreSQL (host) | `POSTGRES_HOST_PORT` | **5543** | Solo localhost |
| Redis (host) | `REDIS_HOST_PORT` | **6391** | Solo localhost |

En **producción**, el acceso público suele ser `https://TU-IP/pharmacol/` (Nginx del servidor → `127.0.0.1:3906`). La API no se expone directamente a internet.

---

## Instalación en Windows (servidor o PC)

Ver guía completa: **[docs/WINDOWS.md](docs/WINDOWS.md)**

Resumen en PowerShell (`G:\PROGRAMAS\pharmacol`):

```powershell
docker compose up -d

# Migrar y seed SIN instalar pnpm:
docker compose --profile setup run --rm migrate
docker compose --profile setup run --rm seed

# Producción (API + panel web en Docker):
docker compose -f docker-compose.prod.yml up -d --build
```

Si quieres `pnpm dev:backend` en el host, instala pnpm primero:

```powershell
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
pnpm dev:backend
```

O usa el script: `powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1 -Dev`

---

## 1. Instalación en Mac (desarrollo)

### Requisitos

- Node.js ≥ 20, pnpm ≥ 9
- Docker Desktop
- Git

### Pasos

```bash
cd ~/Documents/pharmacol   # o tu ruta del proyecto

pnpm install
cp .env.example .env       # revisa puertos y contraseñas
docker compose up -d       # PostgreSQL :5543, Redis :6391

pnpm fix:postgres-password # solo si falla login a la BD
pnpm db:migrate
pnpm db:seed
pnpm seed:fuentes

# Terminal 1 — API
pnpm dev:backend           # http://localhost:3905/v1 — Swagger /docs

# Terminal 2 — Admin web
pnpm dev:admin             # http://localhost:3907
```

### Credenciales por defecto

- Admin: `admin@pharmacol.co` / `admin123` (o las de `SEED_ADMIN_*` en `.env`)
- Restablecer: `pnpm reset:admin`

### Cargar datos INVIMA

```bash
pnpm sync:invima INVIMA_CUM_VIGENTES          # medicamentos (primera vez: largo)
pnpm sync:invima INVIMA_ALERTAS_PORTAL        # alertas del día (portal INVIMA)
pnpm sync:invima INVIMA_ALERTAS_SANITARIAS    # complemento mensual datos.gov.co
```

Ver [docs/SYNC_INVIMA.md](docs/SYNC_INVIMA.md).

### Panel admin — secciones

| Menú | Función |
|------|---------|
| **Consulta** | Búsqueda farmacéutica (INVIMA, CUM, principio activo) |
| **Alertas INVIMA** | Alertas sanitarias portal + datos.gov |
| **Sincronización** | Jobs INVIMA manuales |
| Dashboard / Usuarios / Auditoría | Administración |

---

## 2. Subir cambios desde tu Mac (Git)

```bash
cd ~/Documents/pharmacol

git status
git add .
git commit -m "Describe tu cambio"
git push origin main
```

Si usas otra rama:

```bash
git checkout -b feature/mi-cambio
git push -u origin feature/mi-cambio
# luego merge o PR en GitHub/GitLab
```

---

## 3. Instalación en servidor (producción, con otras apps)

PharmaCol está pensado para convivir en el mismo servidor (subruta `/pharmacol/`, puertos internos distintos).

### Requisitos en el servidor

- Linux (Ubuntu/Debian recomendado)
- Docker + Docker Compose
- Git
- Nginx en el host (o en otro contenedor) para HTTPS y proxy

### Primera vez en el servidor

```bash
# Clonar o actualizar
cd /opt   # o tu carpeta de apps
git clone <URL-DE-TU-REPO> pharmacol
cd pharmacol

# Configuración
cp .env.server.example .env
nano .env
# Cambiar: POSTGRES_PASSWORD, JWT_* , AES_ENCRYPTION_KEY, PHARMACOL_SERVER_IP

# Despliegue
bash scripts/setup-server-env.sh   # solo si no existe .env
bash scripts/deploy-server.sh
```

`deploy-server.sh` hace: build Docker, migraciones, seed de fuentes, sync inicial opcional.

### Actualizar después de un `git push` (Mac → servidor)

```bash
cd /opt/pharmacol
git pull origin main

docker compose -p pharmacol -f docker-compose.prod.yml up -d --build
pnpm db:migrate
pnpm seed:fuentes

# Opcional: forzar sync alertas del día
pnpm sync:invima INVIMA_ALERTAS_PORTAL
```

### Nginx del servidor (convivencia)

PharmaCol escucha en **`127.0.0.1:3906`** (contenedor `pharmacol-web`). Tu Nginx principal debe hacer proxy a esa ruta:

```nginx
location /pharmacol/ {
    proxy_pass http://127.0.0.1:3906/pharmacol/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Scripts incluidos (ajustar según tu entorno):

```bash
bash scripts/install-nginx-coexist.sh docker
bash scripts/connect-pharma-network.sh
bash scripts/patch-pharma-edge-nginx.sh
```

### Verificar que todo corre

```bash
curl http://127.0.0.1:3906/pharmacol/v1/health
curl https://TU-IP/pharmacol/v1/health
pnpm diagnose:backend
```

---

## 4. Variables de entorno importantes

| Variable | Descripción |
|----------|-------------|
| `API_PORT` | Puerto interno del backend (3905) |
| `PHARMACOL_HTTP_PORT` | Puerto del contenedor web/nginx (3906) |
| `DATABASE_URL` | Debe usar `POSTGRES_HOST_PORT` (5543) en host |
| `REDIS_URL` | Debe usar `REDIS_HOST_PORT` (6391) |
| `PHARMACOL_API` | URL pública de la API (`…/pharmacol/v1`) |
| `PHARMACOL_API_LOCAL` | URL para scripts en el servidor (`127.0.0.1:3906/…`) |
| `SYNC_CRON_ALERTAS_PORTAL` | Cron alertas portal (4× día) |

---

## 5. Estructura del proyecto

```
pharmacol/
├── apps/
│   ├── backend/       # API NestJS
│   ├── admin/         # Panel web (Consulta, Alertas, Sync)
│   └── mobile-expo/   # App móvil Expo
├── database/          # Prisma, migraciones, seeds
├── docs/              # Guías detalladas
├── infra/             # Nginx, Dockerfiles
└── scripts/           # Deploy, sync INVIMA, diagnóstico
```

---

## 6. API destacada

| Endpoint | Descripción |
|----------|-------------|
| `POST /v1/auth/login` | Login JWT |
| `GET /v1/medicamentos/search` | Búsqueda farmacéutica |
| `GET /v1/alertas-sanitarias/search` | Alertas sanitarias |
| `POST /v1/admin/sync/ejecutar-sync` | Sync INVIMA manual |

Swagger: `http://localhost:3905/docs` (dev) o `https://TU-IP/pharmacol/docs` (prod).

---

## 7. Problemas frecuentes

| Síntoma | Solución |
|---------|----------|
| `Authentication failed` PostgreSQL | `pnpm fix:postgres-password` |
| Sync no conecta a la API | Verifica `PHARMACOL_API` / `API_PORT=3905` y que el backend esté arriba |
| Puerto en uso | Cambia `API_PORT`, `POSTGRES_HOST_PORT`, etc. en `.env` |
| Prisma roto | `bash scripts/run-with-env.sh prisma generate` |
| Alertas solo de abril | Usa `INVIMA_ALERTAS_PORTAL` (portal del día) |

---

## Documentación adicional

- [Sincronización INVIMA y alertas](docs/SYNC_INVIMA.md)
- [Expo Go — móvil](docs/EXPO_GO.md)
- [SSL / móvil](docs/MOBILE_SSL.md)

---

## 8. Migrar desde puertos antiguos (Mac)

Si ya tenías PharmaCol con `3005`, `5433`, `6380` u `8080`, actualiza tu `.env`:

```bash
# En .env — valores nuevos
API_PORT=3905
ADMIN_PORT=3907
POSTGRES_HOST_PORT=5543
REDIS_HOST_PORT=6391
PHARMACOL_HTTP_PORT=3906   # solo servidor
DATABASE_URL="postgresql://pharmacol:TU_PASSWORD@localhost:5543/pharmacol?schema=public"
REDIS_URL="redis://localhost:6391"
PHARMACOL_API="http://localhost:3905/v1"
```

Luego reinicia servicios:

```bash
docker compose down
docker compose up -d
pnpm fix:postgres-password   # si cambió el mapeo de Postgres
pnpm dev:backend             # http://localhost:3905
pnpm dev:admin               # http://localhost:3907
```

Los datos de PostgreSQL se conservan en el volumen Docker; solo cambia el puerto del host.

---

## Tests

```bash
pnpm test:backend
```
