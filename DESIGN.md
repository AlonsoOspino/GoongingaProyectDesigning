---
name: Goonginga
description: A disciplined community broadcast arena for competition, league operations, and live play.
colors:
  goonginga-cyan: "#00a7c7"
  goonginga-cyan-hover: "#16bdd9"
  arena-beam: "#65e6f2"
  arena-beam-muted: "#73c9d9"
  production-navy: "#172532"
  production-navy-deep: "#101a23"
  production-navy-elevated: "#202f3c"
  production-navy-secondary: "#293a47"
  league-paper: "#f2f5f7"
  league-surface: "#f8fafb"
  league-ink: "#172530"
  league-muted: "#657783"
  league-border: "rgba(160, 185, 200, 0.28)"
  game-night-violet: "#a34cff"
  game-night-pink: "#ff4faf"
  game-night-cyan: "#30d9ff"
  show-amber: "#f2b45f"
  scoreboard-blue: "#073763"
  score-signal: "#ffff00"
  feud-show-blue: "#123e78"
  feud-show-blue-deep: "#061a38"
  feud-show-cream: "#fff0bd"
  feud-show-gold: "#d99a2b"
  feud-show-brass: "#7b4512"
  feud-show-red: "#a82832"
  feud-show-team-blue: "#1e5aa2"
  feud-stage-burgundy: "#641c27"
  feud-stage-burgundy-deep: "#230c12"
  success: "#178461"
  danger: "#d94a59"
typography:
  display:
    fontFamily: "BigNoodleTitling, League Gothic, sans-serif"
    fontSize: "clamp(5.5rem, 10.2vw, 10.8rem)"
    fontWeight: 400
    lineHeight: 0.73
    letterSpacing: "-0.018em"
  headline:
    fontFamily: "BigNoodleTitling, League Gothic, sans-serif"
    fontSize: "7.2rem"
    fontWeight: 400
    lineHeight: 0.82
    letterSpacing: "normal"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.1em"
  data:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "108px"
components:
  button-primary:
    backgroundColor: "{colors.goonginga-cyan}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 24px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.arena-beam}"
    textColor: "{colors.production-navy-deep}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 24px"
    height: "52px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.league-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 18px"
    height: "44px"
  card-operational:
    backgroundColor: "{colors.league-surface}"
    textColor: "{colors.league-ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  card-broadcast:
    backgroundColor: "{colors.production-navy-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "{spacing.lg}"
  input:
    backgroundColor: "{colors.league-surface}"
    textColor: "{colors.league-ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  badge-signal:
    backgroundColor: "{colors.goonginga-cyan}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
---

# Design System: Goonginga

## Overview

**Creative North Star: "The Community Broadcast Arena"**

Goonginga is a shared digital arena where community, competition, league operations, and broadcast production meet. Its character is disciplined, electric, competitive, confident, broadcast-native, and community-driven: league-first and editorial in public, compact and state-led in operations, and selectively theatrical on air. Energy comes from typography, composition, contrast, information hierarchy, motion, competitive states, and broadcast language—not from indiscriminate neon.

**System principle: "The Matchday Signal System."** Every surface belongs to the same arena, but signal intensity scales with context. Public League is the primary league-first editorial and competitive experience; matchday and live surfaces amplify urgency; Manager compresses into flat, controlled, information-dense structures; OBS views become extremely state-led and legible. Family Feud is a secondary three-surface stream machine—Player Join, Host Control, and Broadcast / OBS—not another product ecosystem. Its broadcast alone adopts classic late-1970s/1980s television-game-show language while its control room remains operational.

**Key Characteristics:**

- Condensed, uppercase display typography paired with direct, highly legible sans-serif text.
- Production Navy and League Paper form the two principal environments; Goonginga Cyan is a selective signal.
- Strong compositional hierarchy, asymmetry, editorial imagery, score language, and directional geometry.
- Hybrid elevation that becomes flatter in operational contexts and more dimensional in public or theatrical contexts.
- Confident, state-led components: restrained geometry for operations, structured geometry for editorial surfaces, expressive geometry for theatrical moments.
- A shared design language across distinct intensity modes, never separate visual products.
- Public League keeps Season 9, Teams, Schedule / Results, Standings, Stats, and News in primary navigation; Stream Tools remains secondary.
- Family Feud separates audience theatre from off-air operator controls and diagnostics.

## Colors

The palette is a cool signal system anchored by navy and paper. Cyan establishes identity and state; violet and amber are contextual expressive colors rather than universal decoration.

### Primary

