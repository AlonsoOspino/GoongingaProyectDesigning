# Despliegue de Goonginga en una VPS

El despliegue incluye frontend Next.js, API Express, PostgreSQL 18 y Caddy.
Caddy publica HTTPS (`443`) y redirige HTTP (`80`) a HTTPS; frontend y API
quedan en puertos locales. La base no publica el puerto `5432` y sus datos se
almacenan en el volumen persistente `goonginga_postgres_data`.

## Crear credenciales nuevas

En la raíz de `migration-uidesign`, genere todos los secretos y las credenciales
de PostgreSQL nuevos con:

```bash
bash scripts/create-vps-env.sh YOUR_DOMAIN
```

El script se niega a sobrescribir archivos de entorno existentes y crea los
archivos con permiso `600`. Google Vision y Discord son integraciones
independientes: cree claves nuevas en cada proveedor y agréguelas al archivo
correspondiente solo cuando quiera activar esa función. Los archivos subidos por
la aplicación se guardan en el volumen local `media/`; consulte
`BLOB_MIGRATION.md` para migrar los existentes.

## Migrar los datos existentes

1. Arranque solo la nueva base: `docker compose --env-file .env up -d database`.
2. Transfiera un respaldo PostgreSQL en formato custom (`.dump`) al directorio
   `backups/`, sin transferir ningún `.env` antiguo.
3. Restaure el respaldo antes de iniciar la API:

```bash
docker compose --env-file .env exec -T database \
  pg_restore --clean --if-exists --no-owner --no-privileges \
  -U goonginga -d goonginga < backups/goonginga-vps-migration.dump
```

## Arranque y verificación

```bash
docker compose --env-file .env up --build -d
docker compose ps
curl http://127.0.0.1:3000/health/db
```

Antes de iniciar Caddy, haga que el registro A de `YOUR_DOMAIN` apunte a la IPv4
de la VPS y abra los puertos TCP `80` y `443`. Caddy obtiene y renueva el
certificado HTTPS automáticamente. Compruebe desde un navegador
`https://YOUR_DOMAIN` y la API en `https://YOUR_DOMAIN/backend/health/db`.

## Actualizar el proyecto

```bash
git pull --ff-only
docker compose --env-file .env up --build -d
```
