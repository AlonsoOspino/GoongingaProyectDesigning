# Season 9 · Divisiones

Season 8 terminó: Gamin 4 Goonginga ganó 4–2 a No Tank?. Season 9 se prepara con equipos formados por comité y divisiones. El número de equipos depende de las inscripciones; ocho es un objetivo opcional, no un requisito de las reglas. No se asignan equipos ni se inventa una fecha de inicio.

La liga regular genera un round robin independiente por división. Con dos grupos de cuatro son 12 series en tres semanas, cuatro series por semana. Los grupos impares reciben descansos. La generación exige que todos los equipos tengan división y que cada división tenga al menos dos equipos. Los partidos manuales también rechazan cruces entre divisiones durante la liga. Los playoffs cruzan divisiones y conservan el formato existente de ocho equipos.

Las asignaciones se guardan por temporada y quedan bloqueadas después de generar el calendario. Los equipos y divisiones de otras temporadas no se pueden mezclar. El archivo de Season 8 se conserva. Las temporadas históricas sin divisiones siguen usando un único grupo.

En Administración → Season se pueden guardar nombres de divisiones y asignaciones antes de generar los partidos. `/schedule`, `/teams`, `/standings` y `/stats` muestran datos de Season 9; anteriormente redirigían al archivo de Season 8. La clasificación de divisiones y las estadísticas públicas usan partidos de liga regular. El calendario incluye el bracket combinado de playoffs.

## Migraciones

- V6 agrega `TournamentDivision`, `Team.divisionId`, `teamFormation` y `targetTeamCount`. Permite fecha de inicio pendiente.
- V7 cierra Season 8, corrige el resumen de su final identificando temporada y nombres de los finalistas, y prepara Season 9 con Division A/B, comité y objetivo de ocho. Conserva el historial de mapas y jugadores. Si Season 9 ya existe, conserva sus equipos, fecha, estado y divisiones configuradas.
- El preflight de producción detectó la final sin mapas registrados, todavía `SCHEDULED` con marcador 0–0. V7 guarda el resultado confirmado 2–4 mediante `summary_only_result` en una sesión finalizada. No crea mapas, estadísticas ni acciones ficticias. El motor acepta este marcador únicamente con sesión y partido finalizados, ningún mapa, `gameNumber=0` y resultado válido para la serie. Las demás partidas siguen exigiendo concordancia exacta con el historial; una final con historial parcial o contradictorio detiene la migración.

Flyway aplica las migraciones al arrancar el backend actualizado. V6 y V7 se ensayaron contra la base de producción dentro de una transacción revertida: Season 8 finalizada con marcador 2–4 sin mapas inventados, Season 9 pendiente con comité y dos divisiones. El despliegue utiliza `scripts/deploy-vps.sh`, que guarda y valida un respaldo antes de aplicar las migraciones y comprueba la API, ambos frontends y Adara.

## Comprobaciones

Backend: 34 pruebas aprobadas. Incluyen calendario 2×4, grupos impares, equipos sin división, cruces rechazados, asignaciones de otra temporada, generación sin cambios parciales, clasificación que excluye playoffs y ocho casos del resultado histórico sin mapas. Frontend y Game Nights: compilación de producción correcta; typecheck, dos pruebas de identidad y tres de agrupación/filtros/estadísticas aprobadas. API local: Season 9 `SCHEDULED`, `COMMITTEE`, fecha nula y dos divisiones; Season 8 y su final siguen `FINISHED` con marcador 2–4 en el orden No Tank?/Gamin 4 Goonginga.

## Despliegue

Verificado en producción el 8 de octubre de 2026 (Lima), versión de aplicación `34e39a5`. V6 y V7 aplicadas correctamente. Season 9 es la temporada actual (`SCHEDULED`, `COMMITTEE`, ocho equipos como objetivo y dos divisiones); todavía no tiene equipos ni calendario publicados. Season 8 y la final 43 están `FINISHED`, marcador 2–4 en el orden No Tank?/Gamin 4 Goonginga, sin crear mapas inexistentes. Importación: 44 drafts migrados, cero bloqueados.

La API y PostgreSQL están saludables. Landing, Information, Schedule, Standings, Teams, Stats, Game Nights y Adara respondieron correctamente; CORS entre los sitios verificado. Se corrigió la espera final del script para que compruebe ambos frontends además de la API tras recrear los contenedores.

Respaldo validado del VPS: `backups/pre-spring-20261009T024637Z.dump`. Capturas publicadas: [Season 9](visual-review/season-9-production.jpg) y [calendario](visual-review/season-9-production-schedule.jpg).

El control `Administration → Season → Homepage countdown` permite guardar o quitar la fecha y hora de inicio mientras la temporada está pendiente. Usa `PATCH /tournament/{id}/countdown`, reservado a ADMIN: fecha ISO guarda `startDate`; `null` lo borra. La portada lee ese valor y actualiza la cuenta regresiva. No cambia el estado del torneo ni exige ocho equipos. Se retiraron el texto repetido de formato en portada, el resumen de Season 8 añadido al párrafo GGL y la cinta de estadísticas de History. La captura de hero bans queda bajo el título, a la izquierda de las reglas.

## Operación integrada de temporada · 16 de octubre de 2026

Cambios preparados y comprobados localmente el 16 de octubre; desplegados y verificados en producción el 17 de octubre de 2026 (Lima). No requiere una nueva migración.

