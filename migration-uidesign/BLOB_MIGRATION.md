# Migrar Vercel Blob a la VPS

Los nuevos archivos se guardan en `media/` en la VPS y se publican por la API
como `/uploads/<archivo>`. Esta carpeta es un montaje de Docker persistente y no
se sube a Git. PostgreSQL no publica su puerto, pero las imágenes, videos y
audios que usa la web deben ser públicos para los navegadores y OBS.

## Migrar los archivos usados por Goonginga

El script descarga cada URL de Vercel Blob que esté referenciada en las tablas
y JSON de Goonginga, la copia a `media/` y actualiza la referencia dentro de la
nueva PostgreSQL. No elimina ningún archivo de Vercel. Si Vercel responde
`403`, necesita un `BLOB_READ_WRITE_TOKEN` válido del proyecto anterior
(Vercel: Storage → Blob → configuración del almacén).

Primero haga una simulación desde la VPS:

```bash
docker compose --env-file .env exec backend \
  node scripts/migrate-vercel-blob-to-local.js --public-api-base=http://YOUR_SERVER_IP:3000
```

Si el resumen no muestra errores, ejecute la migración real. La clave se pide
oculta y solo se inyecta en ese proceso; no la agregue a ningún `.env`:

```bash
read -rsp "Token temporal de Vercel Blob: " VERCEL_BLOB_READ_WRITE_TOKEN; echo
docker compose --env-file .env exec \
  -e VERCEL_BLOB_READ_WRITE_TOKEN="$VERCEL_BLOB_READ_WRITE_TOKEN" backend \
  node scripts/migrate-vercel-blob-to-local.js --write --public-api-base=http://YOUR_SERVER_IP:3000
unset VERCEL_BLOB_READ_WRITE_TOKEN
```

El manifiesto `media/blob-migration-manifest.json` conserva el mapeo entre cada
URL antigua y su nueva URL local. Revise la web y OBS antes de borrar nada del
Blob de Vercel.

## Archivos sin referencia

Los objetos de Vercel Blob que no aparecen en la base no pueden descubrirse sin
un token antiguo de lectura/escritura válido. La credencial local actual no tiene
permiso para enumerarlos. Recupere un token temporal desde el almacén de Vercel
si también quiere archivar esos objetos; no lo agregue a los `.env` de la VPS.
