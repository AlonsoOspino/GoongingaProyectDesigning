# Announcement Studio — Design

Date: 2026-08-19
Status: Approved for planning
Scope: Sub-project 1 of 4 in the league ↔ minigames restructure.

## Problem

The league site and the minigames site are tangled. Three symptoms:

1. **Two minigame managers over the same data.** `frontend/src/minigames/JeopardyDashboard.tsx`
   creates and operates Jeopardy games from the league site. `minigames-frontend/src/app/social-media/`,
   `/social-media/[slug]` and `/developer` create and operate **the same `MiniGame` rows** from the
   minigames site. One database, two interfaces, different capabilities.

2. **`/minigames` means three different things.** It is a token-handoff redirect
   (`frontend/src/app/minigames/page.tsx`), it is labelled "Stream Tools" in the navbar, and its
   sibling routes `/minigames/jeopardy` and `/minigames/jeopardy-overview` are transparent OBS
   overlays that are not minigames at all.

3. **Announcements cannot be authored.** `AnnouncementMode` is a singleton row with
   `activeMode ∈ {TOURNAMENT, JEOPARDY}`. An operator flips one switch between two hardcoded modes.
   Because the Jeopardy template hardcodes `<Link href="/minigames/jeopardy">`, the public
   "Open Jeopardy" button sends visitors to an OBS overlay instead of to the game.

## Goal

Make **a published announcement the only path from the league site to the minigames.** The league
manager dashboard authors and publishes announcements; it does not operate games. Game operation
moves to the minigames frontend (sub-project 2).

This document covers sub-project 1 only: turning announcements into authorable content.

## Non-goals

Explicitly out of scope, and not to be added opportunistically:

- Scheduled publishing by date. The countdown field already covers the "starts at" need.
- More than one announcement visible at a time (carousel, slots).
- Rich-text editing, announcement duplication, manual ordering, version history.
- Moving or restructuring `JeopardyDashboard` — that is sub-project 2.
- Restructuring `/manager-dashboard` or removing the iframe — that is sub-project 3.

## Data model

Two Prisma changes.

```prisma
model Announcement {
  id          Int              @id @default(autoincrement())
  name        String           // internal label, shown in the studio list
  type        AnnouncementType
  content     Json             @default("{}")
  countdownAt DateTime?        // cross-cutting: every type may show a countdown
  createdById Int
  updatedById Int?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  createdBy   NetworkMember    @relation("AnnouncementCreator", fields: [createdById], references: [id], onDelete: Restrict)
  publishedIn AnnouncementMode[] @relation("PublishedAnnouncement")

  @@index([type, updatedAt])
}

model AnnouncementMode {      // still a singleton (id = 1), now a pointer
  id          Int           @id @default(1)
  enabled     Boolean       @default(true)
  publishedId Int?
  published   Announcement? @relation("PublishedAnnouncement", fields: [publishedId], references: [id], onDelete: SetNull)
  updatedById Int?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

enum AnnouncementType { TOURNAMENT  MINIGAME  CUSTOM }
```

Both relations need their opposite field or Prisma will not generate: `AnnouncementMode.published`
is matched by `Announcement.publishedIn` (a list, because Prisma models the back side of an optional
one-to-one this way unless `@unique` is added — the singleton makes the cardinality moot), and
`Announcement.createdBy` needs a matching `announcements Announcement[] @relation("AnnouncementCreator")`
field on `NetworkMember`.

`Announcement` deliberately has **no `status` field.** "Published" is derived from
`AnnouncementMode.publishedId`, so two rows can never both claim to be live. One source of truth.
`enabled` keeps its current meaning: hide the announcement area entirely.

The old `AnnouncementMode.activeMode` column and `config` JSON are removed, along with the
`AnnouncementModeType` enum.

`onDelete: SetNull` on `publishedId` means deleting the published announcement unpublishes it
rather than failing. The public endpoint already handles `announcement: null`.

### Content shapes

