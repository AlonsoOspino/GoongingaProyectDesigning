# OVERTIME PRODUCTIONS — Documentación de Marca + Propuesta de Landing

> Documento de entendimiento basado en el escaneo completo del repositorio (`README.md`, `PRODUCT.md`, `DESIGN.md`, código del frontend/minigames/launcher, assets y datos históricos). Sin código: solo comprensión mediante grafos.

---

## PARTE 1 — DOCUMENTACIÓN DE MARCA

### 1.1 Arquitectura de marca (marcas madre e hijas)

```mermaid
graph TD
    OTP["OVERTIME PRODUCTIONS (OTP)<br/>Organización madre<br/>«The official home of Goonginga League.»"]

    OTP --> GGL["GOONGINGA LEAGUE (GGL)<br/>Producto principal<br/>Liga comunitaria de Overwatch<br/>Fundada 2023 · 8 temporadas · Actual: Season 9"]
    OTP --> ST["OTP STREAM TOOLS<br/>Goonginga Game Nights<br/>Family Feud · Jeopardy"]
    OTP --> LCH["GOON LIVE LAUNCHER<br/>App Electron para control<br/>de overlays OBS en vivo"]

    GGL --> HIST["Archivo histórico<br/>GGL History + Wrapped"]
    GGL --> BCAST["Producción broadcast<br/>Twitch goongingatournament"]
```

**Lectura:** OTP es la casa editorial; GGL es el producto estrella; Stream Tools y el Launcher son herramientas de producción que refuerzan la identidad de "estudio de transmisión".

---

### 1.2 Identidad verbal

| Elemento | Valor canónico | Fuente |
|---|---|---|
| Nombre público | **Overtime Productions** (dos palabras, siempre) | Navbar |
| Abreviatura | OTP | PRODUCT.md |
| Descriptor oficial | *"The official home of Goonginga League."* | layout.tsx |
| Norte creativo | **"The Community Broadcast Arena"** | DESIGN.md |
| Principio de sistema | **"The Matchday Signal System"** | DESIGN.md |
| Definición de marca | *"A disciplined community broadcast arena for competition, league operations, and live play."* | DESIGN.md |

**Tono:** comunitario pero disciplinado; competitivo, juguetón y energético; habla como un estudio de broadcast real, no como template de torneos ni dashboard SaaS.
**Idioma:** todo el copy público en inglés.
**Regla de honestidad:** solo datos verificables (fundación 2023, 8 temporadas, 122 mapas en S8). Prohibido inventar testimonios o cifras de audiencia.

---

### 1.3 Sistema cromático ⚠️ (hallazgo clave)

Conviven **tres identidades cromáticas**. Un landing debe decidir cuál ancla la identidad pública.

```mermaid
graph LR
    subgraph A["① Especificación canónica (DESIGN.md)"]
        A1["goonginga-cyan #00a7c7"]
        A2["production-navy #172532 / deep #101a23"]
        A3["arena-beam #65e6f2"]
        A4["game-night-violet #a34cff · pink #ff4faf"]
        A5["league-paper #f2f5f7 (modo claro)"]
    end

    subgraph B["② Tema vivo implementado (frontend principal)"]
        B1["brand #1d5a3e (verde bosque)"]
        B2["ggl/accent #347a57"]
        B3["background #090c0a (negro verdoso)"]
        B4["team-a #4f7da3 vs team-b #9d4c53"]
    end

    subgraph C["③ Mundo expresivo (minigames / show)"]
        C1["violeta #a34cff · cian #30d9ff"]
        C2["feud gold #d99a2b · cream #fff0bd"]
        C3["jeopardy blue #073763 · yellow #ffff00"]
    end

    A -.->|"propone"| DEC{"DECISIÓN DE<br/>LANDING"}
    B ==>|"RECOMENDADO:<br/>ancla principal<br/>(es lo que los usuarios ya ven)"| DEC
    C -.->|"acentos puntuales<br/>(sección Game Nights)"| DEC
```

