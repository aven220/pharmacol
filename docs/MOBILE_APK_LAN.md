# PharmaCol — Móvil APK (servidor Windows LAN)

## URL embebida en la APK

```
http://192.168.20.26:3906/pharmacol/v1
```

Celular y servidor deben estar en la **misma Wi‑Fi**.

## 1. Servidor Windows (API)

```powershell
cd G:\PROGRAMAS\pharmacol
git pull
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-windows-server.ps1
```

Probar desde el navegador del celular:

```
http://192.168.20.26:3906/pharmacol/v1/health
```

Debe responder JSON con `success: true`. Si no carga, abre el firewall de Windows al puerto **3906**.

## 2. Generar APK (en la Mac)

```bash
cd ~/Documents/pharmacol
git pull
pnpm install
cd apps/mobile-expo
pnpm exec eas login   # solo primera vez
cd ../..
pnpm mobile:apk
```

Descarga el `.apk` del enlace EAS e instálalo en el Android.

## 3. Login en la app

- Email: `admin@pharmacol.co`
- Contraseña: `admin123`

Ya **no** hay botón “Probar / Reintentar conexión”. Al pulsar **Iniciar sesión** conecta directo al servidor.

## 4. Modo sin internet (offline)

La app guarda en SQLite del teléfono un **paquete offline** (~todos los medicamentos vigentes + CUM/presentaciones).

### Cómo usarlo

1. Con Wi‑Fi al servidor: inicia sesión.
2. La app **sincroniza sola** si no hay datos o tienen más de 24 h (también puedes forzar en **Perfil → Descargar/Actualizar paquete offline**).
3. Apaga datos/Wi‑Fi o sal de la red: puedes **buscar** por nombre, INVIMA, CUM o principio activo, y abrir **presentaciones/ficha** desde lo guardado.
4. Al volver a conectarte, sincroniza de nuevo para actualizar.

### Notas

- El login sí necesita red (al servidor LAN).
- Favoritos e IA/OCR requieren red.
- Tras actualizar backend o APP, vuelve a sincronizar el paquete desde Perfil.
- Rebuild APK tras estos cambios: `pnpm mobile:apk`.
