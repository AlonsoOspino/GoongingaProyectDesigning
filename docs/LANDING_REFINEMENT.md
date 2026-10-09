# Ajustes de la landing

8 de octubre de 2026. Se conservan los cubos iluminados del fondo original con movimiento suave. Se retiró la capa verde opaca: el fondo vuelve a ser oscuro y el verde queda en los cubos, los títulos y las acciones. La composición original de GGL se conserva, con texto a la izquierda e imagen a la derecha.

| Área | Dirección final |
| --- | --- |
| Fondo de la landing | Conservar los cubos verdes iluminados en portada, GGL, Game Nights, Discord, cabecera y pie; iluminación contenida y movimiento más tranquilo |
| Ilustraciones | Retirar únicamente la máscara de celdas que recortaba las imágenes; mantener el arte completo sobre el fondo de cubos |
| Portada | Reinhardt visible a la derecha y contraste suficiente para leer el título y las acciones |
| GGL | Composición original, cierre explícito de Season 8 (Gamin 4 Goonginga 4–2 No Tank?) y presentación de Season 9 |
| Game Nights | Arte amplio y una frase sobre los juegos y eventos de la comunidad |
| Discord | Título en dos líneas, peluche a la derecha y enlace directo para participar |
| Introducción | Retirar la banda independiente de WhoWeAre; evitar repetir el contexto de la portada |
| Equipos y estadísticas | Logos y bordes de identidad sobre superficies tranquilas; reducir fondos multicolor y brillos |
| Season 9 | Nueva composición alineada, dos divisiones, equipos formados por comité y objetivo de ocho equipos; eliminar catálogo interactivo de mapas |

Las mejoras de presentación conservan las integraciones de anuncios, miembros, inscripción, estadísticas, draft y transmisión.

## Verificación

Typecheck y compilación de producción correctos. La compilación usó `NEXT_DIST_DIR=.next-season9-check` para mantener funcionando la vista de desarrollo. Información de Season 9 comprobada en escritorio y a 390 px, sin desbordamiento horizontal ni catálogo de mapas. El estado de Season 8 ya no controla las fases de Season 9.

Capturas de Season 9: [escritorio](visual-review/season-9-information-desktop.jpg), [móvil](visual-review/season-9-information-mobile.jpg) y [fases](visual-review/season-9-information-schedule.jpg). Ver [motor de divisiones](SEASON_9.md) para el cambio de calendario y datos.

## Imagen de Discord

Fuente: `C:/Users/PC/Downloads/ntonnnn.png`. El damero claro estaba incrustado en los píxeles y el archivo no tenía transparencia. La versión utilizada, [winton-discord.png](../migration-uidesign/frontend/public/winton-discord.png), se preparó con `image_gen` para retirar ese fondo. Es una edición generada del adjunto, no un recorte exacto píxel por píxel. Se conserva la fuente original.
