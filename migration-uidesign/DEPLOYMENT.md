# Despliegue de Goonginga en una VPS

El despliegue incluye tres contenedores: frontend Next.js (puerto `3001`), API
Express (puerto `3000`) y PostgreSQL 18. La base no publica el puerto `5432` y
sus datos se almacenan en el volumen persistente `goonginga_postgres_data`.

## Crear credenciales nuevas

En la raíz de `migration-uidesign`, genere todos los secretos y las credenciales
de PostgreSQL nuevos con:

```bash
bash scripts/create-vps-env.sh YOUR_SERVER_IP
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

Compruebe desde un navegador `http://YOUR_SERVER_IP:3001`. Cuando se asigne un
dominio, ponga los servicios detrás de un proxy HTTPS y actualice
`NEXT_PUBLIC_API_BASE_URL` antes de reconstruir el frontend.

## Actualizar el proyecto

```bash
git pull --ff-only
docker compose --env-file .env up --build -d
```