**Colores funcionales transversales:** success `#178461` · danger `#d94a59` · warning `#bd944f` · score-signal `#ffff00`.
**Colores de equipo (draft/transmisión):** Team A azul `#4f7da3/#7fb0d8` vs Team B rojo `#9d4c53/#d8848a`.

---

### 1.4 Tipografía

```mermaid
graph TD
    T["Sistema tipográfico"] --> D["DISPLAY / Titulares deportivos<br/>BigNoodleTitling (local .ttf)<br/>fallbacks: League Gothic, Impact<br/>MAYÚSCULAS · tracking apretado · interlínea ~0.73–0.82"]
    T --> N["NOMBRES DE EQUIPOS/HÉROES<br/>Barlow Condensed"]
    T --> DD["Display alternativo del draft<br/>Archivo Variable (eje width)"]
    T --> BASE["Base UI / Body<br/>Geist Sans"]
    T --> DATA["DATOS / Marcadores / Nav mono<br/>JetBrains Mono (mayúsculas, tracking 0.1em en labels)"]
```

**Escala de referencia (DESIGN.md):** Display `clamp(5.5rem → 10.8rem)` · Headline 7.2rem · Title 1.125rem/700 · Body 1rem/1.5 · Label 0.75rem/800 uppercase.

---

### 1.5 Inventario de activos de marca

```mermaid
graph LR
    ROOT["frontend/public"] --> LOGO["icon.svg — monograma «GL»<br/>gradiente teal→sky sobre #0f1115"]
    ROOT --> BM["BrandMark.tsx — símbolo «OT» SVG<br/>(barra entre dos trazos horizontales)"]
    ROOT --> SOC["icons/social/<br/>discord · twitch · instagram · tiktok · youtube"]
    ROOT --> PROC["icons/league-process/<br/>registration → captain-selection → team-draft → match-week"]
    ROOT --> MAPT["icons/map-types/<br/>control · flashpoint · hybrid · payload · push"]

    ROOT --> ART["Arte: ramattra-login.webp · winton.jpg · REINHARD.jpg<br/>community.png · PREMATCH.png · GameCards.png"]
    ROOT --> HERO["HeroImages/ ≈ 49 iconos de héroes OW"]
    ROOT --> MAPS["MapImages/ = 29 ilustraciones de mapas"]

    S8["history/season-8/ (65 archivos)"] --> GF["grand-final/"]
    S8 --> PL["players/ (14 fotos)"]
    S8 --> TL["teams/logos (9 equipos)"]
    S8 --> WR["wrapped/: imágenes · soundtrack (5) · story-audio (14) · videos (10)"]

    MG["minigames/public"] --> MGA["dva-sombra-playing.jpg · family-feud-stage.png<br/>feud-winton.webp · jeopardy-podium.png"]
```

---

### 1.6 Ecosistema de superficies y audiencias

```mermaid
graph TD
    AUD["Audiencias (prioridad oficial, PRODUCT.md)"]
    AUD --> A1["① Jugadores y participantes"]
    AUD --> A2["② Comunidad y espectadores"]
    AUD --> A3["③ Managers y personal de producción"]

    SUB["Superficies existentes"]
    SUB --> PUB["Públicas: /season-9 · /history · /news · /standings · /teams · /schedule · /stats · /wrapped · /login"]
    SUB --> OPS["Operativas: dashboards admin/manager/captain/casting/editor/social/dev · Announcement Studio"]
    SUB --> LIVE["En vivo: /draft-table/[id] · overlays OBS (/overlay/*) · Launcher Electron"]
    SUB --> MG["Minigames: /feud · Jeopardy (app separada)"]

    A1 --> PUB
    A2 --> PUB
    A3 --> OPS
```

