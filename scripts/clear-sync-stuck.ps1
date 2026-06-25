# Libera syncs EN_PROCESO huérfanas en PostgreSQL (tras reinicio o cancelacion).
# Uso: powershell -ExecutionPolicy Bypass -File .\scripts\clear-sync-stuck.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== PharmaCol - Limpiar syncs colgadas ===" -ForegroundColor Cyan

$sql = @"
UPDATE sync_jobs
SET status = 'FALLIDA',
    fin_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"errorMensaje":"Liberado con clear-sync-stuck.ps1"}'::jsonb
WHERE status = 'EN_PROCESO';
SELECT COUNT(*) AS liberadas FROM sync_jobs WHERE status = 'FALLIDA' AND fin_at > NOW() - INTERVAL '1 minute';
"@

docker compose -p pharmacol -f docker-compose.prod.yml exec -T postgres `
  psql -U pharmacol -d pharmacol -c $sql

Write-Host ""
Write-Host "Reiniciando backend..." -ForegroundColor Yellow
docker compose -p pharmacol -f docker-compose.prod.yml restart backend

Write-Host ""
Write-Host "Listo. En el admin: Sincronizacion -> INVIMA_CUM_VIGENTES -> Ejecutar (una sola fuente)." -ForegroundColor Green
Write-Host "Token INVIMA es opcional. Ver docs/SYNC_INVIMA.md para obtenerlo gratis." -ForegroundColor Gray