1. **Administration → Teams & Captains:** crear equipos y elegir su liga/división. Subir logo, roster artwork, left banner y right banner, con vista previa; guardar el equipo publica las imágenes para las fichas, Schedule, draft y overlays. También se pueden pegar URLs o retirar imágenes. Se admiten PNG, JPG, WebP y GIF de hasta 5 MB.
2. **Players & captain:** editar el equipo guardado y asignar miembros activos como jugadores o capitanes. Reemplazar al capitán deja al anterior como jugador. El roster, My Team, Captain Dashboard, draft y navegación consultan las asignaciones actuales, sin exigir un nuevo login por Discord.
3. **Administration → Season Control:** nombrar las divisiones y revisar sus asignaciones antes del primer fixture. Cada división necesita dos equipos como mínimo; no se exige un número fijo de equipos.
4. **Administration → Schedule & Results:** generar todo el round robin o crear partidos manuales indicando división, semana, rivales y fecha opcional. Cada semana comparte número entre las divisiones y conserva sus propios enfrentamientos. El primer partido manual de liga abre ROUNDROBIN y bloquea formación/divisiones; las imágenes y asignaciones de jugadores siguen editables. No se pueden generar automáticamente fixtures sobre una liga con partidos manuales existentes. Se rechazan cruces regulares de división y equipos duplicados en una semana.
5. **Draft & results:** cada fixture prepara su mesa de draft y pool de mapas. Registrar los ganadores de mapas desde esa mesa actualiza marcador, historial y clasificación juntos. Schedule & Results y Manager muestran los resultados; el calendario público se refresca automáticamente y permite filtrar división, semana y estado. Los enlaces `?division=<id>&week=<n>` conservan la selección.
6. **Stream:** cada partido abre un panel con ocho fuentes para OBS: header normal/invertido, map pool, win cards, rosters A/B, standings y casting. El panel obtiene la clave de broadcast y permite abrir/copiar las fuentes. Requiere `DRAFT_TABLE_MANAGER_KEY` configurada en el backend para las lecturas protegidas de OBS. La clave no se inventa ni se expone en el calendario público.

La landing y `/announcements` comparten una tarjeta de torneo de proporción **16:9**, con logos reales enfrentados, división, semana, BO, countdown, marcador live/final y enlaces al partido/calendario correspondiente. Los fixtures manuales ya aparecen durante la preparación. Los estados vacíos y errores no inventan equipos, fechas ni resultados. La tarjeta se revisó a 320 px, 390 px y escritorio, incluyendo nombres largos.

### Verificación de esta revisión

- Backend: 46 pruebas y empaquetado ejecutable correctos. Frontend: typecheck, build de producción y 12 pruebas de calendario/divisiones/anuncio correctos, además de la comprobación de identidad de temporada.
- Ensayo HTTP en una copia aislada de la base local: ocho equipos con logos subidos; roster/banners persistidos y servidos; capitanes asignados y reemplazados; 12 fixtures en tres semanas, dos por división/semana, con draft por fixture; partido manual adicional y validaciones de cruces/conflictos.
- Serie BO5 completa mediante selección, bans, juego y resultados: final 3–0, tres registros de mapa y victoria en leaderboard. Cambio de capitán con tokens existentes: acceso revocado al saliente y concedido al nuevo. Lectura protegida de OBS comprobada con clave y sin sesión.
- Revisión en Chrome: guardar equipo, previews de los cuatro assets, calendario admin, ocho fuentes OBS disponibles, Schedule público con `division=2&week=1` y dos fixtures, y fichas públicas respondiendo correctamente. Los equipos con prefijo QA en las capturas son datos de ensayo; no se publicaron ni se asignaron equipos reales de Season 9.

Evidencia: [anuncio 16:9](visual-review/season9-announcement-preview.jpg), [nombre largo en móvil](visual-review/season9-announcement-mobile-long-name.jpg), [admin de equipos](visual-review/season9-admin-teams-qa.jpg), [admin de calendario](visual-review/season9-admin-schedule-qa.jpg) y [calendario público filtrado](visual-review/season9-public-schedule-qa.jpg).

## Publicación verificada · 17 de octubre de 2026

Código desplegado: `a4ebaf9`. El procedimiento oficial conservó Compose/Caddy y sus redes, construyó backend y frontends, detuvo escrituras antes del respaldo y completó la importación con 44 drafts conservados y cero bloqueados. PostgreSQL y API saludables; frontend y Game Nights activos. Comprobaciones de HTTPS, CORS y Adara correctas.

- Respaldo validado: `backups/pre-spring-20261018T035158Z.dump`.
- Imagen anterior conservada: `goonginga-backend:rollback-20261018T035158Z`.
- Log de despliegue en el VPS: `backups/season9-deploy-20261018T035200Z.log`.
- Season 9 conserva su ID 5, estado SCHEDULED, comité, dos divisiones, countdown existente y cero equipos/partidos; los datos QA no se transfirieron a producción. Season 8 y la final 43 conservan FINISHED y el resultado 2–4.
- Landing, anuncios, información de temporada, admin de equipos/calendario, Schedule, Teams, Standings, Stats, Manager y Captain responden HTTP 200. El upload de equipos sin sesión devuelve 401.
- En Chrome se confirmó la nueva landing y su anuncio de 1224 × 688.5 (16:9 exacto), sin desbordamiento, con las dos divisiones y el countdown configurado. Los enfrentamientos mostrarán los logos y marcadores al crear equipos y fixtures.

[Captura del anuncio publicado](visual-review/season9-announcement-published.jpg).
