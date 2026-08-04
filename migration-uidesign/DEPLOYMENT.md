# Despliegue de Goonginga en una VPS

Este despliegue ejecuta el frontend Next.js en el puerto `3001` y la API Express
en el `3000`. Está pensado para la primera verificación mediante una IP pública.
Cuando se asigne un dominio, ponga ambos servicios detrás de un proxy HTTPS y
actualice `NEXT_PUBLIC_API_BASE_URL` antes de reconstruir el frontend.

## Variables necesarias

1. Copie `backend/.env.example` a `backend/.env` y rellene las variables reales.
   La forma más segura es transferir el `.env` que ya está funcionando, sin
   imprimirlo ni añadirlo a Git.
2. Copie el archivo local `frontend/.env.local` a `frontend/.env`. Es necesario
   para las subidas a Vercel Blob; el valor público de API se configura en el
   siguiente paso durante la compilación.
3. Copie `deploy.env.example` a `.env` y reemplace `YOUR_SERVER_IP`.
4. Establezca `CORS_ORIGIN` en `backend/.env` con la URL pública del frontend,
   por ejemplo `http://51.79.86.24:3001`.

## Arranque

```bash
docker compose --env-file .env up --build -d
docker compose ps
curl http://127.0.0.1:3000/health
```

Compruebe desde un navegador `http://YOUR_SERVER_IP:3001`. Para revisar el
estado o los registros:

```bash
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
```

## Actualizar el proyecto

```bash
git pull --ff-only
docker compose --env-file .env up --build -d
```