```ts
TOURNAMENT { matchId: number | null; headline?: string }
MINIGAME   { minigameSlug: string; ctaLabel?: string }
CUSTOM     { eyebrow: string; headline: string; body: string;
             imageUrl?: string; ctaLabel?: string; ctaHref?: string }
```

`TOURNAMENT.matchId === null` means automatic: the current `ACTIVE` match, otherwise the nearest
future `SCHEDULED` one. This is the behaviour that exists today, kept as a choice rather than as
the only option. `headline` is an optional override; empty means the generated title
(`match.title`, falling back to "Team A vs Team B").

**Countdown precedence for `TOURNAMENT`.** The current template falls back to `match.startDate`
when no explicit countdown is configured (`TournamentMode.tsx:23`). That is kept: the view uses
`countdownAt` when set, otherwise the resolved match's `startDate`, otherwise renders no countdown.
`MINIGAME` and `CUSTOM` have no fallback — no `countdownAt`, no countdown.

### Migration

The migration must be invisible to visitors:

1. Create `Announcement` and the new `AnnouncementMode` columns.
2. Seed one `TOURNAMENT` row (`{ matchId: null }`, name "Tournament") and one `MINIGAME` row
   (name "Minigame") from the existing singleton, carrying over `config.countdownAt` into the new
   `countdownAt` column on both.
3. For the `MINIGAME` seed row, set `minigameSlug` to the slug of the current `LIVE` `JEOPARDY`
   game if one exists; otherwise leave it empty.

   An empty slug is below what `validateContent` accepts, but the migration writes rows directly
   and does not go through the API. This is intentional and must not be "fixed": the row exists,
   the studio shows it, and the operator cannot save it again until they pick a game. The studio
   must therefore surface an incomplete announcement clearly instead of failing opaquely on save,
   and `resolvePayload` must tolerate an empty slug by returning `null`. If such a row is the one
   pointed at by `publishedId`, the landing page shows the template's idle state — the same
   behaviour as today when no Jeopardy game is live.
4. Point `publishedId` at whichever seeded row matches the old `activeMode`. Preserve `enabled`.
5. Drop `activeMode` and `config`.

`createdById` on the seeded rows: use the existing `updatedById` if set, otherwise the lowest-id
`ADMIN` member. The column is required and needs a real member.

## Template contract

The registry is the whole point of the design. Each type is declared once per side and nothing else
in the system branches on type.

**Backend** — `backend/announcements/templates/<type>.js`:

```js
{
  type: "MINIGAME",
  validateContent(content),   // returns normalized content, or throws with an operator-readable message
  resolvePayload(content),    // async; returns the live data this template needs, or null
}
```

**Frontend** — `frontend/src/announcements/templates/<type>.tsx`:

```ts
{
  type, title, description, icon,   // studio metadata
  defaultContent,                   // used when creating
  Editor,                           // ({ content, onChange }) => JSX — the fields for this type
  View,                             // ({ content, payload, countdownAt, now, standalone }) => JSX
}
```

A registry on each side maps `type → template`. `frontend/src/announcements/registry.ts` is
replaced by this. Adding a type later (Playoffs, Family Feud) is one backend file, one frontend
file, two registry entries — and no change to the studio, the renderer, or the controller.

`resolvePayload` is what keeps live data live:

- `TOURNAMENT` — resolves the pinned or automatic match; returns teams, map wins, status, game
  number. Same query shape as the current `getTournamentPayload`.
- `MINIGAME` — resolves the `MiniGame` by slug; returns title, description, cover, status, phase.
- `CUSTOM` — resolves nothing, returns `null`.

## API

All routes under `/announcement`.

| Method | Route | Access |
|---|---|---|
| `GET` | `/active` | public |
| `GET` | `/` | manager — full list |
| `POST` | `/` | manager — create |
| `PATCH` | `/:id` | manager — update `name`, `content`, `countdownAt` |
| `DELETE` | `/:id` | manager — delete |
| `POST` | `/preview` | manager — `{type, content}` → resolved payload |
| `GET` | `/settings` | manager — `{enabled, publishedId}` |
| `PATCH` | `/settings` | manager — `{enabled?, publishedId?}` |

