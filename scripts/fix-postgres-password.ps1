# Alinea la contraseña de PostgreSQL con POSTGRES_PASSWORD del .env (Windows)
param(
    [string]$ComposeFile = "docker-compose.prod.yml"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $Root "..")

$Compose = "docker compose -p pharmacol -f $ComposeFile"

if (-not (Test-Path .env)) {
    Write-Host "ERROR: Falta .env en $(Get-Location)" -ForegroundColor Red
    exit 1
}

$envContent = Get-Content .env -Raw
if ($envContent -match '(?m)^POSTGRES_PASSWORD=(.+)$') {
    $pass = $Matches[1].Trim().Trim('"').Trim("'")
} else {
    Write-Host "ERROR: POSTGRES_PASSWORD no definido en .env" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrWhiteSpace($pass)) {
    Write-Host "ERROR: POSTGRES_PASSWORD vacío" -ForegroundColor Red
    exit 1
}

Write-Host "==> Levantando PostgreSQL ($ComposeFile)..."
Invoke-Expression "$Compose up -d postgres"

Write-Host "==> Esperando PostgreSQL..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Invoke-Expression "$Compose exec -T postgres pg_isready -U pharmacol -d pharmacol" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $ready) {
    Write-Host "ERROR: PostgreSQL no respondió." -ForegroundColor Red
    exit 1
}

$passSql = $pass -replace "'", "''"
$sql = "ALTER USER pharmacol PASSWORD '$passSql';"

Write-Host "==> Actualizando contraseña del usuario pharmacol..."
$defaults = @($pass, 'pharmacol_dev', 'PharmaCol_Dev_2026!')
$ok = $false
foreach ($tryPass in ($defaults | Select-Object -Unique)) {
    Invoke-Expression "$Compose exec -T -e PGPASSWORD=$tryPass postgres psql -U pharmacol -d pharmacol -c `"$sql`"" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $ok = $true
        break
    }
}

if (-not $ok) {
    Write-Host ""
    Write-Host "No se pudo cambiar la contraseña." -ForegroundColor Yellow
    Write-Host "Instalación limpia: .\scripts\deploy-windows-server.ps1 -FirstSetup -ResetDb"
    exit 1
}

Write-Host ""
Write-Host "✓ Contraseña alineada con POSTGRES_PASSWORD del .env" -ForegroundColor Green
Write-Host "Siguiente: docker compose -p pharmacol -f docker-compose.prod.yml --profile setup run --rm seed"
