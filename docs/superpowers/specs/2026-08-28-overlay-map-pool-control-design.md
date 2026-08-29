# Overlay map pool control — design

Date: 2026-08-28
Branch: feature/announcement-studio

## Problem

The map pool overlay is a static 4-column grid in a gold/grey palette that
nobody can drive during a broadcast. There is no way for the manager to point
the audience at one map type, and the wincards overlay carries the same dated
treatment. Reference art supplied by the user shows a slanted-card fan with a
neon-framed hero card; the league palette is green, so the reference purple is
translated, not copied.

## Scope

1. A manager-driven focus channel that reaches an OBS browser source.
2. Map pool overlay redesigned with two states: normal pool, and one map type
   expanded plus zoomed.
3. Wincards overlay redesigned as match cards carrying the winning team logo,
   with a waiting-for-captain strip.
4. An interactive control panel in `/manager-dashboard` during draft `STARTING`.

Out of scope: realtime transport (no websockets exist; polling stays), any
change to draft rules, any change to which maps are in a pool.

## Control channel

The overlay runs in OBS, a separate browser process, so `localStorage` and
`BroadcastChannel` cannot carry state. The channel is two nullable columns on
`Match`:

```prisma
overlayFocusType  MapType?
overlayFocusMapId Int?
```

`Match` rather than `DraftTable` because the match row always exists — the pool
overlay is used in the pre-show, before a draft is created. No `overlayView`
enum: "normal" versus "focused" is just whether `overlayFocusType` is null.

- Write: `PATCH /match/manager/:id/overlay`, `authMiddleware + managerMiddleware`,
  body `{ focusType, focusMapId }`. A dedicated route rather than the existing
  `managerUpdate`, which fires a Discord schedule-change notification on every
  call and would spam the channel once per click.
- Read: none added. Overlays already call the public `getMatchById`; the new
  columns ride along.
- Poll: the map pool overlay drops from 10s to 1.2s and stops refetching the
  map catalogue on every tick (it is static; fetch once).

## Visual language

Shared tokens live in `app/overlay/components/overlay-theme.css` so the two
overlays cannot drift.

| Reference | OTP |
|---|---|
| purple field `#2b1a5e` | `#070c09` over a `#102c20` radial vignette |
| neon violet `#a855f7` | `--pool-neon #3ee08a`, core `--pool-neon-hot #7dffbe` |
| orange win glow | `--color-team-a #4f7da3` / `--color-team-b #9d4c53` |
| violet card frame | `--color-brand-bright #347a57` at rest, neon on focus |

Slanted cards use `clip-path: polygon()` at roughly 7 degrees, not
`transform: skew`, so the map art inside stays undistorted. Display type is
Bebas Neue (`--font-accent`) with `skewX(-6deg)` to follow the card lean; HUD
labels are JetBrains Mono, uppercase, wide tracking. Corner ticks, hairlines
and the vignette are CSS — no new image assets.

## Map pool overlay

Left rail at about 26% carries the week title and match meta; the card fan
fills the rest. The four type columns are kept — CONTROL, HYBRID, ESCORT,
PUSH/FLASH — because that grouping is the information, not decoration.

- Normal: `repeat(4, 1fr)`, art at `scale(1)`, muted green frame.
- Type focused: the focused column animates to `2.2fr` and the others to
  `0.6fr`; focused art goes to `scale(1.12)` at full saturation with a neon
  frame, the rest to 45% opacity and `grayscale(.5)`. 600ms on
  `grid-template-columns`, which Chromium animates and OBS is Chromium.
- Map focused: that tile becomes the hero card — full column height,
  `scale(1.18)`, neon-framed label bar.

## Wincards overlay

Data logic is untouched: rounds as columns, winner resolved per map, incognito
tile for the pending pick. The restyle adds the left rail (week, match result
with both logos and the score, victory/defeat tags), a winner badge built from
the team logo in a hexagon with a check ring in the team colour, a `MAP WIN ·
TEAM` label bar, and a hero treatment on the current game. A bottom strip
reads `NEXT MAP — WAITING FOR CAPTAINS` with two ready pips sourced from
`match.teamAready` / `teamBready`, which the payload already carries.

## Manager control

`/manager-dashboard`, Active tab, where the full `DraftState` is already
loaded. When `draft.phase === "STARTING"`, a `MapPoolControl` renders a
miniature of the overlay grid with the same two states, clickable: a type
header toggles focus, a map tile promotes to hero, Clear resets. Writes are
optimistic with rollback, and a local override prevents the dashboard's 12s
poll from stamping on a click that has not round-tripped yet. The panel shows
a live pip and the overlay URL with a copy button.

## Testing

The backend runs `node --test`; the new endpoint gets tests for manager-only
access and `focusType` validation, written before the handler. The frontend has
no test runner — only `next lint` and `next build` — so frontend verification
is a clean build plus a running dev server handed to the user for visual
review.

## Files

Backend: `prisma/schema.prisma`, a new migration, `controllers/match.js`,
`routes/match.js`, `tests/matchOverlayFocus.test.js`.

Frontend: `lib/api/types.ts`, `lib/api/match.ts`,
`app/overlay/components/MapPoolOverlay.tsx` and its module CSS,
`app/overlay/components/WincardsOverlay.tsx` and its module CSS, a new
`app/overlay/components/overlay-theme.css`, a new
`components/manager/MapPoolControl.tsx` and its module CSS, and
`app/manager-dashboard/page.tsx`.
