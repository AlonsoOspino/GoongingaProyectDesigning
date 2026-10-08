# Nuevos proyectos para OTP

Actualizado: 2026-09-26. Propuestas construidas sobre las rutas de torneos,
draft, overlays, Game Nights, Discord OAuth y la API ya presentes. La limpieza y
la protección básica de uploads son preparación; los siguientes proyectos deben
generar capacidades nuevas que se puedan demostrar en el portafolio.

| Prioridad | Proyecto nuevo | MVP concreto | Evidencia de portafolio |
| --- | --- | --- | --- |
| 1 | **Broadcast Control Room** | Consola web para operador con estado de partida, cambios de escena OBS mediante un conector autenticado, vista previa de overlays, cola de acciones y botón para volver al estado seguro. | Demo de una partida completa, registro de acciones, reconexión automática y tiempo desde una acción hasta el overlay. |
| 2 | **Audience Pulse para Twitch** | El operador abre y cierra una encuesta nativa de Twitch desde OTP; los viewers votan dentro de Twitch. El backend recibe progreso y cierre por EventSub, guarda el resultado y lo publica al overlay OBS. | Demo en directo sin cambiar de pantalla, sincronización de votos, reconexión y resultado final verificable. |
| 3 | **Tournament Command Center** | Flujo guiado para crear temporada, inscribir equipos, revisar elegibilidad, publicar calendario y resolver conflictos antes de activar partidos. | Caso de uso administrativo de principio a fin, matriz de permisos y tiempo necesario para preparar una jornada. |
| 4 | **OTP Reliability Lab** | Entorno de ensayo que reproduce fallos de API, pérdida de conexión OBS/SSE y restauración de PostgreSQL más medios, con trazas y alertas. | SLO de disponibilidad/latencia, panel de OpenTelemetry y simulacro con RPO/RTO medidos. |
| 5 | **Sponsor Impact Studio** | Bloques de patrocinio configurables para overlays y páginas, reglas por torneo/partida y reporte de exposición basado en eventos emitidos por la plataforma. | Demo con marca ficticia, exportación de reporte y trazabilidad de cada aparición sin inventar audiencia ni ingresos. |
| 6 | **League Platform API** | Contrato OpenAPI versionado, validación de entrada, claves de integración con alcance limitado, webhooks firmados para cambios de partidas y un SDK pequeño. | Integración externa de ejemplo, pruebas de contrato y escenario de rotación/revocación de claves. |

## Ruta recomendada

1. **Broadcast Control Room**: aprovecha los overlays existentes y elimina la
   dependencia de una aplicación local. Una demo en vivo enseña backend, UX,
   autorización y resiliencia en una sola historia.
2. **Audience Pulse para Twitch**: una encuesta nativa de mapa sirve como MVP.
   Twitch cuenta los votos; OTP sincroniza los resultados con su API y overlay.
   El público nunca necesita abrir la web. La cuenta del canal debe tener acceso
   a encuestas de Twitch (Affiliate o Partner) y autorizar
   `channel:manage:polls`.
   Si el canal no cumple ese requisito, la alternativa sigue dentro de Twitch:
   votar con comandos en el chat y contar un voto por usuario mediante el evento
   `channel.chat.message`. En ese caso OTP administra el recuento.
3. **Tournament Command Center**: convierte la administración actual en un
   producto que otra organización podría entender y operar.
4. **OTP Reliability Lab** y **League Platform API**: aportan la evidencia
   corporativa de operación, observabilidad, seguridad y diseño de integración.

Cada proyecto debería cerrar con demo, diagrama de arquitectura, pruebas
significativas, una decisión técnica escrita y una métrica observada. Las
integraciones Twitch y OBS se basan en [Polls y EventSub](https://dev.twitch.tv/docs/api/polls)
y el [protocolo obs-websocket](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md);
para la telemetría JavaScript existe [OpenTelemetry](https://opentelemetry.io/docs/languages/js/).