**Canales oficiales:** Discord `discord.gg/QMukTWr32f` (identidad/login vía OAuth, guild `987039120004104232`) · Twitch `twitch.tv/goongingatournament`. Sin email ni formulario público: **Discord es el punto de conversión**.

---

### 1.7 Reglas de marca (del sistema de diseño)

```mermaid
graph TD
    R["Reglas nombradas (DESIGN.md)"] --> R1["Signal Rarity Rule — el color de señal es escaso;<br/>solo donde hay información viva"]
    R --> R2["Two-Voice Rule — voz operativa sobria +<br/>voz expresiva de show, nunca mezcladas"]
    R --> R3["Intensity Gradient Rule — la intensidad crece<br/>hacia lo que está EN VIVO"]
    R --> R4["Geometry-by-Mode — geometría según modo de superficie"]
    R --> R5["Program-Safe — nada rompe la transmisión"]

    X["Prohibido ✗"] --> X1["Glassmorphism generalizado"]
    X --> X2["Neón decorativo y gradientes sin función"]
    X --> X3["Tarjetas infladas 'estilo AI' / templates genéricos"]
    Y["Sombras con nombre ✓"] --> Y1["Quiet Panel · Structural Offset · Live Ambient · Interactive Lift"]
```

---

### 1.8 Prueba social verificable disponible (Season 8)

| Dato | Valor |
|---|---|
| Temporada cerrada | Season 8 ("Goonginga Season 8!", inició 2026-05-11) |
| Escala | 9 equipos · 45 jugadores · 122 mapas · 13 semanas |
| Totales | 8.506.600 daño · 4.626.730 curación · 2.791.754 mitigación |
| Metas | Mapa más elegido: Lijiang Tower (16) · Héroe más baneado: Kiriko (27) |
| Líderes | OTISDIK (daño) · SHELLBLADE (curación) · Arterrat (mitigación) |
| Campeón regular | No Tank? (7-1) · Gran Final jugada 2026-08-08 |

---

## PARTE 2 — PROPUESTA DE LANDING PAGE

### 2.0 Problema actual

`/` redirige directamente a `/season-9`: no existe un landing de marca. El visitante nuevo aterriza en una página operativa austera, sin entender qué es OTP/GGL, cuándo es la próxima transmisión ni cómo entrar. Los commits recientes ("redesign overtime landing experience") confirman la intención.

**Objetivo del landing:** convertir al visitante en miembro (Discord) o espectador (Twitch) en <10 segundos, usando la estética "Community Broadcast Arena".

---

### 2.1 Concepto creativo: «THE MATCHDAY SIGNAL»

El landing se comporta como **la señal previa al partido**: una sala de transmisión comunitaria que pasa de "quieto" (marca) a "en vivo" (acción). La intensidad visual crece a medida que el usuario scrollea hacia lo vivo (Intesity Gradient Rule aplicada al scroll).

```mermaid
graph LR
    Q["QUIET<br/>Marca + promesa<br/>navy/paper + señal mínima"] --> W["WARM-UP<br/>Qué es GGL + proceso<br/>verde GGL + datos reales"]
    W --> L["LIVE<br/>Próximo partido + watch<br/>señal máxima (cyan/beam)"]
    L --> A["AFTERPARTY<br/>Wrapped S8 + comunidad<br/>acento expresivo violeta/gold"]
```

---

### 2.2 Mapa de secciones (anatomía vertical)

