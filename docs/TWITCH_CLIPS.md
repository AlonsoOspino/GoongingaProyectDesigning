# Clips de Twitch en la portada

La sección WHO WE ARE? obtiene los diez clips históricos más vistos de
`overtimeggl` mediante la API oficial de Twitch. Cada visita comienza con un
clip aleatorio. La lista se comparte entre visitantes y se actualiza al recibir
una consulta después de 15 minutos.

## Activar la conexión

1. Registra una aplicación en https://dev.twitch.tv/console/apps siguiendo
   https://dev.twitch.tv/docs/authentication/register-app/.
2. Guarda su Client ID y Client Secret en `migration-uidesign/frontend/.env.local`
   para desarrollo, o en `migration-uidesign/frontend/.env` del servidor:

   ```dotenv
   TWITCH_CLIENT_ID=tu_client_id
   TWITCH_CLIENT_SECRET=tu_client_secret
   ```

3. Reinicia el frontend. Compose ya carga `frontend/.env` al crear el contenedor.
   Tras instalar esta versión, basta recrear el contenedor frontend para aplicar
   cambios de credenciales; no es necesario cambiar la API Java ni la base de datos.

Estos valores son privados: no los uses con el prefijo `NEXT_PUBLIC_`, no los
subas a Git ni los pegues en el chat. No hace falta que cada visitante inicie sesión.

## Reproducción

- El reproductor oficial empieza silenciado e incorpora el dominio actual en `parent`.
- La rotación usa la duración del clip más ocho segundos de margen, porque el
  reproductor de clips no ofrece un evento público de finalización. Los controles
  permiten cambiar de clip o pausar la rotación. Se pausa también al interactuar
  con el reproductor, ocultar la pestaña o salir de la sección.
- En pantallas donde no cabe el ancho mínimo de 400 px exigido por Twitch, se
  muestra una miniatura que abre el clip en Twitch.
- Sin credenciales, sin clips o ante un error inicial, se muestra un enlace al
  canal. No se muestran clips de ejemplo como si fueran reales.
- Si Twitch falla después de una consulta válida, se conserva la última lista
  durante un máximo de 24 horas y se espera un minuto antes de volver a consultar.

## Verificación

Desde `migration-uidesign/frontend`, ejecuta:

```text
node --experimental-strip-types --test tests/twitch-clips.test.mjs
npm run typecheck
npm run build
```

Los tests no necesitan credenciales ni conexión a Twitch.
