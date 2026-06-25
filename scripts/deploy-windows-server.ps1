# PharmaCol - despliegue en servidor Windows (192.168.20.26)
# Primera vez:  .\scripts\deploy-windows-server.ps1 -FirstSetup
# Actualizar:   git pull; .\scripts\deploy-windows-server.ps1
param(
    [switch]$FirstSetup,
    [switch]$Seed,
    [switch]$SkipBuild,
    [switch]$ResetDb
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $Root "..")

$Compose = "docker compose -p pharmacol -f docker-compose.prod.yml"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Get-EnvValue {
    param([string]$Name)
    if (-not (Test-Path .env)) { return $null }
    foreach ($line in Get-Content .env) {
        if ($line -match ('^\s*' + $Name + '\s*=\s*(.+)\s*$')) {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return $null
}

function Wait-Postgres {
    Write-Step "Esperando PostgreSQL..."
    for ($i = 0; $i -lt 45; $i++) {
        Invoke-Expression "$Compose exec -T postgres pg_isready -U pharmacol -d pharmacol" 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Sync-PostgresPassword {
    $pass = Get-EnvValue "POSTGRES_PASSWORD"
    if (-not $pass) {
        Write-Host "ERROR: POSTGRES_PASSWORD vacio en .env" -ForegroundColor Red
        exit 1
    }
    $passSql = $pass -replace "'", "''"
    $sql = "ALTER USER pharmacol PASSWORD '$passSql';"
    $candidates = @($pass, "pharmacol_dev", "PharmaCol_Dev_2026!")
    foreach ($try in ($candidates | Select-Object -Unique)) {
        $cmd = "$Compose exec -T -e PGPASSWORD=$try postgres psql -U pharmacol -d pharmacol -c ""$sql"""
        Invoke-Expression $cmd 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    [OK] Contrasena PostgreSQL alineada con .env" -ForegroundColor Green
            return
        }
    }
    Write-Host "    [WARN] No se pudo alinear contrasena" -ForegroundColor Yellow
}

Write-Host "========================================================" -ForegroundColor Green
Write-Host "  PharmaCol - despliegue Windows" -ForegroundColor Green
Write-Host "  Ruta: $(Get-Location)" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Docker no esta instalado o no esta en el PATH." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path .env)) {
    if (-not (Test-Path .env.server.example)) {
        Write-Host "ERROR: Falta .env y .env.server.example" -ForegroundColor Red
        exit 1
    }
    Copy-Item .env.server.example .env
    Write-Host "[OK] Creado .env desde .env.server.example" -ForegroundColor Yellow
}

if ($ResetDb) {
    Write-Step "Reinicio de base de datos - BORRA TODOS LOS DATOS"
    Invoke-Expression "$Compose down -v"
}

Write-Step "1/5 PostgreSQL + Redis"
Invoke-Expression "$Compose up -d postgres redis"

if (-not (Wait-Postgres)) {
    Write-Host "ERROR: PostgreSQL no respondio." -ForegroundColor Red
    exit 1
}

Sync-PostgresPassword

Write-Step "2/5 Migraciones"
Invoke-Expression "$Compose --profile setup run --rm migrate"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($FirstSetup -or $Seed) {
    Write-Step '3/5 Seed - admin roles y fuentes'
    Invoke-Expression "$Compose --profile setup run --rm seed"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    Write-Host "    (Seed omitido - usa -FirstSetup la primera vez o -Seed para forzar)"
}

Write-Step "4/5 Build + Backend + Portal web"
if ($SkipBuild) {
    Invoke-Expression "$Compose up -d backend web"
} else {
    Invoke-Expression "$Compose up -d --build backend web"
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Step "5/5 Verificacion"
Start-Sleep -Seconds 8

$httpPort = Get-EnvValue "PHARMACOL_HTTP_PORT"
if (-not $httpPort) { $httpPort = "3906" }
$basePath = Get-EnvValue "PHARMACOL_BASE_PATH"
if (-not $basePath) { $basePath = "/pharmacol" }
$serverIp = Get-EnvValue "PHARMACOL_SERVER_IP"
if (-not $serverIp) { $serverIp = "192.168.20.26" }

$localHealth = "http://127.0.0.1:${httpPort}${basePath}/v1/health"
$lanPortal = "http://${serverIp}:${httpPort}${basePath}/"

try {
    $r = Invoke-WebRequest -Uri $localHealth -UseBasicParsing -TimeoutSec 15
    if ($r.StatusCode -eq 200) {
        Write-Host "    [OK] API local: $localHealth" -ForegroundColor Green
    }
} catch {
    Write-Host "    [WARN] API local aun no responde - revisa logs" -ForegroundColor Yellow
    Write-Host "    $Compose logs backend web"
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  Despliegue completado" -ForegroundColor Green
Write-Host ""
Write-Host "  Portal:   $lanPortal"
Write-Host "  API:      http://${serverIp}:${httpPort}${basePath}/v1"
Write-Host "  Swagger:  http://${serverIp}:${httpPort}${basePath}/docs"
Write-Host ""
Write-Host "  Login:    admin@pharmacol.co / admin123"
Write-Host ""
Write-Host "  Comandos:"
Write-Host "    $Compose ps"
Write-Host "    $Compose logs -f backend"
Write-Host ""
if (-not ($FirstSetup -or $Seed)) {
    Write-Host "  Primera vez: .\scripts\deploy-windows-server.ps1 -FirstSetup"
}
Write-Host "  Actualizar:  git pull; .\scripts\deploy-windows-server.ps1"
Write-Host "========================================================" -ForegroundColor Green