- **Goonginga Cyan** (#00a7c7): the primary brand and signal color for active navigation, key actions, focus, live state, and concise competitive emphasis.
- **Arena Beam** (#65e6f2): the brighter high-energy edge used for hover escalation, illuminated rules, live markers, and rare peak emphasis.

### Secondary

- **Game Night Violet** (#a34cff): a contextual color for playful, event-driven, and minigame experiences; it is not the default secondary color of every product surface.
- **Game Night Pink** (#ff4faf): a supporting theatrical accent for game-night effects, energetic gradients, and expressive states where the minigame mode calls for it.

### Tertiary

- **Show Amber** (#f2b45f): selective theatrical emphasis for scores, events, reveal moments, attention, and stage-like UI.
- **Score Signal** (#ffff00): a high-visibility scoreboard value reserved for trivia and broadcast scoring contexts.
- **Success** (#178461) and **Danger** (#d94a59): functional outcome colors; preserve their semantic meaning.

### Family Feud Theatrical

- **Show Blue** (#123e78) and **Show Blue Deep** (#061a38): the physical answer board, question fascia, and recessed board depth.
- **Show Cream** (#fff0bd), **Show Gold** (#d99a2b), and **Show Brass** (#7b4512): marquee lamps, lettering, trim, and stage framing with an intentionally physical television-set character.
- **Show Red** (#a82832) and **Show Team Blue** (#1e5aa2): explicit opposing team placards and scoring identity; never collapse the teams into ambiguous accent treatments.
- **Stage Burgundy** (#641c27) and **Stage Burgundy Deep** (#230c12): curtain bands and the dark theater perimeter around the board.

These are contextual Family Feud broadcast tokens. They do not replace Goonginga Cyan, Production Navy, League Paper, or the functional color roles, and they must not leak into universal navigation or product chrome.

### Neutral

- **Production Navy** (#172532): the principal dark environment for competitive, operational, and broadcast contexts.
- **Production Navy Deep** (#101a23): the deepest structural layer and immersive background.
- **Production Navy Elevated** (#202f3c) and **Production Navy Secondary** (#293a47): tonal separation for nested dark surfaces without relying on shadow.
- **League Paper** (#f2f5f7): the editorial/public canvas and high-readability background.
- **League Surface** (#f8fafb): cards, tables, inputs, and quiet light surfaces.
- **League Ink** (#172530): primary text on light backgrounds.
- **League Muted** (#657783): supporting copy and metadata on light backgrounds.
- **League Border** (rgba(160, 185, 200, 0.28)): structural separation, dividers, input boundaries, and quiet card outlines.
- **Scoreboard Blue** (#073763): a contextual broadcast/trivia field color.

### Named Rules

**The Signal Rarity Rule.** Goonginga Cyan identifies action, state, or priority; it must never become undifferentiated surface paint.

**The Color-Independent Hierarchy Rule.** A screen must remain understandable when most accent color is removed; composition, type, spacing, and contrast carry the structure first.

**The Contextual Expression Rule.** Violet, pink, amber, score yellow, and the Family Feud show palette belong to explicit game-night, theatrical, or scoring contexts, not to the universal product chrome.

**The Physical Show Palette Rule.** Family Feud Broadcast uses burgundy curtain, brass-and-cream marquee, deep-blue answer-board, and explicit blue/red team colors as stage materials—not as global brand accents.

## Typography

**Display Font:** BigNoodleTitling, with League Gothic and condensed sans-serif fallbacks

**Body Font:** Inter, with system sans-serif fallbacks

**Label/Mono Font:** Inter for labels; JetBrains Mono for scores, timers, and compact data

**Character:** The pairing behaves like a modern match broadcast: oversized condensed headlines provide confidence and competitive presence, while Inter keeps navigation, operations, and explanatory content calm. JetBrains Mono marks precise, changing, or score-like data.

### Hierarchy

- **Display** (400, clamp(5.5rem, 10.2vw, 10.8rem), 0.73): hero statements, season identifiers, major live states, and theatrical titles; uppercase and tightly stacked.
- **Headline** (400, 7.2rem desktop with responsive reduction, 0.82): public section headings and major editorial transitions.
- **Title** (700, 1.125rem, 1.3): component and operational section titles that must scan quickly.
- **Body** (400, 1rem, 1.5 minimum): explanations, league content, form guidance, and operational copy; longer public passages may open toward 1.7–1.8 line-height.
- **Label** (800, 0.75rem, 0.1em, uppercase): states, eyebrows, categories, controls, and broadcast metadata.
- **Data** (700, 1rem, 1.2): scores, season metrics, timers, identifiers, and values where alignment matters.

### Named Rules

**The Two-Voice Rule.** Condensed display type announces the arena; Inter explains and operates it. Do not make dense tools read like posters or public headlines read like admin tables.

**The Broadcast Label Rule.** Uppercase labels must stay short, high-contrast, and attached to a real state, category, or action.

## Layout

Public League surfaces use a wide editorial container (up to 1500px with 28px desktop gutters) and generous section rhythm (108px at full width). Hero and feature compositions favor asymmetric grids, oversized type, full-bleed media, strong vertical rules, score modules, and alternating light/dark environments. The primary public breakpoints cluster around 1100px, 900px, 760px, and 640px; complex grids collapse to a single column before text or media becomes cramped. League content and competition lead the information architecture; the persistent primary navigation exposes Season 9, Teams, Schedule / Results, Standings, Stats, and News, while Stream Tools is a secondary destination.

Manager surfaces use denser grids, compact rows, predictable alignment, and shorter spacing intervals. They are flat and state-led: information groups are separated through borders, dividers, tonal contrast, and whitespace before containers are added. Family Feud is limited to three coordinated surfaces: Player Join for participation, Host Control for operation, and Broadcast / OBS for program output. The Broadcast / OBS surface composes inside a protected 16:9 safe area with oversized scores, explicit team placards, and responsive clamp-based typography; on connection loss it holds the last confirmed board instead of replacing program content with diagnostics.

**The Intensity Gradient Rule.** Operational layouts are restrained and dense; editorial layouts are structured and spacious; theatrical layouts are expressive and staged. All three retain the same signal hierarchy.

**The Useful Information Rule.** Never remove useful league or operational information to manufacture minimalism. Recompose, group, sequence, or progressively disclose it instead.

**The Three-Surface Rule.** Family Feud is a stream machine with Player Join, Host Control, and Broadcast / OBS. Do not expand it into a standalone minigame dashboard or parallel product ecosystem.

## Elevation & Depth

The system uses hybrid elevation. Hierarchy comes first from tone, structure, borders, spacing, and composition. Manager and Family Feud Host Control surfaces stay mostly flat; public/editorial media may use structural offset shadows. Family Feud Broadcast creates depth as a physical set—curtain perimeter, brass frame, cream marquee, inset blue board—rather than translucent floating panels. A user must still understand hierarchy if every shadow is removed.

### Shadow Vocabulary

- **Quiet Panel** (0 14px 36px rgba(35, 43, 51, 0.08)): restrained lift for select public light surfaces, never every card.
- **Structural Offset** (18px 18px 0 #202f3c or -18px 18px 0 #dce5ea): directional editorial depth that visibly participates in composition.
- **Live Ambient** (0 24px 70px rgba(0, 0, 0, 0.35)): atmospheric separation for scorecards and overlays on photographic or live backgrounds.
- **Interactive Lift** (0 10px 24px rgba(16, 26, 35, 0.20)): brief hover reinforcement for important actions.

### Named Rules

**The Shadow-Optional Rule.** Tone, border, spacing, and composition must communicate hierarchy before any shadow is added.

**The Context-Scaled Depth Rule.** The more operational the surface, the flatter it becomes; the more public, live, or theatrical the surface, the more dimensional it may become.

## Shapes

Small radii are the default: 4px for actions and compact controls, 6px for fields and operational containers, and 8px for larger editorial cards. Directional bars, skewed rules, clipped corners, hard edges, and offset media frames create the expressive competitive language without requiring ornamental chrome.

Circles and pills are reserved for semantics that naturally benefit from them: avatars, presence indicators, score markers, toggles, segmented controls, compact badges, tags, and occasional icon-only actions. Theatrical modes may introduce larger or more expressive silhouettes when the shape reinforces a game state or stage interaction. Family Feud Broadcast specifically uses a framed marquee silhouette, squared physical answer tiles, and clearly bounded team placards; Host Control does not inherit this ornamental framing.

**The Geometry-by-Mode Rule.** Operational means restrained geometry; editorial means structured geometry; theatrical means expressive geometry.

**The Semantic Curve Rule.** A pill or circle must communicate identity, state, grouping, or control behavior—not generic friendliness.

## Components

**Component philosophy: "Confident and state-led — angular and tactile when expressive, compact and restrained when operational."**

### Buttons

- **Shape:** compact controls use gently squared corners (4–6px); expressive primary actions may use clipped opposing corners.
- **Primary:** Goonginga Cyan, strong white or deep-navy contrast, 52px public height, and concise uppercase labeling.
- **Hover / Focus:** hover escalates toward Arena Beam with a small directional lift; focus-visible uses a clear cyan ring or outline with offset.
- **Secondary / Ghost:** transparent or tonal, defined by a real border and quieter contrast; no decorative glass layer is required.
- **Danger:** reserved for destructive actions and remains semantically red.

### Chips

- **Style:** compact, information-first, and usually tonal or outlined. Pills are valid only because chips communicate grouping, selection, or tags.
- **State:** selection strengthens border, text, or semantic fill; color always maps to a real category or state.

### Cards / Containers

- **Corner Style:** 6–8px for the shared system; larger theatrical radii are local exceptions.
- **Background:** League Surface on editorial/light UI; tonal Production Navy layers on dark operational or broadcast UI.
- **Shadow Strategy:** flat by default in tools, structural offset in selected editorial media, ambient only in live or theatrical contexts.
- **Border:** use League Border or a mode-appropriate tonal divider to establish hierarchy.
- **Internal Padding:** 16px operational baseline, expanding to 24–34px for public or theatrical compositions.

### Inputs / Fields

- **Style:** clear 1px border, League Surface or a deep navy input field, 6–8px radius, and compact 8–12px internal spacing.
- **Focus:** border or ring shifts to Goonginga Cyan; never rely on glow alone.
- **Error / Disabled:** errors use the danger role with readable text; disabled fields reduce emphasis while remaining identifiable.

### Navigation

Navigation is compact, direct, and state-led. Public League primary navigation exposes Season 9, Teams, Schedule / Results, Standings, Stats, and News; Stream Tools is visually and structurally secondary. Active items use a clear filled or underlined signal; inactive items remain quiet but readable. Public navigation may invert over the dark home hero. Mobile navigation becomes a straightforward stacked list rather than a decorative drawer.

### Signal Label

Eyebrows, live markers, phase badges, and score labels combine short uppercase copy, strong weight, restrained tracking, and a line, dot, or bar. They are the reusable voice of the Matchday Signal System and must always communicate a real state or category.

### Broadcast Score Module

Scores and timers use condensed display or monospaced data, strong contrast, explicit team color, stable alignment, and safe-area spacing. Distance readability and state clarity outrank stylistic novelty.

### Family Feud Stream Machine

- **Player Join:** a direct invitation/join flow with only the information required to enter and participate; it does not expose a minigame dashboard.
- **Host Control:** a dark, restrained operator surface with compact flat groups, live program-state monitoring, explicit confirmations for consequential actions, and server-backed exact undo for the last eligible response or strike.
- **Broadcast / OBS:** a clean 16:9 program frame using classic late-1970s/1980s television-game-show language: burgundy curtains, brass-and-cream marquee, a physical deep-blue answer board, and explicit blue/red team placards.
- **Program behavior:** reveals are restrained and state-driven. During connection recovery, retain the last-known-good confirmed board with a subtle hold signal. Reconnection details, debug state, and other diagnostics stay off-air and belong in Host Control.

**The Program-Safe Rule.** Never replace the Family Feud program image with loading, error, or reconnection diagnostics while a last-known-good board exists.

## Do's and Don'ts

### Do:

- **Do** use Goonginga Cyan selectively for action, active state, focus, and competitive emphasis.
- **Do** build hierarchy with typography, composition, contrast, spacing, tone, and borders before adding depth.
- **Do** let public, operational, broadcast, and minigame surfaces change intensity while preserving shared typography, signals, and product identity.
- **Do** keep Manager Dashboard components compact, predictable, and information-first.
- **Do** keep Public League league-first, with Season 9, Teams, Schedule / Results, Standings, Stats, and News primary and Stream Tools secondary.
- **Do** keep Family Feud to Player Join, Host Control, and Broadcast / OBS, with operational truth in Host Control and theatrical expression on air.
- **Do** require clear confirmations for consequential Family Feud actions and expose only server-backed exact undo for eligible response or strike changes.
- **Do** protect the Family Feud 16:9 safe area and hold the last-known-good confirmed board through transient connection loss.
- **Do** use theatrical color, motion, and geometry when they reinforce a real event, score, reveal, or game state.
- **Do** preserve responsive readability, reduced-motion behavior, OBS stability, and useful information.

### Don't:

- **Don't** redesign Goonginga as a generic SaaS dashboard or generic AI-generated esports template.
- **Don't** use glassmorphism, neon, glow, gradients, or cyberpunk styling as the entire identity.
- **Don't** apply universal card shadows, arbitrary elevation levels, excessive blur, or floating panels everywhere.
- **Don't** default to pills, oversized rounded cards, nested rounded containers, or decorative corner treatments without purpose.
- **Don't** make every component loud or spread contextual violet, pink, amber, score yellow, or Family Feud show colors across universal product chrome.
- **Don't** turn Family Feud into a product ecosystem, decorate its Host Control like the on-air set, or put diagnostics on the Broadcast / OBS output.
- **Don't** use ambiguous team accents, restless reveal motion, or an empty error screen where the confirmed Family Feud board can remain on air.
- **Don't** remove useful information, weaken broadcast legibility, or replace real data with invented visual filler.
