# Despliegue de Goonginga en una VPS

El despliegue incluye frontend Next.js principal, Goonginga Minigames, API Express, PostgreSQL 18 y Caddy.
Caddy publica HTTPS (`443`) y redirige HTTP (`80`) a HTTPS; frontend y API
quedan en puertos locales. La base no publica el puerto `5432` y sus datos se
almacenan en el volumen persistente `goonginga_postgres_data`.

## Minigames en su propio dominio

Minigames se publica como un segundo frontend en
`goonginga-gamenights.duckdns.org`, compartiendo la API y los Network Users del
sitio principal. En `.env` de la VPS configure:

```env
GOON_DOMAIN=goongingaleague.duckdns.org
GOON_GAMENIGHTS_DOMAIN=goonginga-gamenights.duckdns.org
NEXT_PUBLIC_API_BASE_URL=https://goongingaleague.duckdns.org/backend
NEXT_PUBLIC_MINIGAMES_API_BASE_URL=https://goongingaleague.duckdns.org/backend
```

En `backend/.env`, configure las dos URL de frontend y permita ambos orígenes:

```env
CORS_ORIGIN=https://goongingaleague.duckdns.org,https://goonginga-gamenights.duckdns.org
NETWORK_FRONTEND_URL=https://goongingaleague.duckdns.org
NETWORK_MINIGAMES_FRONTEND_URL=https://goonginga-gamenights.duckdns.org
NETWORK_AUTH_PUBLIC_PATH_PREFIX=/backend
DISCORD_REDIRECT_URI=https://goongingaleague.duckdns.org/backend/network-auth/discord/callback
```

Ambos registros DuckDNS deben apuntar a la IP pública de la VPS. Abra solo TCP
`80` y `443` en el firewall de la VPS/proveedor; no exponga `3000`, `3001`,
`3002` ni `5432`. Después de actualizar el repositorio ejecute:

```bash
docker compose --env-file .env up --build -d
docker compose ps
```

## Crear credenciales nuevas

En la raíz de `migration-uidesign`, genere todos los secretos y las credenciales
de PostgreSQL nuevos con:

```bash
bash scripts/create-vps-env.sh goongingaleague.duckdns.org goonginga-gamenights.duckdns.org
```

El script se niega a sobrescribir archivos de entorno existentes y crea los
archivos con permiso `600`. Discord es una integración independiente: cree claves
nuevas en el proveedor y agréguelas al archivo correspondiente. Los archivos subidos por
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

## Activar Discord Network

En la aplicación de Discord registre exactamente esta URL de redirección OAuth:

```text
https://YOUR_DOMAIN/backend/network-auth/discord/callback
```

Después ejecute el asistente desde la raíz del proyecto. Solicita el Client ID,
Client Secret y Guild ID sin mostrar el secreto, y genera `NETWORK_JWT_SECRET`
en la VPS:

```bash
bash scripts/configure-discord-network.sh YOUR_DOMAIN
docker compose --env-file .env up -d --force-recreate backend
```

## Actualizar el proyecto

```bash
git pull --ff-only
docker compose --env-file .env up --build -d
```
