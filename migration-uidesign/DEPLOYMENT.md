# Despliegue de Goonginga con Spring Boot

Servicios: API Java 21 / Spring Boot, dos frontends Next.js, PostgreSQL 18 y
Caddy. HTTPS publica los mismos dominios y `/backend`. PostgreSQL conserva
su volumen `migration-uidesign_goonginga_postgres_data`. No uses `down -v`.

## Configuración

Compose conserva `backend/.env` para los secretos existentes de JWT, Discord y
OBS. No los regeneres al migrar. Las variables JDBC se inyectan desde `.env`
de Compose. Consulta `deploy.env.example` y `backend-springboot/.env.example`.

- `NETWORK_JWT_SECRET` y `JWT_SECRET`: mismos valores que antes, mínimo 32 bytes.
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID` y
  `DISCORD_REDIRECT_URI`: misma aplicación y callback OAuth.
- `NETWORK_FRONTEND_URL`, `NETWORK_MINIGAMES_FRONTEND_URL`: ambos dominios.
- `NETWORK_AUTH_PUBLIC_PATH_PREFIX=/backend`.
- La API tiene 768 MB de límite; Java limita el heap al 65% del contenedor.
- `media/` pertenece a sus propietarios originales y comparte grupo 10001;
  el script prepara lectura/escritura para Java. El frontend añade ese grupo.

Para un servidor **nuevo**, `scripts/create-vps-env.sh` genera credenciales y
se niega a sobrescribir archivos existentes. Arranca primero `database`;
el bootstrap SQL inicializa únicamente un volumen vacío. Restaura un backup
antes de importar y arrancar Java si vas a trasladar datos existentes.

## Actualización y cambio desde Node

Requisitos VPS: Docker Compose, curl, Python 3 y PyYAML. El checkout está en
`/opt/goonginga`; el proyecto Compose, en `/opt/goonginga/migration-uidesign`.

1. Compila Java y ambos frontends localmente. Incluye solo los archivos deseados
   en el commit con `git add`; el BAT no añade todos los cambios automáticamente.
2. Verifica una copia de la base con `migration.mode=check` y `apply`.
3. Conserva la configuración de Caddy, las redes de Adara y los alias del servidor.
   `update-vps-checkout.sh` guarda Compose, hace pull y combina esas redes con
   la configuración Java. Detiene el proceso si encuentra otros cambios de código.
4. Ejecuta el despliegue:

```bash
cd /opt/goonginga/migration-uidesign
bash scripts/update-vps-checkout.sh main
bash scripts/deploy-vps.sh --backend-only
```

Sin `--backend-only`, también construye y actualiza ambos frontends. El script:
construye mientras sirve la versión actual, guarda su imagen, detiene la API,
crea y valida un `pg_dump`, importa los drafts en una transacción, arranca Java
y comprueba salud, API pública, ambos sitios y Adara si existe su red.
La pausa comienza al detener la API y termina al quedar Java saludable.

Antes del primer pull, el nuevo script aún no existe en el servidor: transfiérelo
de forma temporal o conserva Compose/Caddy antes de hacer pull y ejecuta la misma
combinación de redes. No ejecutes `git restore` ni `git clean` sobre el código del VPS.

```bash
curl --fail http://127.0.0.1:3000/health
# {"ok":true,"runtime":"spring-boot",...}
curl --fail http://127.0.0.1:3000/health/db
curl --fail https://goongingaleague.duckdns.org/backend/health/db
docker compose ps backend frontend minigames database
```

El arranque exige importación completa; no arranques Node y Java como escritores
simultáneos. Los GET antiguos de draft se proyectan desde las tablas Spring.
Los POST/PUT directos al archivo de draft migrado devuelven 409; usa las acciones
de fase. Los archivos, usuarios y sesiones existentes se mantienen.

## Respaldos y recuperación

`backups/pre-spring-*.dump` contiene la base justo después de detener las
escrituras. `import-*.log` registra la conversión; los archivos tienen permisos
restrictivos. La imagen anterior queda etiquetada `goonginga-backend:rollback-*`.
`compose-before-pull-*.yaml` conserva la configuración anterior, incluidas redes.

Si falla un paso después de detener la API, el script deja `backend` detenido.
Inspecciona el log privado y corrige el problema antes de reintentar. Si Java ya
aceptó escrituras, toma otro respaldo y revisa esas operaciones: volver al dump
anterior elimina los cambios posteriores. Node no lee las nuevas tablas Spring.

Para recuperar deliberadamente la versión anterior durante una parada:

1. Detén `backend`; conserva también un dump del estado fallido.
2. Restaura el dump anterior en una base de recuperación y verifícalo primero.
3. Para restaurar sobre la base existente, elimina el esquema `spring_draft`
   antes de `pg_restore --clean --if-exists --no-owner --no-privileges`; las nuevas
   claves externas no deben bloquear la restauración de las tablas públicas.
4. Usa el Compose guardado **antes del pull**, con `--project-directory` apuntando
   al proyecto y `-p migration-uidesign`. Sobrescribe la imagen de backend con
   su etiqueta `rollback-*`; ejecuta `up -d --no-build --no-deps backend`.
5. Comprueba `/health/db`, OAuth, lectura de partidos y ambos dominios.

Nunca elimines el volumen PostgreSQL ni restaures sobre una API con escrituras
activas. Conserva el código Node y la imagen anterior durante el periodo de revisión.

## Discord

El callback sigue siendo:
`https://goongingaleague.duckdns.org/backend/network-auth/discord/callback`.
El despliegue reutiliza la configuración actual. La prueba automatizada usa
OAuth y webhooks simulados; completa una sesión humana para revisar la experiencia
de consentimiento en Discord. Las notificaciones de horarios se entregan mediante
cola persistente con reintentos y actualización del mensaje al reprogramar.