"manager" is `networkAuthMiddleware` + `requireNetworkRole("SOCIAL_MEDIA", "ADMIN")`, unchanged
from the current file and equivalent to `hasManagerAccess`.

`PATCH /settings` is the only publication control: `publishedId: N` publishes, `publishedId: null`
unpublishes, `enabled` hides the area — atomically, in one call. There is no separate
`POST /:id/publish`. `publishedId` must reference an existing row.

`POST /preview` takes content rather than an id because the preview must reflect unsaved edits,
and `resolvePayload` needs database access so it cannot run in the browser.

**Express route ordering:** `/settings` must be registered before `/:id`, or `:id` captures it.

### `GET /active` response

```json
{
  "enabled": true,
  "announcement": { "id": 3, "name": "…", "type": "MINIGAME", "content": {}, "countdownAt": null },
  "payload": {},
  "updatedAt": "2026-08-19T00:00:00.000Z"
}
```

`announcement` and `payload` are `null` when nothing is published. This replaces the current flat
`{enabled, mode, config, updatedAt, payload}` shape; `AnnouncementRenderer` is its only consumer
and is rewritten in this work.

### Validation and failure

Each template's `validateContent` runs on create and update. Unknown types are rejected.

`CUSTOM.ctaHref` accepts only an internal path (starts with `/`, not `//`) or an `http(s)://` URL.
Without this filter a `javascript:` URL typed by an operator is a stored XSS. The same guard shape
already exists in `safeGameNightsPath` / `safeNextPath`.

`MINIGAME.minigameSlug` is checked to exist at save time. If the game is deleted afterwards,
`resolvePayload` returns `null` and the view falls back — validation at save does not guarantee
validity at render, so both paths must hold.

If `resolvePayload` throws, `GET /active` returns `payload: null` rather than a 500. A broken
announcement must never take down the landing page. The error surfaces in the studio preview,
where an operator can act on it.

## The studio

### Placement

In this sub-project `/manager-dashboard` is still the 1064-line page loaded through an iframe;
restructuring it is sub-project 3. The studio is therefore built as a self-contained component,
`AnnouncementStudio`, and dropped into **the slot `AnnouncementModeControl` occupies today** in
`frontend/src/app/social-media-dashboard/page.tsx`. Sub-project 3 moves it into the new
`/manager-dashboard` unchanged.

`AnnouncementModeControl.tsx` is deleted, along with `JeopardyMode.tsx`, `TournamentMode.tsx` and
`registry.ts`, whose responsibilities move into the templates.

### Behaviour

**List** — saved announcements with type, name, last-edited time, and a clear marker on the one
that is live. Open, delete, and create-new (type chosen at creation).

**Editor** — two columns. Left: internal name, the fields the template declares, and the countdown.
Right: a live preview that is **the actual `View` component**, not a mockup, fed by `POST /preview`
with a debounce. What the operator sees is what publishes.

Type is fixed at creation. Changing it would discard the content; creating a second announcement is
the answer.

**Publish bar** — `Save` and `Publish` are separate actions. Saving does not change what the public
sees, so an operator can leave a half-written announcement safely. The visibility toggle sits
alongside.

Pickers reuse existing endpoints: `GET /matches` for the tournament match picker, `GET /minigame/games`
for the minigame picker. No new endpoints.

## Rendering and the bridge

`AnnouncementRenderer` is rewritten to: fetch `GET /active`, look up `announcement.type` in the
registry, render `<template.View … />`. It stops branching on type. It keeps both consumers — inline
on the landing page (`frontend/src/app/page.tsx`, the `live-stage` section) and `standalone` at
`/announcements` for OBS — and keeps the 12-second poll.

When `enabled` is false or `announcement` is null: render nothing inline, render the idle message in
standalone mode. This matches current behaviour.