```mermaid
graph TD
    S0["NAV — sticky blur mono<br/>Overtime Productions · GGL · History · News · [Join Discord] · [Log in]"]

    S0 --> HERO["① HERO — 'THE COMMUNITY BROADCAST ARENA'<br/>Eyebrow mono: GOONGINGA LEAGUE · SEASON 9<br/>H1 BigNoodle gigante · Sub: liga por temporadas desde 2023<br/>CTA primario: JOIN GGL (→Discord) · secundario: WATCH (→Twitch)<br/>Fondo: arte Ramattra/Winston tratado, beam sutil animado"]

    HERO --> TICKER["② SIGNAL BAR — cinta mono en movimiento<br/>SEASON 9 · REGISTRATION OPEN · GRAND FINAL S8 REPLAY ON TWITCH<br/>· 9 TEAMS · 45 PLAYERS · 122 MAPS PLAYED LAST SEASON"]

    TICKER --> WHAT["③ QUÉ ES GGL — dos columnas<br/>Izq: statement editorial grande<br/>Der: tarjeta operativa con estado de temporada (badge-signal)<br/>Copy: registration → captains → draft → match weeks"]

    WHAT --> PROCESS["④ EL PROCESO — 4 pasos horizontales<br/>iconos league-process existentes (SVG)<br/>REGISTRATION / CAPTAIN SELECTION / TEAM DRAFT / MATCH WEEK<br/>línea conectora tipo timeline de producción"]

    PROCESS --> NOW["⑤ LO VIVO — 'NEXT SIGNAL'<br/>próxima fecha o estado de Season 9<br/>formato confirmado: hero bans (máx 2 por rol por mapa)<br/>tarjeta estilo match-header con team colors azul/rojo<br/>si NO hay fecha: countdown + 'format confirmed' card"]

    NOW --> HISTORY["⑥ EL ARCHIVO — 'EIGHT SEASONS DEEP'<br/>métricas S8 en JetBrains Mono grandes<br/>mini-mosaico: logos de los 9 equipos + foto Gran Final<br/>CTA: EXPLORE GGL HISTORY → /history · WATCH THE WRAPPED → /wrapped"]

    HISTORY --> SHOW["⑦ GAME NIGHTS — franja expresiva (única sección con paleta show)<br/>violeta/gold: Family Feud + Jeopardy<br/>'Not every night is a match night.'<br/>arte: family-feud-stage.png · dva-sombra-playing.jpg"]

    SHOW --> COMMUNITY["⑧ COMUNIDAD — 'THE ARENA IS THE PEOPLE'<br/>foto community.png · mosaico jugadores S8<br/>quote real del Wrapped: THANK YOU FOR SHOWING UP.<br/>CTA: JOIN THE DISCORD"]

    COMMUNITY --> FOOT["⑨ FOOTER — lockup OTP + monograma GL<br/>social icons (los 5 SVG) · mapa de rutas públicas<br/>© Overtime Productions"]

    style HERO fill:#101a23,color:#65e6f2
    style NOW fill:#17221b,color:#ffff00
    style SHOW fill:#230c12,color:#ff4faf
```

---

### 2.3 Flujo de conversión (journeys de usuario)

```mermaid
flowchart TD
    V["Visitante llega a /"] --> H["HERO (≤3 seg):<br/>entiende QUÉ es y DÓNDE hacer clic"]

    H --> P{"¿Quién eres?"}

    P -->|"Quiero jugar"| J1["CTA JOIN GGL → Discord invite<br/>perfil Network Member + registro de temporada"]
    P -->|"Quiero mirar"| J2["CTA WATCH → Twitch<br/>o replay de la Gran Final S8"]
    P -->|"¿Qué es esto?"| J3["Scroll → sección QUÉ ES + PROCESO<br/>→ entiende el formato de liga"]
    P -->|"Ya soy de la comunidad"| J4["Nav: GGL → /season-9<br/>History → /history · News → /news"]
    P -->|"Curiosidad/nostalgia"| J5["Sección ARCHIVO → Wrapped S8<br/>(experiencia audiovisual cinematográfica)"]

    J1 & J2 --> CV["CONVERSIÓN: miembro Discord / espectador Twitch"]
    J3 --> H2["Refuerzo: NEXT SIGNAL (fecha/countdown)"] --> CV
    J5 --> CV

    style CV fill:#102c20,color:#347a57
```

---

### 2.4 Coreografía visual por sección (sin código)

