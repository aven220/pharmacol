# Certificado HTTPS del servidor (autofirmado)

Expo Go **no** confía en certificados autofirmados. Para que la app nativa conecte a `https://20.5.19.8`, copia el certificado aquí y genera un **Dev Build**.

## 1. Copiar cert desde el servidor

```bash
# Desde tu Mac (ajusta usuario/host)
scp aven220@20.5.19.8:~/pharma-delivery/infra/ssl/fullchain.pem apps/mobile-expo/certs/server.pem
```

## 2. Instalar app nativa en el teléfono (Android)

```bash
cd apps/mobile-expo
pnpm install
npx expo prebuild --clean
npx expo run:android
```

Conecta el teléfono por USB con depuración USB activada, o escanea el QR del build instalado.

## 3. iOS

Instala el perfil del certificado en Ajustes → General → Información → Confianza de certificados.
O usa `npx expo run:ios` en dispositivo registrado.

## Nota

No subas `server.pem` a git si es privado de producción (ya está en .gitignore).
