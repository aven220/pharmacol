# Stack 100% gratuito — PharmaCol

## Resumen

**PharmaCol ya usa PostgreSQL gratis** dentro de Docker (`postgres:17-alpine`).

| Componente | Tecnología | Costo |
|------------|------------|-------|
| Base de datos | Docker `pharmacol-postgres` | **$0** |
| Redis | Docker `pharmacol-redis` | **$0** |
| Backend + Web | Docker en la VM | Costo VM Azure |

Conexión en producción (red interna Docker):

```
postgresql://pharmacol:PASSWORD@postgres:5432/pharmacol
```

El puerto `127.0.0.1:5543` del host es solo para herramientas locales en el servidor, no un servicio cloud de pago.

---

## Cobro de PostgreSQL en Azure

Si recibió factura de **Azure Database for PostgreSQL**, es un recurso **separado** del Docker Compose.

**Acción:** Portal Azure → eliminar `PostgreSQL flexible server` si no lo usa.

PharmaCol sigue funcionando con:

```bash
bash scripts/deploy-server.sh
```

---

## Verificación rápida

```bash
docker compose -p pharmacol -f docker-compose.prod.yml ps
docker compose -p pharmacol -f docker-compose.prod.yml exec backend printenv DATABASE_URL
```

Debe mostrar `@postgres:5432`, no `.postgres.database.azure.com`.

---

## Convivencia con A-AS Delivery

Ambos sistemas en la misma VM comparten:

- PostgreSQL **independiente** en contenedor (gratis)
- NGINX HTTPS en `:443`

No comparten base de datos ni generan costo extra de Postgres en la nube.
