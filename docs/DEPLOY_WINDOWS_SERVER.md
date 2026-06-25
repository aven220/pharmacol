# PharmaCol — Despliegue servidor Windows (192.168.20.26)

Guía para dejar PharmaCol listo en el servidor de red local. Solo necesitas **Git**, **Docker Desktop** y **PowerShell**.

---

## URLs del servidor

| Recurso | URL |
|---------|-----|
| Panel web | http://192.168.20.26:3906/pharmacol/ |
| API | http://192.168.20.26:3906/pharmacol/v1 |
| Swagger | http://192.168.20.26:3906/pharmacol/docs |
| Health | http://192.168.20.26:3906/pharmacol/v1/health |

Login inicial: `admin@pharmacol.co` / `admin123`

---

## En tu Mac — subir cambios a Git

```bash
cd ~/Documents/pharmacol
git add .
git commit -m "Config despliegue Windows servidor 192.168.20.26"
git push origin main
```

---

## En el servidor Windows — primera instalación

### Requisitos

- Windows 10/11 o Windows Server
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) en ejecución
- [Git](https://git-scm.com/download/win)
- Puerto **3906** libre en el firewall (ver abajo)

### Pasos

```powershell
# 1. Clonar (o ir a la carpeta si ya existe)
cd G:\PROGRAMAS
git clone <URL-DE-TU-REPO> pharmacol
cd pharmacol

# 2. Despliegue completo (crea .env, migra, seed, build)
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-windows-server.ps1 -FirstSetup
```

Eso tarda **10–20 minutos** la primera vez (descarga imágenes + build).

### Abrir puerto en firewall Windows (si no carga desde otra PC)

```powershell
New-NetFirewallRule -DisplayName "PharmaCol Web 3906" -Direction Inbound -Protocol TCP -LocalPort 3906 -Action Allow
```

---

## Actualizar después de un `git push`

```powershell
cd G:\PROGRAMAS\pharmacol
git pull
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-windows-server.ps1
```

---

## Comandos útiles

```powershell
# Estado de contenedores
docker compose -p pharmacol -f docker-compose.prod.yml ps

# Logs en vivo
docker compose -p pharmacol -f docker-compose.prod.yml logs -f backend
docker compose -p pharmacol -f docker-compose.prod.yml logs -f web

# Reiniciar todo
docker compose -p pharmacol -f docker-compose.prod.yml restart

# Parar
docker compose -p pharmacol -f docker-compose.prod.yml down
```

---

## Problemas frecuentes

### `Authentication failed` en seed/migrate

La contraseña del volumen Postgres no coincide con `.env`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-postgres-password.ps1 -ComposeFile docker-compose.prod.yml
docker compose -p pharmacol -f docker-compose.prod.yml --profile setup run --rm seed
```

O instalación limpia (borra datos):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-windows-server.ps1 -FirstSetup -ResetDb
```

### Build falla

```powershell
docker compose -p pharmacol -f docker-compose.prod.yml build --no-cache backend web
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-windows-server.ps1
```

### Cambiar IP del servidor

Edita `.env`:

```env
PHARMACOL_SERVER_IP=192.168.20.26
PHARMACOL_PUBLIC_URL="http://192.168.20.26:3906/pharmacol"
PHARMACOL_API="http://192.168.20.26:3906/pharmacol/v1"
```

Luego:

```powershell
docker compose -p pharmacol -f docker-compose.prod.yml up -d --build web
```

### Cargar medicamentos INVIMA

Desde el panel: **Sincronización** → `INVIMA_CUM_VIGENTES` (tarda mucho la primera vez).

O desde otra máquina con pnpm: `pnpm sync:invima INVIMA_ALERTAS_PORTAL`

---

## Archivos clave

| Archivo | Función |
|---------|---------|
| `.env.server.example` | Plantilla con IP 192.168.20.26 |
| `docker-compose.prod.yml` | Producción (API + web + BD) |
| `scripts/deploy-windows-server.ps1` | Un solo comando de despliegue |

---

## Seguridad (producción real)

1. Cambia `POSTGRES_PASSWORD` en `.env` y ejecuta `fix-postgres-password.ps1`
2. Cambia `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `AES_ENCRYPTION_KEY`
3. Cambia contraseña del admin tras el primer login
4. Si expones a internet, pon HTTPS con nginx/IIS delante
