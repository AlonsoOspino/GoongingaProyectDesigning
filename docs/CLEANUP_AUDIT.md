# Auditoría de limpieza para el portafolio

Fecha: 2026-09-26. Alcance: archivos versionados de la raíz, API Express,
frontend principal, Game Nights, Prisma, despliegue y documentación. También
se inspeccionaron los directorios locales ignorados por Git.

## Criterio

Se cruzaron `package.json`, Docker/Compose, `backend/app.js`, rutas de Next,
imports/`require`, referencias de scripts, pruebas y búsquedas de símbolos.
Un archivo sin import no se borró automáticamente: páginas `page.tsx`,
`route.ts`, configuraciones, assets por URL, migraciones y scripts invocados por
infraestructura tienen entradas distintas. Se comprobó el alcance desde las
entradas de producción antes y después de retirar módulos.

Resultado: 76 archivos versionados retirados y tres documentos nuevos para
navegación, auditoría y planificación.

## Retirado

| Área | Motivo |
| --- | --- |
| `backend/scripts/` (13 archivos) | Operaciones manuales de seed, reparación, migración y verificaciones locales; ninguna participa en el arranque ni en el despliegue. `archive-season.js` declaraba depender de una tabla ya retirada. |
| `backend/prisma/seed.js` y `seed-maps.sql` | Seed vacío y SQL sin consumidor; se quitaron sus comandos npm. |
| `backend/tests/seasonExport.test.js` | Probaba exclusivamente `scripts/export-season.js`, retirado según el criterio de no mantener scripts manuales de BD. |
| `backend/middleware/admin.js` y `backend/services/draft.js` | Duplicado de `middlewares/admin.js` y alias sin importadores del controlador de draft. |
| Web principal | Componentes de draft y layout sustituidos, antigua capa `liveHub`, hooks sin consumidores, formulario de media sin uso, página de temporada antigua y parser de encuesta duplicado sin importadores. |
| Game Nights | Copia inactiva de controles UI, wrappers de API de la web principal, `blobUpload.ts` y su ruta `/api/upload` sin cliente; las subidas de portadas usan `/minigames/games/:slug/cover` en la API. |
| Cliente de administración | Tres funciones de backup/restauración/borrado que apuntaban a `/system-db`; ese prefijo no está montado en la API. |
| Funciones y tipos internos | Wrappers de API, tipos exportados y variables sin consumidores en ambas webs. Se verificó con búsquedas de símbolos y `tsc --noUnusedLocals`. |
| Estilos | Dos módulos CSS sin importadores tras retirar componentes antiguos. |
| Raíz | Dependencias y lockfile de una capa npm que solo delega a subproyectos; comando de Blob inexistente, atajos obsoletos y archivos HTML/Python de generación sin referencias. |
| Documentación | Descripciones antiguas de seed, `/system-db` y migración de Blob ya terminada. |

## Conservado a propósito

- `backend/prisma/migrations/`: Prisma las aplica con `migrate deploy` al
  iniciar el contenedor. Borrar una migración histórica rompe instalaciones y
  recuperación.
- `scripts/deploy-vps.sh`: crea un dump antes de cada despliegue y valida
  servicios. `create-vps-env.sh` y `configure-discord-network.sh` son
  herramientas de instalación documentadas.
- `frontend/HeroImages/`, `frontend/MapImages/`,
  `frontend/public/history/` y `frontend/src/data/history/season-8.json`:
  las referencias pueden aparecer como URLs o dentro de JSON, no como imports.
- `backend/tests/`: cubren reglas activas de permisos, draft, temporada,
  anuncios y minijuegos.
- `frontend/src/app/dev/draft-app/` y `backend/routes/devDraftApp.js`:
  están conectados y el endpoint exige rol `DEVELOPER`. Su conveniencia para
  producción debe decidirse en un proyecto de seguridad aparte.

## Hallazgos que quedan como proyectos

1. **Backups:** hay dump automático **antes de cada despliegue**, pero no se
   encontró cron, retención, copia fuera de la VPS ni prueba automática de
   restauración en este repositorio. Una automatización externa podría existir;
   no se verificó la VPS. El respaldo previo al despliegue ya se genera en
   formato custom y se comprueba con `pg_restore --list`; aún falta ejecutar
   un simulacro de restauración real.
2. **Uploads de la web principal:** `frontend/src/app/api/upload/route.ts`
   ahora verifica la sesión con la API, limita tipos según rol, valida MIME contra
   contenido real y solo permite borrar a personal ADMIN/DEVELOPER. Las
   sustituciones hechas por capitanes conservan el archivo anterior hasta crear
   un proceso seguro de recolección de medios huérfanos. Aún conviene añadir
   límite de frecuencia y cuotas por usuario.
3. **Despliegue Windows:** `deploy-goonginga.bat` hace commit/push y ejecuta
   `git restore` y `git clean` en rutas de la VPS antes del pull. Es operativo,
   pero merece un pipeline reproducible que separe build, aprobación y despliegue
   y que no descarte cambios remotos.
4. **Carpeta local ignorada:** se solicitó retirar el componente de escritorio
   obsoleto. La eliminación recursiva del directorio local fue rechazada por la
   revisión automática de comandos; el directorio sigue ignorado por Git y
   requiere eliminación manual en este equipo. Su clave embebida debe rotarse
   si se usó en producción.

## Verificación

El grafo de imports posterior a la limpieza deja alcanzables desde rutas Next
todos los módulos de aplicación de ambos frontends. Solo quedan fuera de ese
grafo los archivos de configuración y `next-env.d.ts`, que Next carga por
convención. En backend quedan fuera del arranque únicamente pruebas y
`prisma.config.ts`, que usa Prisma CLI.

Las búsquedas estáticas no prueban el tráfico real de producción, los assets
referenciados por valores de base de datos ni cron jobs externos. La
conservación de esos archivos evita inferir uso solo por el grafo de imports.

Comprobaciones finales: 71 pruebas de backend aprobadas; builds de producción
de ambos frontends aprobados; `npm run typecheck` aprobado en ambos; sintaxis
de `deploy-vps.sh` aprobada con `bash -n`; `git diff --check` sin errores.
El backup custom se validó sintácticamente, pero no se ejecutó contra la VPS
ni se hizo una restauración real en esta auditoría.
