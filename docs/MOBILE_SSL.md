# App móvil + HTTPS — por qué falla Expo Go y qué hacer

## El problema (en una frase)

El servidor usa **HTTPS con certificado autofirmado** (IP `20.5.19.8`).

| Cliente | Resultado |
|---------|-----------|
| Chrome del celular | ✅ Aceptas la advertencia manualmente |
| **Expo Go** | ❌ No puede aceptar certificados inválidos |
| App nativa (Dev Build) | ✅ Con cert embebido (más trabajo) |

**No es la URL ni el backend** — el `curl` y el navegador ya prueban que la API responde.

---

## Opción 1 — Dominio + Let's Encrypt (recomendada, Expo Go funciona)

Si tienes un dominio (ej. `pharmacol.co`, `app.tuempresa.com`):

1. **DNS:** registro `A` → `20.5.19.8`  
   Ejemplo: `pharmacol.tudominio.com` → `20.5.19.8`

2. **En el servidor** (certificado válido para nginx de A-AS):

```bash
# Parar edge un momento si certbot usa :80
cd ~/pharma-delivery
docker compose -f docker-compose.prod.yml stop edge

sudo certbot certonly --standalone -d pharmacol.tudominio.com --agree-tos -m tu@email.com

sudo cp /etc/letsencrypt/live/pharmacol.tudominio.com/fullchain.pem infra/ssl/fullchain.pem
sudo cp /etc/letsencrypt/live/pharmacol.tudominio.com/privkey.pem infra/ssl/privkey.pem
sudo chown $(whoami):$(whoami) infra/ssl/*.pem

docker compose -f docker-compose.prod.yml start edge
docker exec -u root pharma-edge-prod nginx -t && docker exec -u root pharma-edge-prod nginx -s reload
```

3. **Probar:**

```bash
curl https://pharmacol.tudominio.com/pharmacol/v1/health
```

4. **App móvil** (`apps/mobile-expo/.env`):

```env
EXPO_PUBLIC_API_URL=https://pharmacol.tudominio.com/pharmacol/v1
```

Reinicia Expo → **Producción** → **Probar** → login. **Sin compilar nada.**

---

## Opción 2 — Túnel Cloudflare (sin dominio propio, pruebas)

URL pública con certificado válido de Cloudflare (Expo Go funciona). La URL cambia al reiniciar el túnel.

**En el servidor:**

```bash
# Instalar cloudflared (una vez)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
sudo dpkg -i /tmp/cloudflared.deb

# Túnel hacia PharmaCol local
cloudflared tunnel --url http://127.0.0.1:3906
```

Copia la URL que imprime, ej. `https://abc-xyz.trycloudflare.com`

**En el Mac** (`apps/mobile-expo/.env`):

```env
EXPO_PUBLIC_API_URL=https://abc-xyz.trycloudflare.com/pharmacol/v1
```

Deja el túnel corriendo en el servidor mientras uses la app.

---

## Opción 3 — Usar el web en el celular (ya funciona)

Abre en Chrome del teléfono:

```
https://20.5.19.8/pharmacol/
```

Login admin, consulta medicamentos, sync desde **Sincronización**.  
Puedes **Añadir a pantalla de inicio** (icono tipo app).

---

## Opción 4 — Dev Build Android (sin dominio, sin túnel)

Solo si no puedes usar 1, 2 ni 3:

```bash
bash scripts/prepare-mobile-cert.sh
cd apps/mobile-expo && pnpm install && npx expo prebuild --clean && npx expo run:android
```

Instala **PharmaCol** (no Expo Go).

---

## Resumen

| Opción | Esfuerzo | Expo Go | Permanente |
|--------|----------|---------|------------|
| Dominio + Let's Encrypt | Medio (1 h) | ✅ | ✅ |
| Túnel Cloudflare | Bajo (5 min) | ✅ | ❌ (URL temporal) |
| Web en el celular | Cero | N/A | ✅ |
| Dev Build | Alto | ❌ (app propia) | ✅ |

**Recomendación:** si tienes o puedes crear un subdominio → **Opción 1**. Es la misma infra que ya tienes; solo cambia el certificado por uno que el móvil confía automáticamente.
