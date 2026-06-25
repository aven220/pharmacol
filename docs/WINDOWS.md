# PharmaCol — instalación en Windows (PowerShell)

Guía para servidor o PC con **Windows 10/11** o **Windows Server**.

---

## Requisitos

1. [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) (con WSL2 o motor Linux)
2. [Node.js 20 LTS](https://nodejs.org/) (solo si vas a correr backend/admin en modo desarrollo en el host)
3. [Git for Windows](https://git-scm.com/download/win) (opcional, para `git pull`)

---

## Error frecuente: `pnpm no se reconoce`

PharmaCol usa **pnpm**, no npm directo. Tienes dos caminos:

### Opción A — Solo Docker (recomendado en servidor Windows)

No necesitas instalar pnpm para migrar la base de datos.

### Opción B — Instalar pnpm (desarrollo local)

En PowerShell **como administrador** (una sola vez):

```powershell
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm -v
```

Si `corepack` falla:

```powershell
npm install -g pnpm@9.15.0
pnpm -v
```

Luego en la carpeta del proyecto:

```powershell
cd G:\PROGRAMAS\pharmacol
pnpm install
```

---

## Comandos: npm vs pnpm

| Incorrecto | Correcto |
|------------|----------|
| `npm db:migrate` | `npm run db:migrate` o `pnpm db:migrate` |
| `npm dev:backend` | `npm run dev:backend` o `pnpm dev:backend` |

Los scripts del `package.json` llaman internamente a **pnpm**. Sin pnpm instalado, `npm run db:migrate` también fallará.

---

## Instalación rápida (servidor Windows — producción con Docker)

```powershell
cd G:\PROGRAMAS\pharmacol

# 1. Configuración
copy .env.server.example .env
notepad .env
# Edita: POSTGRES_PASSWORD, JWT_*, AES_ENCRYPTION_KEY, PHARMACOL_SERVER_IP

# 2. Base de datos (ya tienes postgres + redis)
docker compose up -d

# 3. Migraciones y datos iniciales SIN pnpm
docker compose --profile setup run --rm migrate
docker compose --profile setup run --rm seed

# 4. Levantar API + panel web (producción)
docker compose -f docker-compose.prod.yml up -d --build

# 5. Verificar
curl http://127.0.0.1:3906/pharmacol/v1/health
```

Acceso: `http://TU-IP:3906/pharmacol/` o detrás de tu IIS/nginx en `/pharmacol/`.

---

## Instalación desarrollo (backend + admin en el host)

```powershell
cd G:\PROGRAMAS\pharmacol

corepack enable
corepack prepare pnpm@9.15.0 --activate

copy .env.example .env
notepad .env

docker compose up -d

docker compose --profile setup run --rm migrate
docker compose --profile setup run --rm seed

pnpm install

# Terminal 1
pnpm dev:backend

# Terminal 2
pnpm dev:admin
```

- API: http://localhost:3905/v1  
- Admin: http://localhost:3907  

---

## Script automático

```powershell
cd G:\PROGRAMAS\pharmacol
powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
```

Parámetros:

```powershell
# Solo BD + migraciones (sin pnpm)
.\scripts\setup-windows.ps1 -DockerOnly

# Desarrollo completo (instala pnpm si falta)
.\scripts\setup-windows.ps1 -Dev
```

---

## Problemas comunes

### Error de contraseña PostgreSQL (`Authentication failed`)

La contraseña del **volumen** de Postgres se fija solo la **primera vez**. Si cambiaste `POSTGRES_PASSWORD` en `.env` después, hay desfase.

**Opción 1 — Alinear contraseña (conserva datos):**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-postgres-password.ps1
docker compose --profile setup run --rm seed
```

**Opción 2 — Instalación limpia (borra todos los datos):**

```powershell
docker compose down -v
docker compose up -d
docker compose --profile setup run --rm migrate
docker compose --profile setup run --rm seed
```

Comprueba que en `.env` coincidan:

```
POSTGRES_PASSWORD=la_misma_en_ambos
DATABASE_URL="postgresql://pharmacol:la_misma_en_ambos@localhost:5543/pharmacol?schema=public"
```

### `pnpm` no se reconoce

Instala pnpm (ver arriba) o usa migraciones Docker:

```powershell
docker compose --profile setup run --rm migrate
```

### Puerto 5543 o 6391 en uso

En `.env` cambia `POSTGRES_HOST_PORT` y `REDIS_HOST_PORT`, luego:

```powershell
docker compose down
docker compose up -d
```

### Error de contraseña PostgreSQL

Alinea `POSTGRES_PASSWORD` en `.env` con el volumen Docker. Si es instalación nueva:

```powershell
docker compose down -v
docker compose up -d
docker compose --profile setup run --rm migrate
docker compose --profile setup run --rm seed
```

> `down -v` borra los datos de la base de datos.

### Scripts `.sh` no corren en Windows

Usa los equivalentes Docker o PowerShell:

| Linux/Mac | Windows |
|-----------|---------|
| `pnpm db:migrate` | `docker compose --profile setup run --rm migrate` |
| `pnpm db:seed` | `docker compose --profile setup run --rm seed` |
| `bash scripts/deploy-server.sh` | `docker compose -f docker-compose.prod.yml up -d --build` + migrate/seed arriba |

---

## Actualizar desde Git

```powershell
cd G:\PROGRAMAS\pharmacol
git pull

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml --profile setup run --rm migrate
```

---

## Credenciales por defecto

Tras el seed: `admin@pharmacol.co` / `admin123` (cámbialas en producción).
