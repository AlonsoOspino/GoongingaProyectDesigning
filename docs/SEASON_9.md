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