### The bridge to the minigames

The `MINIGAME` view builds its destination from saved content:

```
/minigames?next=/<minigameSlug>
```

`/minigames` is the existing handoff that carries the session token, so the visitor lands on
`minigames-frontend/<slug>` already signed in. The announcement becomes the only door, over
infrastructure that already works.

For `/minigames` to mean one thing, the two OBS overlays move to where the other overlays live:

```
/minigames/jeopardy           →  /overlay/jeopardy-podium
/minigames/jeopardy-overview  →  /overlay/jeopardy-scores
```

The old paths stay as redirects in `frontend/next.config.ts` so OBS scenes already saved do not
break mid-season. They are removed once the scenes have been updated — a manual step to hand to
whoever runs the stream.

`RouteAwareShell` must be updated: it currently strips the navbar for any path starting with
`/minigames`, which was how the overlays rendered chrome-free. After the move, `/overlay` already
covers them, and `/minigames` — now only the handoff page — no longer needs the exemption.

The broken `/minigames?view=manager` link in `JeopardyDashboard.tsx:229` is left alone; that
component is removed in sub-project 2.

## Testing

The backend has an established convention: `node --test`, pure functions exported through
`__testables`, no database (`backend/tests/announcement.test.js`, run by `npm test`).

The three `validateContent` functions are pure and are tested that way. Cases that must be covered:

- unknown type is rejected
- `MINIGAME` with empty or missing slug is rejected
- `CUSTOM.ctaHref` rejects `javascript:` and protocol-relative `//host`, accepts `/path` and `https://host`
- `countdownAt` normalization: valid ISO, invalid string → null, absent → null
- non-object content is rejected rather than silently coerced

`resolvePayload` requires the database and stays outside this style; it is verified manually against
real data, as the current payload builders are.

The existing `announcement.test.js` tests `normalizeMode` and `normalizeConfig`, which cease to
exist. That file is rewritten against the new testables rather than deleted.

## Files

**Backend**
- `prisma/schema.prisma` — the two models and the enum; one migration
- `announcements/templates/{tournament,minigame,custom}.js` — new
- `announcements/registry.js` — new
- `controllers/announcement.js` — rewritten around the registry
- `routes/announcement.js` — eight routes, `/settings` before `/:id`
- `tests/announcement.test.js` — rewritten

**Frontend**
- `announcements/templates/{tournament,minigame,custom}.tsx` — new
- `announcements/registry.ts` — replaced by the template registry
- `announcements/types.ts` — reshaped to the new API
- `announcements/AnnouncementRenderer.tsx` — rewritten, registry-driven
- `announcements/AnnouncementStudio.tsx` — new
- `announcements/{JeopardyMode,TournamentMode,AnnouncementModeControl}.tsx` — deleted
- `announcements/announcements.module.css` — reorganized per template
- `lib/api/announcement.ts` — the eight endpoints
- `app/social-media-dashboard/page.tsx` — studio replaces the mode control
- `app/overlay/jeopardy-podium/`, `app/overlay/jeopardy-scores/` — moved from `app/minigames/`
- `next.config.ts` — redirects for the old overlay paths
- `components/layout/RouteAwareShell.tsx` — drop the `/minigames` chrome exemption

## Sequencing

This is sub-project 1 of 4, agreed in this order:

1. **Announcements** (this document) — the bridge must exist before the current one is cut.
2. **Minigames consolidation** — a single `/manage` in minigames-frontend; `JeopardyDashboard`
   leaves the league site; the four scattered management surfaces there collapse into one.
3. **League dashboard** — remove the iframe, one real `/manager-dashboard` with the studio as a
   section, navbar cleanup, deduplicate the two session abstractions over one token.
4. **Draft table** — extract the 3536-line file into phase modules, add a fixture sandbox and a
   manager "act as team A/B" operator mode (the backend already permits this via
   `resolveActingTeamId` in `backend/controllers/draft.js:121`), then the visual pass.
