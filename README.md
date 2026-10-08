# OverTime Productions · Goonginga League

Plataforma de producción para una liga de Overwatch: sitio público, operación de
temporadas y partidas, draft en vivo, overlays para OBS y Game Nights.

## Mapa rápido

El [grafo del código](docs/CODE_MAP.md) muestra entradas, dependencias, rutas y
archivos que conviene abrir primero. El [informe de limpieza](docs/CLEANUP_AUDIT.md)
explica qué se retiró, qué se conserva y qué falta para el portafolio.

| Parte | Entrada | Función |
| --- | --- | --- |
| Web principal | `migration-uidesign/frontend/src/app` | Sitio, paneles, draft y overlays |
| Game Nights | `migration-uidesign/minigames-frontend/src/app` | Jeopardy y Family Feud |
| API | `backend-springboot/src/main/java` | Spring Boot: autorización, módulos y fases del draft |
| Datos | `backend-springboot/src/main/resources/db` | PostgreSQL existente, Flyway y tablas del draft |
| Infraestructura | `migration-uidesign/compose.yaml` | PostgreSQL, API, dos webs y Caddy |

## Desarrollo

Cada aplicación instala sus propias dependencias. Los comandos de la raíz solo
redirigen a los proyectos correspondientes.

```bash
cd backend-springboot && ./mvnw -B -DskipTests package
cd ../migration-uidesign/frontend && npm install && npm run dev
cd ../minigames-frontend && npm ci && npm run dev
```

Las variables necesarias están documentadas en los archivos `.env.example`.
Ambos frontends ofrecen `npm run typecheck`; sus builds incluyen la revisión de
tipos de Next.js.
Para el entorno Windows local existe `migration-uidesign/scripts/start-local-dev.ps1`;
depende de JDK 21, PostgreSQL y datos de desarrollo. Consulta
[la guía de Java](backend-springboot/docs/APRENDER_JAVA.md) para estudiar el código.

## Despliegue y datos

`migration-uidesign/scripts/deploy-vps.sh` crea un `pg_dump` antes de cada
despliegue y comprueba los servicios tras iniciarlos. Flyway aplica las nuevas
migraciones de Spring; las migraciones públicas anteriores permanecen como referencia.
Las migraciones versionadas son parte del estado de la
base y no deben retirarse por parecer archivos antiguos. Los archivos subidos
viven fuera de Git, en `migration-uidesign/media/` en la VPS.

El respaldo previo al despliegue **no equivale** a un backup periódico o externo.
No hay programación de backups periódicos en este repositorio. Consulte
[DEPLOYMENT.md](migration-uidesign/DEPLOYMENT.md) para la instalación de VPS.