| # | Sección | Movimiento | Intensidad |
|---|---|---|---|
| ① | Hero | Entrada typewriter en eyebrow; H1 cae con easing `--ease-out`; beam de fondo respira lento | Media-alta |
| ② | Ticker | Marquee continuo mono, pausa on-hover | Baja constante |
| ③④ | Qué es / Proceso | Reveal escalonado on-scroll; línea de timeline se dibuja (scaleX) | Baja |
| ⑤ | Next Signal | Badge pulsante (`pulse-glow`); countdown mono; colores de equipo solo aquí | **ALTA (pico)** |
| ⑥ | Archivo | Mosaico de logos con lift interactivo; números que cuentan hasta su valor | Media |
| ⑦ | Game Nights | Cambio de mundo cromático (violeta/gold); micro-animaciones teatrales | Media-expresiva |
| ⑧⑨ | Comunidad/Footer | Fade sereno; cierre quieto | Baja |

**Accesibilidad:** respetar `prefers-reduced-motion` (ya existe globalmente); focus visible `#88ad95`.

---

### 2.5 Copy propuesto (inglés, tono de marca)

| Bloque | Copy |
|---|---|
| Hero eyebrow | `GOONGINGA LEAGUE — SEASON 9` |
| Hero H1 | `THE COMMUNITY BROADCAST ARENA` |
| Hero sub | *Eight seasons of drafted teams, weekly broadcasts, and one loud Discord server. This is where it all plays out.* |
| CTAs | `JOIN GGL` · `WATCH LIVE` |
| Ticker items | `SEASON 9 UNDERWAY` • `FORMAT CONFIRMED: MAX 2 HERO BANS PER ROLE PER MAP` • `S8: 122 MAPS · 45 PLAYERS · 9 TEAMS` |
| Qué es (statement) | *Overtime Productions runs the Goonginga Overwatch League — a full-season amateur competition with real drafts, real standings, and a production crew behind every broadcast.* |
| Proceso labels | `01 REGISTRATION` → `02 CAPTAIN SELECTION` → `03 TEAM DRAFT` → `04 MATCH WEEK` |
| Next Signal heading | `NEXT SIGNAL` |
| Archivo heading | `EIGHT SEASONS DEEP.` |
| Archivo stats | `122 maps played` · `45 players` · `13 weeks` · `4.6M healing done` |
| Game Nights | `NOT EVERY NIGHT IS A MATCH NIGHT.` — *Game Nights bring Family Feud and Jeopardy to the stream.* |
| Comunidad | `THE ARENA IS THE PEOPLE.` — *Thank you for showing up.* |

---

### 2.6 Decisiones abiertas (requieren definición)

```mermaid
graph TD
    D{"Decisiones pendientes"} --> D1["① ¿Ancla cromática?<br/>RECOMENDADO: verde GGL (#1d5a3e) como base,<br/>cyan de señal (#00a7c7) solo para 'lo vivo',<br/>violeta/gold solo en Game Nights"]
    D --> D2["② ¿Ruta? /landing dedicada vs.<br/>rediseñar /season-9 como home híbrida<br/>RECOMENDADO: home híbrida en /"]
    D --> D3["③ Hero art: Ramattra (login), Winston (minigames)<br/>o composición propia con héroes/mapas existentes"]
    D --> D4["④ Idioma: copy 100% inglés (regla actual)<br/>vs. bilingüe si la comunidad lo pide"]
```

---

### 2.7 Resumen ejecutivo

El landing debe vender **tres verdades verificables** en un scroll: (1) esta es una liga real con historia (8 temporadas, datos duros), (2) está viva ahora mismo (Season 9 + señal de próximo evento), y (3) entrar es un clic (Discord/Twitch). Todo con el lenguaje visual ya definido: BigNoodle para gritar, JetBrains Mono para informar, verde GGL para habitar, y color de señal reservado exclusivamente para lo que está en juego.
