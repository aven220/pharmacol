# Fase 2 — Modelo de Datos

## Resumen

| Elemento | Cantidad |
|----------|----------|
| Modelos Prisma | 30 |
| Enums | 18 |
| Tablas | 30 |
| Seeds | 6 módulos |

## Modelos

### Seguridad
- `User`, `Role`, `Permission`, `UserRole`, `RolePermission`
- `RefreshToken`, `Session`, `PasswordResetToken`

### Farmacéutico
- `Laboratory`, `ActiveIngredient`, `InvimaRegistration`, `AtcCode`
- `Medicamento`, `MedicamentoPrincipioActivo`, `Presentacion`
- `CodigoCum`, `CodigoIum`

### Dispositivos
- `DispositivoMedico`, `DispositivoAtributo`

### Sincronización
- `DataSource`, `SyncJob`, `SyncRecord`, `RegistroHistorial`
- `SyncError`, `SyncStagingRecord`

### Inteligencia
- `Image`, `OcrResultado`, `IaResultado`, `AlertaFalsificacion`

### Usuario
- `Favorite`, `QueryHistory`, `AuditLog`

## Diagrama ER simplificado

Ver documento de arquitectura Fase 1 para diagrama completo.

## Fuentes INVIMA configuradas

| Código | Dataset | Activo |
|--------|---------|--------|
| `INVIMA_CUM_VIGENTES` | i7cb-raxc | ✅ |
| `INVIMA_CUM_VENCIDOS` | s85f-d7b9 | ✅ |
| `INVIMA_DISPOSITIVOS` | y4qt-w6tk | ✅ |
| `INVIMA_RSA_PDF` | PDF parser | ❌ |
| `SISMED`, `MIPRES`, `CUPS`, `ADRES` | Futuro | ❌ |

## Roles y permisos

6 roles × 14 permisos granulares. Ver `prisma/seeds/roles-permissions.ts`.

## ATC

Seed con ~70 códigos representativos (niveles 1-5). Importación CSV completa en Fase 3 sync.
