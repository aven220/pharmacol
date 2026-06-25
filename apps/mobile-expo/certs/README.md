# Certificado público del servidor (fullchain.pem)

Necesario para que la APK Android confíe en `https://20.5.19.8`.

```bash
# Desde la raíz del monorepo
bash scripts/prepare-mobile-cert.sh
bash scripts/build-mobile-apk.sh
```

Solo es el certificado **público** (no la clave privada).
