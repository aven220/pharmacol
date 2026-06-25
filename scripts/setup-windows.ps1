# PharmaCol — setup en Windows (PowerShell)
param(
    [switch]$DockerOnly,
    [switch]$Dev,
    [switch]$Prod
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $Root "..")

Write-Host "==> PharmaCol setup Windows" -ForegroundColor Cyan
Write-Host "    Ruta: $(Get-Location)"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Docker no está instalado o no está en el PATH." -ForegroundColor Red
    Write-Host "Instala Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
}

if (-not (Test-Path .env)) {
    if ($Prod -or (Test-Path .env.server.example)) {
        Copy-Item .env.server.example .env
        Write-Host "✓ Creado .env desde .env.server.example — edítalo antes de producción." -ForegroundColor Yellow
    } elseif (Test-Path .env.example) {
        Copy-Item .env.example .env
        Write-Host "✓ Creado .env desde .env.example"
    }
}

Write-Host "==> Docker: postgres + redis"
docker compose up -d

Write-Host "==> Esperando PostgreSQL..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    docker compose exec -T postgres pg_isready -U pharmacol -d pharmacol 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $ready) {
    Write-Host "ERROR: PostgreSQL no respondió a tiempo." -ForegroundColor Red
    exit 1
}

$composeFile = if ($Prod) { "docker-compose.prod.yml" } else { "docker-compose.yml" }
$composeArgs = @("-f", $composeFile, "--profile", "setup", "run", "--rm", "migrate")

Write-Host "==> Migraciones (Docker, sin pnpm)"
if ($Prod) {
    docker compose -f docker-compose.prod.yml --profile setup run --rm migrate
    docker compose -f docker-compose.prod.yml --profile setup run --rm seed
} else {
    docker compose --profile setup run --rm migrate
    docker compose --profile setup run --rm seed
}

if ($DockerOnly) {
    Write-Host ""
    Write-Host "✓ Listo (solo Docker)." -ForegroundColor Green
    Write-Host "  Producción: docker compose -f docker-compose.prod.yml up -d --build"
    Write-Host "  Ver docs/WINDOWS.md"
    exit 0
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "==> Instalando pnpm vía corepack..."
    if (Get-Command corepack -ErrorAction SilentlyContinue) {
        corepack enable
        corepack prepare pnpm@9.15.0 --activate
    } else {
        npm install -g pnpm@9.15.0
    }
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: No se pudo instalar pnpm. Usa -DockerOnly o instala manualmente." -ForegroundColor Red
    exit 1
}

Write-Host "==> pnpm install"
pnpm install

if ($Prod) {
    Write-Host "==> Build producción"
    docker compose -f docker-compose.prod.yml up -d --build
    Write-Host ""
    Write-Host "✓ Producción levantada." -ForegroundColor Green
    Write-Host "  Health: curl http://127.0.0.1:3906/pharmacol/v1/health"
} elseif ($Dev) {
    Write-Host ""
    Write-Host "✓ Listo para desarrollo." -ForegroundColor Green
    Write-Host "  Terminal 1: pnpm dev:backend"
    Write-Host "  Terminal 2: pnpm dev:admin"
} else {
    Write-Host ""
    Write-Host "✓ BD migrada y seed aplicado." -ForegroundColor Green
    Write-Host "  Dev:  .\scripts\setup-windows.ps1 -Dev"
    Write-Host "  Prod: .\scripts\setup-windows.ps1 -Prod"
}
