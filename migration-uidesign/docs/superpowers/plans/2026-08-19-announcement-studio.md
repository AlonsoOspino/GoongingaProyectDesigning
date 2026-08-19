# Announcement Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-mode `AnnouncementMode` singleton with an authorable collection of announcements driven by a template registry, so that a published announcement becomes the only path from the league site to the minigames.

**Architecture:** A new `Announcement` table holds many saved announcements; the existing `AnnouncementMode` singleton is reduced to a pointer at the one that is live. Each announcement has a `type` whose behaviour is declared once in a template — `validateContent` + `resolvePayload` on the backend, `Editor` + `View` on the frontend. The controller, the studio UI and the public renderer all read the registry and never branch on type.

**Tech Stack:** Node/Express + Prisma 6 (PostgreSQL) backend, `node --test` for backend tests. Next.js 15 App Router + TypeScript + CSS modules frontend. No frontend test runner exists in this repo.

**Spec:** `docs/superpowers/specs/2026-08-19-announcement-studio-design.md` — read it before starting. This plan implements it and does not restate its reasoning.

## Global Constraints

- Backend API is mounted at `/announcements` (plural), in `backend/app.js:84`. Minigames are at `/minigames`, matches at `/match`.
- Manager access is `networkAuthMiddleware` + `requireNetworkRole("SOCIAL_MEDIA", "ADMIN")`. `networkAuthMiddleware` populates `req.networkMember`.
- Backend tests: `node --test tests/*.test.js` via `npm test` in `backend/`. Convention is pure functions exported through a `__testables` object; no database in tests.
- Prisma migrations are hand-written SQL in `backend/prisma/migrations/<UTCSTAMP>_<name>/migration.sql`, following the existing style (see `20260809220000_add_announcement_modes`).
- Frontend has **no test runner**. Verification for frontend tasks is `npx tsc --noEmit` plus `npm run build`, plus the stated manual check. Do not add a test framework as part of this plan.
- UI copy is in English throughout both frontends. Match that.
- Never widen manager permissions. `GET /announcements/active` is the only public route.

**Deployment warning:** between Task 4 and Task 7 the public `GET /active` response shape has changed but the renderer has not been rewritten yet, so the landing announcement will not render. Do not deploy between those tasks. Tasks 1–11 are one work stream.

---

### Task 1: Schema and migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260819120000_announcement_collection/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma models `Announcement { id, name, type, content, countdownAt, createdById, updatedById, createdAt, updatedAt }` and `AnnouncementMode { id, enabled, publishedId, published, updatedById, createdAt, updatedAt }`; enum `AnnouncementType = TOURNAMENT | MINIGAME | CUSTOM`. Prisma client accessors `prisma.announcement` and `prisma.announcementMode`.

- [ ] **Step 1: Replace the `AnnouncementMode` model in the schema**

In `backend/prisma/schema.prisma`, replace the whole existing `AnnouncementMode` model (it currently sits just after `MiniGameParticipant`, with the `/// Estado editorial principal del sitio...` doc comment above it) with these two models. Keep the doc comment style used in this file.

```prisma
/// Un anuncio guardado. `content` tiene la forma que declara su plantilla
/// (ver backend/announcements/templates). Publicado o no lo decide
/// AnnouncementMode.publishedId, por eso aqui no hay campo de estado.
model Announcement {
  id          Int                @id @default(autoincrement())
  name        String
  type        AnnouncementType
  content     Json               @default("{}")
  countdownAt DateTime?
  createdById Int
  updatedById Int?
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  createdBy   NetworkMember      @relation("AnnouncementCreator", fields: [createdById], references: [id], onDelete: Restrict)
  publishedIn AnnouncementMode[] @relation("PublishedAnnouncement")

  @@index([type, updatedAt])
}

/// Estado editorial principal del sitio. Sigue siendo un singleton (id 1);
/// ahora solo apunta al anuncio publicado en lugar de contenerlo.
model AnnouncementMode {
  id          Int           @id @default(1)
  enabled     Boolean       @default(true)
  publishedId Int?
  published   Announcement? @relation("PublishedAnnouncement", fields: [publishedId], references: [id], onDelete: SetNull)
  updatedById Int?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}
```

- [ ] **Step 2: Swap the enum**

Find `enum AnnouncementModeType { TOURNAMENT  JEOPARDY }` (near the other enums) and replace it with:

```prisma
enum AnnouncementType {
  TOURNAMENT
  MINIGAME
  CUSTOM
}
```

- [ ] **Step 3: Add the back-relation on `NetworkMember`**

Prisma will not generate without it. In the `NetworkMember` model, add this line alongside the other relation lists (next to `createdMiniGames`):

```prisma
  announcements          Announcement[]        @relation("AnnouncementCreator")
```

- [ ] **Step 4: Verify the schema is valid before writing any SQL**

Run: `cd backend && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

If it complains about a missing opposite relation field, Step 3 was not applied correctly.

- [ ] **Step 5: Write the migration SQL**

Create `backend/prisma/migrations/20260819120000_announcement_collection/migration.sql`:

```sql
CREATE TYPE "AnnouncementType" AS ENUM ('TOURNAMENT', 'MINIGAME', 'CUSTOM');

CREATE TABLE "Announcement" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AnnouncementType" NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "countdownAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Announcement_type_updatedAt_idx" ON "Announcement"("type", "updatedAt");

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "NetworkMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AnnouncementMode" ADD COLUMN "publishedId" INTEGER;

-- Seed one announcement per legacy mode so the public site does not change.
-- createdById is required, so fall back to the lowest-id ADMIN. On a fresh
-- database with no members the WHERE clause seeds nothing, which is correct:
-- there is no existing announcement to preserve.
INSERT INTO "Announcement" ("name", "type", "content", "countdownAt", "createdById")
SELECT
    'Tournament',
    'TOURNAMENT',
    '{"matchId": null, "headline": ""}'::jsonb,
    CASE
        WHEN m."config" ->> 'countdownAt' IS NULL THEN NULL
        ELSE ((m."config" ->> 'countdownAt')::timestamptz AT TIME ZONE 'UTC')
    END,
    COALESCE(
        m."updatedById",
        (SELECT n."id" FROM "NetworkMember" n WHERE 'ADMIN' = ANY(n."roles") ORDER BY n."id" ASC LIMIT 1)
    )
FROM "AnnouncementMode" m
WHERE m."id" = 1
  AND COALESCE(
        m."updatedById",
        (SELECT n."id" FROM "NetworkMember" n WHERE 'ADMIN' = ANY(n."roles") ORDER BY n."id" ASC LIMIT 1)
      ) IS NOT NULL;

INSERT INTO "Announcement" ("name", "type", "content", "countdownAt", "createdById")
SELECT
    'Minigame',
    'MINIGAME',
    jsonb_build_object(
        'minigameSlug',
        COALESCE((
            SELECT g."slug" FROM "MiniGame" g
            WHERE g."gameType" = 'JEOPARDY' AND g."status" = 'LIVE'
            ORDER BY g."updatedAt" DESC LIMIT 1
        ), ''),
        'ctaLabel', ''
    ),
    CASE
        WHEN m."config" ->> 'countdownAt' IS NULL THEN NULL
        ELSE ((m."config" ->> 'countdownAt')::timestamptz AT TIME ZONE 'UTC')
    END,
    COALESCE(
        m."updatedById",
        (SELECT n."id" FROM "NetworkMember" n WHERE 'ADMIN' = ANY(n."roles") ORDER BY n."id" ASC LIMIT 1)
    )
FROM "AnnouncementMode" m
WHERE m."id" = 1
  AND COALESCE(
        m."updatedById",
        (SELECT n."id" FROM "NetworkMember" n WHERE 'ADMIN' = ANY(n."roles") ORDER BY n."id" ASC LIMIT 1)
      ) IS NOT NULL;

-- Point the singleton at whichever seeded row matches the old activeMode.
UPDATE "AnnouncementMode" m
SET "publishedId" = (
    SELECT a."id" FROM "Announcement" a
    WHERE a."type" = (CASE WHEN m."activeMode" = 'JEOPARDY' THEN 'MINIGAME' ELSE 'TOURNAMENT' END)::"AnnouncementType"
    ORDER BY a."id" ASC LIMIT 1
)
WHERE m."id" = 1;

ALTER TABLE "AnnouncementMode" ADD CONSTRAINT "AnnouncementMode_publishedId_fkey"
    FOREIGN KEY ("publishedId") REFERENCES "Announcement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnnouncementMode" DROP COLUMN "activeMode";
ALTER TABLE "AnnouncementMode" DROP COLUMN "config";

DROP TYPE "AnnouncementModeType";
```

The `countdownAt` cast is safe without a validity guard because the old controller's `normalizeConfig` only ever wrote a valid ISO string or JSON `null` into `config.countdownAt`.

- [ ] **Step 6: Apply the migration and regenerate the client**

Run: `cd backend && npx prisma migrate deploy && npx prisma generate`
Expected: the migration applies with no error, and generation reports the client was written.

If your local database is empty of `AnnouncementMode`, `migrate deploy` still succeeds — the seeding statements simply affect zero rows.

- [ ] **Step 7: Confirm the data survived**

Run:

```bash
cd backend && npx prisma studio
```

Open the `Announcement` table. Expected on a database that had a configured announcement: two rows, `Tournament` and `Minigame`, and `AnnouncementMode.publishedId` pointing at one of them. Close Studio when done.

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260819120000_announcement_collection
git commit -m "feat(announcements): replace mode singleton with announcement collection"
```

---

### Task 2: Template content validators

**Files:**
- Create: `backend/announcements/templates/shared.js`
- Create: `backend/announcements/templates/tournament.js`
- Create: `backend/announcements/templates/minigame.js`
- Create: `backend/announcements/templates/custom.js`
- Create: `backend/announcements/registry.js`
- Rewrite: `backend/tests/announcement.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `require("../announcements/registry")` → `{ getTemplate(type), normalizeCountdown(value), templates }`
  - `getTemplate(type)` returns `{ type, validateContent(content), resolvePayload(content) }` and throws for an unknown type. `resolvePayload` is added in Task 3; in this task each template exports only `type` and `validateContent`.
  - `validateContent` returns a normalized content object and throws `Error` with an operator-readable message.
  - `normalizeCountdown(value)` returns a `Date` or `null`.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `backend/tests/announcement.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { getTemplate, normalizeCountdown } = require("../announcements/registry");

test("unknown announcement types are rejected", () => {
  assert.throws(() => getTemplate("JEOPARDY"), /Tournament, Minigame or Custom/);
  assert.throws(() => getTemplate(""), /Tournament, Minigame or Custom/);
  assert.throws(() => getTemplate(undefined), /Tournament, Minigame or Custom/);
});

test("known announcement types resolve case-insensitively", () => {
  assert.equal(getTemplate(" tournament ").type, "TOURNAMENT");
  assert.equal(getTemplate("MINIGAME").type, "MINIGAME");
  assert.equal(getTemplate("custom").type, "CUSTOM");
});

test("content must be a plain object", () => {
  for (const type of ["TOURNAMENT", "MINIGAME", "CUSTOM"]) {
    const { validateContent } = getTemplate(type);
    assert.throws(() => validateContent(null), /must be an object/);
    assert.throws(() => validateContent(["nope"]), /must be an object/);
    assert.throws(() => validateContent("nope"), /must be an object/);
  }
});

test("tournament accepts automatic and pinned matches", () => {
  const { validateContent } = getTemplate("TOURNAMENT");
  assert.deepEqual(validateContent({}), { matchId: null, headline: "" });
  assert.deepEqual(validateContent({ matchId: null }), { matchId: null, headline: "" });
  assert.deepEqual(validateContent({ matchId: 12, headline: "  Grand final  " }), { matchId: 12, headline: "Grand final" });
});

test("tournament rejects non-positive or fractional match ids", () => {
  const { validateContent } = getTemplate("TOURNAMENT");
  assert.throws(() => validateContent({ matchId: 0 }), /valid match/);
  assert.throws(() => validateContent({ matchId: -3 }), /valid match/);
  assert.throws(() => validateContent({ matchId: 1.5 }), /valid match/);
  assert.throws(() => validateContent({ matchId: "abc" }), /valid match/);
});

test("minigame requires a usable slug", () => {
  const { validateContent } = getTemplate("MINIGAME");
  assert.deepEqual(validateContent({ minigameSlug: " ggl-jeopardy " }), { minigameSlug: "ggl-jeopardy", ctaLabel: "" });
  assert.deepEqual(validateContent({ minigameSlug: "trivia", ctaLabel: "Play now" }), { minigameSlug: "trivia", ctaLabel: "Play now" });
  assert.throws(() => validateContent({}), /which minigame/);
  assert.throws(() => validateContent({ minigameSlug: "   " }), /which minigame/);
  assert.throws(() => validateContent({ minigameSlug: "../admin" }), /not valid/);
  assert.throws(() => validateContent({ minigameSlug: "has space" }), /not valid/);
});

test("custom requires a headline and keeps the optional fields", () => {
  const { validateContent } = getTemplate("CUSTOM");
  assert.deepEqual(
    validateContent({ eyebrow: " Event ", headline: " Game night ", body: " Join us ", ctaLabel: " Open ", ctaHref: "/schedule" }),
    { eyebrow: "Event", headline: "Game night", body: "Join us", imageUrl: "", ctaLabel: "Open", ctaHref: "/schedule" },
  );
  assert.throws(() => validateContent({ body: "no headline" }), /Headline is required/);
});

test("custom links reject anything that is not an internal path or http(s)", () => {
  const { validateContent } = getTemplate("CUSTOM");
  const base = { headline: "Game night" };
  assert.equal(validateContent({ ...base, ctaHref: "https://twitch.tv/x" }).ctaHref, "https://twitch.tv/x");
  assert.equal(validateContent({ ...base, ctaHref: "/minigames" }).ctaHref, "/minigames");
  assert.equal(validateContent({ ...base, ctaHref: "" }).ctaHref, "");
  assert.throws(() => validateContent({ ...base, ctaHref: "javascript:alert(1)" }), /internal path or an http/);
  assert.throws(() => validateContent({ ...base, ctaHref: "//evil.example" }), /internal path or an http/);
  assert.throws(() => validateContent({ ...base, imageUrl: "javascript:alert(1)" }), /internal path or an http/);
});

test("countdown normalization accepts ISO input and rejects the rest", () => {
  assert.equal(normalizeCountdown(null), null);
  assert.equal(normalizeCountdown(undefined), null);
  assert.equal(normalizeCountdown(""), null);
  assert.equal(normalizeCountdown("not-a-date"), null);
  assert.equal(normalizeCountdown("2026-08-20T18:30:00-05:00").toISOString(), "2026-08-20T23:30:00.000Z");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npm test`
Expected: FAIL — `Cannot find module '../announcements/registry'`.

- [ ] **Step 3: Write the shared validation helpers**

Create `backend/announcements/templates/shared.js`:

```js
function assertPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Announcement content must be an object.");
  }
  return value;
}

function optionalText(value, max) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw new Error("Text fields must be plain text.");
  return value.trim().slice(0, max);
}

function requiredText(value, label, max) {
  const text = optionalText(value, max);
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

// Operators type these by hand, so a bare `javascript:` URL would be stored XSS.
// Only an internal path or an absolute http(s) URL is allowed through.
function safeLink(value, label) {
  const text = optionalText(value, 500);
  if (!text) return "";
  if (text.startsWith("//")) throw new Error(`${label} must be an internal path or an http(s) URL.`);
  if (text.startsWith("/")) return text;
  if (/^https?:\/\//i.test(text)) return text;
  throw new Error(`${label} must be an internal path or an http(s) URL.`);
}

module.exports = { assertPlainObject, optionalText, requiredText, safeLink };
```

- [ ] **Step 4: Write the three templates**

Create `backend/announcements/templates/tournament.js`:

```js
const { assertPlainObject, optionalText } = require("./shared");

function validateContent(content) {
  const source = assertPlainObject(content);
  let matchId = null;

  if (source.matchId !== null && source.matchId !== undefined && source.matchId !== "") {
    matchId = Number(source.matchId);
    if (!Number.isInteger(matchId) || matchId <= 0) {
      throw new Error("Pick a valid match, or leave the announcement on automatic.");
    }
  }

  return { matchId, headline: optionalText(source.headline, 120) };
}

module.exports = { type: "TOURNAMENT", validateContent };
```

Create `backend/announcements/templates/minigame.js`:

```js
const { assertPlainObject, optionalText } = require("./shared");

function validateContent(content) {
  const source = assertPlainObject(content);
  const minigameSlug = optionalText(source.minigameSlug, 120);

  if (!minigameSlug) throw new Error("Choose which minigame this announcement opens.");
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(minigameSlug)) throw new Error("That minigame route is not valid.");

  return { minigameSlug, ctaLabel: optionalText(source.ctaLabel, 40) };
}

module.exports = { type: "MINIGAME", validateContent };
```

Create `backend/announcements/templates/custom.js`:

```js
const { assertPlainObject, optionalText, requiredText, safeLink } = require("./shared");

function validateContent(content) {
  const source = assertPlainObject(content);
  return {
    eyebrow: optionalText(source.eyebrow, 60),
    headline: requiredText(source.headline, "Headline", 120),
    body: optionalText(source.body, 600),
    imageUrl: safeLink(source.imageUrl, "Image URL"),
    ctaLabel: optionalText(source.ctaLabel, 40),
    ctaHref: safeLink(source.ctaHref, "Button link"),
  };
}

module.exports = { type: "CUSTOM", validateContent };
```

- [ ] **Step 5: Write the registry**

Create `backend/announcements/registry.js`:

```js
const tournament = require("./templates/tournament");
const minigame = require("./templates/minigame");
const custom = require("./templates/custom");

const templates = new Map([tournament, minigame, custom].map((template) => [template.type, template]));

function getTemplate(type) {
  const template = templates.get(String(type || "").trim().toUpperCase());
  if (!template) throw new Error("Choose Tournament, Minigame or Custom.");
  return template;
}

function normalizeCountdown(value) {
  if (value === null || value === undefined || value === "") return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time) : null;
}

module.exports = { getTemplate, normalizeCountdown, templates };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && npm test`
Expected: PASS, all announcement tests green, and the other four test files still passing.

- [ ] **Step 7: Commit**

```bash
git add backend/announcements backend/tests/announcement.test.js
git commit -m "feat(announcements): add template registry and content validators"
```

---

### Task 3: Live payload resolvers

**Files:**
- Modify: `backend/announcements/templates/tournament.js`
- Modify: `backend/announcements/templates/minigame.js`
- Modify: `backend/announcements/templates/custom.js`

**Interfaces:**
- Consumes: `validateContent` output shapes from Task 2.
- Produces: `template.resolvePayload(content)` — async, returns:
  - TOURNAMENT → `{ state: "LIVE" | "UPCOMING" | "IDLE", match: MatchSummary | null }`
  - MINIGAME → `{ state: "LIVE" | "IDLE", game: GameSummary | null }`
  - CUSTOM → `null`
  - `MatchSummary` = `{ id, title, type, bestOf, status, startDate, mapWinsTeamA, mapWinsTeamB, gameNumber, teamA: {id,name,logo}, teamB: {id,name,logo} }`
  - `GameSummary` = `{ slug, title, description, coverImageUrl, gameType, status, phase, updatedAt }`

These are the exact shapes the frontend `View` components in Task 6 consume.

- [ ] **Step 1: Add the tournament resolver**

In `backend/announcements/templates/tournament.js`, add the prisma import at the top and the resolver before `module.exports`. The `matchSelect` and the automatic-mode queries are lifted verbatim from the current `getTournamentPayload` in `backend/controllers/announcement.js`, so behaviour is unchanged when `matchId` is null.

```js
const prisma = require("../../config/prisma");

const matchSelect = {
  id: true,
  title: true,
  type: true,
  bestOf: true,
  status: true,
  startDate: true,
  mapWinsTeamA: true,
  mapWinsTeamB: true,
  gameNumber: true,
  teamA: { select: { id: true, name: true, logo: true } },
  teamB: { select: { id: true, name: true, logo: true } },
};

async function resolvePayload(content) {
  if (content.matchId) {
    const pinned = await prisma.match.findUnique({ where: { id: content.matchId }, select: matchSelect });
    if (!pinned) return { state: "IDLE", match: null };
    return { state: pinned.status === "ACTIVE" ? "LIVE" : "UPCOMING", match: pinned };
  }

  const active = await prisma.match.findFirst({
    where: { status: "ACTIVE" },
    select: matchSelect,
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
  });
  if (active) return { state: "LIVE", match: active };

  const upcoming = await prisma.match.findFirst({
    where: { status: "SCHEDULED", startDate: { gte: new Date() } },
    select: matchSelect,
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
  });
  return { state: upcoming ? "UPCOMING" : "IDLE", match: upcoming };
}
```

Update the export line to `module.exports = { type: "TOURNAMENT", validateContent, resolvePayload };`

- [ ] **Step 2: Add the minigame resolver**

In `backend/announcements/templates/minigame.js`, add at the top and before the export:

```js
const prisma = require("../../config/prisma");

async function resolvePayload(content) {
  // The migration can seed a row with an empty slug, and a game can be deleted
  // after an announcement referencing it was saved. Both degrade to idle.
  if (!content.minigameSlug) return { state: "IDLE", game: null };

  const game = await prisma.miniGame.findUnique({
    where: { slug: content.minigameSlug },
    select: {
      slug: true,
      title: true,
      description: true,
      coverImageUrl: true,
      gameType: true,
      status: true,
      phase: true,
      updatedAt: true,
    },
  });

  if (!game) return { state: "IDLE", game: null };
  return { state: game.status === "LIVE" ? "LIVE" : "IDLE", game };
}
```

Update the export line to `module.exports = { type: "MINIGAME", validateContent, resolvePayload };`

- [ ] **Step 3: Add the custom resolver**

In `backend/announcements/templates/custom.js`, add before the export:

```js
async function resolvePayload() {
  return null;
}
```

Update the export line to `module.exports = { type: "CUSTOM", validateContent, resolvePayload };`

- [ ] **Step 4: Verify every template satisfies the full contract**

Append to `backend/tests/announcement.test.js`:

```js
test("every registered template implements the full contract", () => {
  for (const type of ["TOURNAMENT", "MINIGAME", "CUSTOM"]) {
    const template = getTemplate(type);
    assert.equal(typeof template.validateContent, "function", `${type} needs validateContent`);
    assert.equal(typeof template.resolvePayload, "function", `${type} needs resolvePayload`);
  }
});

test("the custom template resolves no live data", async () => {
  assert.equal(await getTemplate("CUSTOM").resolvePayload({}), null);
});
```

- [ ] **Step 5: Run the tests**

Run: `cd backend && npm test`
Expected: PASS. The two database-backed resolvers are not exercised here by design — they are verified against real data in Task 4, Step 7.

- [ ] **Step 6: Commit**

```bash
git add backend/announcements backend/tests/announcement.test.js
git commit -m "feat(announcements): resolve live match and minigame payloads per template"
```

---

### Task 4: Controller and routes

**Files:**
- Rewrite: `backend/controllers/announcement.js`
- Rewrite: `backend/routes/announcement.js`

**Interfaces:**
- Consumes: `getTemplate`, `normalizeCountdown` from Task 2; `resolvePayload` from Task 3.
- Produces the HTTP API the frontend consumes in Task 5:
  - `GET /announcements/active` → `{ enabled, announcement, payload, updatedAt }`, `announcement`/`payload` null when nothing is published
  - `GET /announcements` → `Announcement[]`, newest first
  - `POST /announcements` `{ name, type, content, countdownAt? }` → `Announcement` (201)
  - `PATCH /announcements/:id` `{ name?, content?, countdownAt? }` → `Announcement`
  - `DELETE /announcements/:id` → `{ deleted: true, id }`
  - `POST /announcements/preview` `{ type, content }` → `{ content, payload }`
  - `GET /announcements/settings` → `{ enabled, publishedId, updatedAt }`
  - `PATCH /announcements/settings` `{ enabled?, publishedId? }` → `{ enabled, publishedId, updatedAt }`
  - `Announcement` = `{ id, name, type, content, countdownAt, createdAt, updatedAt }`

- [ ] **Step 1: Rewrite the controller**

Replace the entire contents of `backend/controllers/announcement.js`:

```js
const prisma = require("../config/prisma");
const { getTemplate, normalizeCountdown } = require("../announcements/registry");

function serialize(announcement) {
  return {
    id: announcement.id,
    name: announcement.name,
    type: announcement.type,
    content: announcement.content,
    countdownAt: announcement.countdownAt,
    createdAt: announcement.createdAt,
    updatedAt: announcement.updatedAt,
  };
}

async function getState(include) {
  return prisma.announcementMode.upsert({
    where: { id: 1 },
    create: { id: 1, enabled: true },
    update: {},
    ...(include ? { include } : {}),
  });
}

function readId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function getActive(req, res) {
  try {
    const state = await getState({ published: true });
    const announcement = state.published;

    if (!announcement) {
      return res.json({ enabled: state.enabled, announcement: null, payload: null, updatedAt: state.updatedAt });
    }

    let payload = null;
    try {
      payload = await getTemplate(announcement.type).resolvePayload(announcement.content);
    } catch (error) {
      // A broken announcement must never take the landing page down with it.
      console.error("Announcement payload could not be resolved:", error);
    }

    return res.json({
      enabled: state.enabled,
      announcement: serialize(announcement),
      payload,
      updatedAt: state.updatedAt,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not load the active announcement." });
  }
}

async function list(req, res) {
  try {
    const announcements = await prisma.announcement.findMany({ orderBy: { updatedAt: "desc" } });
    return res.json(announcements.map(serialize));
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not load announcements." });
  }
}

async function create(req, res) {
  try {
    const template = getTemplate(req.body?.type);
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ message: "Give this announcement a name." });

    const created = await prisma.announcement.create({
      data: {
        name,
        type: template.type,
        content: template.validateContent(req.body?.content),
        countdownAt: normalizeCountdown(req.body?.countdownAt),
        createdById: req.networkMember.id,
        updatedById: req.networkMember.id,
      },
    });

    return res.status(201).json(serialize(created));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not create this announcement." });
  }
}

async function update(req, res) {
  try {
    const id = readId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid announcement id." });

    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Announcement not found." });

    // Type is fixed at creation: changing it would invalidate the stored content.
    const template = getTemplate(existing.type);
    const data = { updatedById: req.networkMember.id };

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ message: "Give this announcement a name." });
      data.name = name;
    }
    if (req.body?.content !== undefined) data.content = template.validateContent(req.body.content);
    if (req.body?.countdownAt !== undefined) data.countdownAt = normalizeCountdown(req.body.countdownAt);

    return res.json(serialize(await prisma.announcement.update({ where: { id }, data })));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not update this announcement." });
  }
}

async function remove(req, res) {
  try {
    const id = readId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid announcement id." });

    // publishedId is ON DELETE SET NULL, so deleting the live one unpublishes it.
    await prisma.announcement.delete({ where: { id } });
    return res.json({ deleted: true, id });
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not delete this announcement." });
  }
}

async function preview(req, res) {
  try {
    const template = getTemplate(req.body?.type);
    const content = template.validateContent(req.body?.content);
    return res.json({ content, payload: await template.resolvePayload(content) });
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not build this preview." });
  }
}

async function getSettings(req, res) {
  try {
    const state = await getState();
    return res.json({ enabled: state.enabled, publishedId: state.publishedId, updatedAt: state.updatedAt });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not load announcement settings." });
  }
}

async function updateSettings(req, res) {
  try {
    const state = await getState();
    const data = { updatedById: req.networkMember.id };

    if (typeof req.body?.enabled === "boolean") data.enabled = req.body.enabled;

    if (req.body?.publishedId !== undefined) {
      if (req.body.publishedId === null) {
        data.publishedId = null;
      } else {
        const id = readId(req.body.publishedId);
        if (!id) return res.status(400).json({ message: "Choose a valid announcement to publish." });
        const target = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
        if (!target) return res.status(404).json({ message: "That announcement no longer exists." });
        data.publishedId = id;
      }
    }

    const updated = await prisma.announcementMode.update({ where: { id: state.id }, data });
    return res.json({ enabled: updated.enabled, publishedId: updated.publishedId, updatedAt: updated.updatedAt });
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not update announcement settings." });
  }
}

module.exports = { getActive, list, create, update, remove, preview, getSettings, updateSettings };
```

- [ ] **Step 2: Rewrite the routes**

Replace the entire contents of `backend/routes/announcement.js`:

```js
const express = require("express");
const announcementController = require("../controllers/announcement");
const { networkAuthMiddleware, requireNetworkRole } = require("../middlewares/networkAuthMiddleware");

const router = express.Router();
const manager = [networkAuthMiddleware, requireNetworkRole("SOCIAL_MEDIA", "ADMIN")];

router.get("/active", announcementController.getActive);

// Literal paths must precede "/:id" or the parameter route swallows them.
router.get("/settings", ...manager, announcementController.getSettings);
router.patch("/settings", ...manager, announcementController.updateSettings);
router.post("/preview", ...manager, announcementController.preview);

router.get("/", ...manager, announcementController.list);
router.post("/", ...manager, announcementController.create);
router.patch("/:id", ...manager, announcementController.update);
router.delete("/:id", ...manager, announcementController.remove);

module.exports = router;
```

- [ ] **Step 3: Run the test suite**

Run: `cd backend && npm test`
Expected: PASS. The controller has no `__testables` any more — its logic is thin glue over the registry, which is what the tests cover.

- [ ] **Step 4: Start the backend**

Run: `cd backend && node app.js`
Expected: the server starts with no module-resolution error. Leave it running for the next steps.

- [ ] **Step 5: Verify the public endpoint**

Run: `curl -s http://localhost:3000/announcements/active`
Expected: JSON with `enabled`, `announcement`, `payload`, `updatedAt`. On a database migrated from a configured singleton, `announcement.type` is `TOURNAMENT` or `MINIGAME` and `payload` is populated.

- [ ] **Step 6: Verify manager routes reject anonymous callers**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/announcements`
Expected: `401`

- [ ] **Step 7: Verify the resolvers against real data**

With a `SOCIAL_MEDIA` or `ADMIN` token in `$TOKEN`:

```bash
curl -s -X POST http://localhost:3000/announcements/preview -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"type":"TOURNAMENT","content":{"matchId":null}}'
```

Expected: `{"content":{"matchId":null,"headline":""},"payload":{"state":"…","match":…}}` — `state` is `LIVE` if a match is active, `UPCOMING` if one is scheduled, `IDLE` otherwise, and `match` carries both team objects.

Then check that a bad link is refused:

```bash
curl -s -X POST http://localhost:3000/announcements/preview -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"type":"CUSTOM","content":{"headline":"x","ctaHref":"javascript:alert(1)"}}'
```

Expected: HTTP 400 with a message about an internal path or http(s) URL.

Stop the server.

- [ ] **Step 8: Commit**

```bash
git add backend/controllers/announcement.js backend/routes/announcement.js
git commit -m "feat(announcements): registry-driven announcement CRUD, preview and publishing"
```

---

### Task 5: Frontend types and API client

**Files:**
- Rewrite: `frontend/src/announcements/types.ts`
- Rewrite: `frontend/src/lib/api/announcement.ts`

**Interfaces:**
- Consumes: the HTTP API from Task 4.
- Produces, from `@/announcements/types`: `AnnouncementType`, `TournamentContent`, `MinigameContent`, `CustomContent`, `AnnouncementContent`, `Announcement`, `AnnouncementTeam`, `AnnouncementMatch`, `AnnouncementGame`, `TournamentPayload`, `MinigamePayload`, `AnnouncementPayload`, `ActiveAnnouncement`, `AnnouncementSettings`.
- Produces, from `@/lib/api/announcement`: `getActiveAnnouncement()`, `listAnnouncements(token)`, `createAnnouncement(token, payload)`, `updateAnnouncement(token, id, payload)`, `deleteAnnouncement(token, id)`, `previewAnnouncement(token, type, content)`, `getAnnouncementSettings(token)`, `updateAnnouncementSettings(token, payload)`.

- [ ] **Step 1: Rewrite the types**

Replace the entire contents of `frontend/src/announcements/types.ts`:

```ts
export type AnnouncementType = "TOURNAMENT" | "MINIGAME" | "CUSTOM";

export type TournamentContent = { matchId: number | null; headline: string };
export type MinigameContent = { minigameSlug: string; ctaLabel: string };
export type CustomContent = {
  eyebrow: string;
  headline: string;
  body: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
};

export type AnnouncementContent = TournamentContent | MinigameContent | CustomContent;

export type Announcement = {
  id: number;
  name: string;
  type: AnnouncementType;
  content: AnnouncementContent;
  countdownAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnnouncementTeam = { id: number; name: string; logo: string | null };

export type AnnouncementMatch = {
  id: number;
  title: string | null;
  type: string;
  bestOf: number;
  status: "SCHEDULED" | "ACTIVE" | "PENDINGREGISTERS" | "FINISHED";
  startDate: string | null;
  mapWinsTeamA: number;
  mapWinsTeamB: number;
  gameNumber: number;
  teamA: AnnouncementTeam;
  teamB: AnnouncementTeam;
};

export type AnnouncementGame = {
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  gameType: "JEOPARDY" | "FAMILY_FEUD" | "CUSTOM";
  status: "LIVE" | "UNDER_DEVELOPMENT";
  phase: string;
  updatedAt: string;
};

export type TournamentPayload = { state: "LIVE" | "UPCOMING" | "IDLE"; match: AnnouncementMatch | null };
export type MinigamePayload = { state: "LIVE" | "IDLE"; game: AnnouncementGame | null };
export type AnnouncementPayload = TournamentPayload | MinigamePayload | null;

export type ActiveAnnouncement = {
  enabled: boolean;
  announcement: Announcement | null;
  payload: AnnouncementPayload;
  updatedAt: string;
};

export type AnnouncementSettings = {
  enabled: boolean;
  publishedId: number | null;
  updatedAt: string;
};
```

- [ ] **Step 2: Rewrite the API client**

Replace the entire contents of `frontend/src/lib/api/announcement.ts`:

```ts
import { apiRequest } from "@/lib/api/client";
import type {
  ActiveAnnouncement,
  Announcement,
  AnnouncementContent,
  AnnouncementPayload,
  AnnouncementSettings,
  AnnouncementType,
} from "@/announcements/types";

export function getActiveAnnouncement() {
  return apiRequest<ActiveAnnouncement>("/announcements/active", { cache: "no-store" });
}

export function listAnnouncements(token: string) {
  return apiRequest<Announcement[]>("/announcements", { token, cache: "no-store" });
}

export function createAnnouncement(
  token: string,
  payload: { name: string; type: AnnouncementType; content: AnnouncementContent; countdownAt: string | null },
) {
  return apiRequest<Announcement>("/announcements", { method: "POST", token, body: payload });
}

export function updateAnnouncement(
  token: string,
  id: number,
  payload: { name?: string; content?: AnnouncementContent; countdownAt?: string | null },
) {
  return apiRequest<Announcement>(`/announcements/${id}`, { method: "PATCH", token, body: payload });
}

export function deleteAnnouncement(token: string, id: number) {
  return apiRequest<{ deleted: true; id: number }>(`/announcements/${id}`, { method: "DELETE", token });
}

export function previewAnnouncement(token: string, type: AnnouncementType, content: AnnouncementContent) {
  return apiRequest<{ content: AnnouncementContent; payload: AnnouncementPayload }>("/announcements/preview", {
    method: "POST",
    token,
    body: { type, content },
  });
}

export function getAnnouncementSettings(token: string) {
  return apiRequest<AnnouncementSettings>("/announcements/settings", { token, cache: "no-store" });
}

export function updateAnnouncementSettings(
  token: string,
  payload: { enabled?: boolean; publishedId?: number | null },
) {
  return apiRequest<AnnouncementSettings>("/announcements/settings", { method: "PATCH", token, body: payload });
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: errors **only** in `announcements/AnnouncementRenderer.tsx`, `announcements/AnnouncementModeControl.tsx`, `announcements/JeopardyMode.tsx`, `announcements/TournamentMode.tsx` and `announcements/registry.ts` — every one of those files is replaced or deleted in Tasks 6–10. Any error outside that set means something else consumed the old types and must be fixed now.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/announcements/types.ts frontend/src/lib/api/announcement.ts
git commit -m "feat(announcements): retype the frontend client for the announcement collection"
```

---

### Task 6: Frontend template views

**Files:**
- Create: `frontend/src/announcements/templates/TournamentTemplate.tsx`
- Create: `frontend/src/announcements/templates/MinigameTemplate.tsx`
- Create: `frontend/src/announcements/templates/CustomTemplate.tsx`
- Create: `frontend/src/announcements/templates/types.ts`
- Rewrite: `frontend/src/announcements/registry.ts`
- Modify: `frontend/src/announcements/announcements.module.css`

**Interfaces:**
- Consumes: types from Task 5; `AnnouncementCountdown` (unchanged, at `@/announcements/AnnouncementCountdown`).
- Produces:
  - `@/announcements/templates/types` → `AnnouncementTemplate<C, P>` with `{ type, title, description, icon, defaultContent, Editor, View }`, plus `ViewProps<C, P>` = `{ content: C; payload: P; countdownAt: string | null; now: number; standalone: boolean }` and `EditorProps<C>` = `{ content: C; onChange: (next: C) => void }`.
  - `@/announcements/registry` → `getTemplate(type: AnnouncementType)`, `announcementTemplates: AnnouncementTemplate[]`.
- In this task each template exports a placeholder `Editor` that renders `null`; Task 8 replaces them.

- [ ] **Step 1: Define the template contract**

Create `frontend/src/announcements/templates/types.ts`:

```ts
import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import type { AnnouncementContent, AnnouncementPayload, AnnouncementType } from "@/announcements/types";

export type ViewProps<C = AnnouncementContent, P = AnnouncementPayload> = {
  content: C;
  payload: P;
  countdownAt: string | null;
  now: number;
  standalone: boolean;
};

export type EditorProps<C = AnnouncementContent> = {
  content: C;
  onChange: (next: C) => void;
};

export type AnnouncementTemplate<C = AnnouncementContent, P = AnnouncementPayload> = {
  type: AnnouncementType;
  title: string;
  description: string;
  icon: LucideIcon;
  defaultContent: C;
  Editor: ComponentType<EditorProps<C>>;
  View: ComponentType<ViewProps<C, P>>;
};
```

- [ ] **Step 2: Port the tournament view**

Create `frontend/src/announcements/templates/TournamentTemplate.tsx`. The markup is lifted from the existing `TournamentMode.tsx` — keep every class name so the CSS module keeps working. Two changes from the original: the headline honours the `headline` override, and the countdown falls back to the resolved match's `startDate`.

```tsx
"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, Radio, Swords, Trophy } from "lucide-react";
import type { PointerEvent } from "react";
import { AnnouncementCountdown } from "@/announcements/AnnouncementCountdown";
import type { TournamentContent, TournamentPayload } from "@/announcements/types";
import type { AnnouncementTemplate, ViewProps } from "@/announcements/templates/types";
import styles from "@/announcements/announcements.module.css";

function Team({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div className={styles.team}>
      {logo ? <img src={logo} alt={`${name} logo`} /> : <span>{name.slice(0, 2)}</span>}
      <strong>{name}</strong>
    </div>
  );
}

function TournamentView({ content, payload, countdownAt, now, standalone }: ViewProps<TournamentContent, TournamentPayload>) {
  const match = payload?.match ?? null;
  const state = payload?.state ?? "IDLE";
  const countdownTarget = countdownAt || match?.startDate || null;

  function followPointer(event: PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
  }

  return (
    <section className={`${styles.announcement} ${styles.tournament} ${standalone ? styles.standalone : ""}`} onPointerMove={followPointer}>
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.pointerLight} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.modeLabel}>
          {state === "LIVE" ? <><Radio size={15} /> Live match</> : <><Swords size={15} /> Tournament update</>}
        </div>

        {!match ? (
          <div className={styles.idle}>
            <div><span>Goonginga · Season 9</span><h2>{content.headline || "Match schedule in preparation"}</h2></div>
            <div className={styles.idleActions}>
              <AnnouncementCountdown target={countdownAt} now={now} />
              <Link href="/season-9">View Season 9 <ArrowRight size={18} /></Link>
            </div>
          </div>
        ) : (
          <div className={styles.matchLayout}>
            <div className={styles.matchMeta}>
              <span>{state === "LIVE" ? "Now playing" : "Next match"}</span>
              <h2>{content.headline || match.title || `${match.teamA.name} vs ${match.teamB.name}`}</h2>
              <p>{match.type.replace(/_/g, " ")} · Best of {match.bestOf}</p>
            </div>

            <div className={styles.versus}>
              <Team name={match.teamA.name} logo={match.teamA.logo} />
              {state === "LIVE" ? (
                <div className={styles.liveScore}><strong>{match.mapWinsTeamA}</strong><span>LIVE</span><strong>{match.mapWinsTeamB}</strong></div>
              ) : <span className={styles.vs}>VS</span>}
              <Team name={match.teamB.name} logo={match.teamB.logo} />
            </div>

            <div className={styles.actionArea}>
              {state === "LIVE" ? (
                <div className={styles.liveStatus}><i /><span>Game {Math.max(1, match.gameNumber + 1)}</span></div>
              ) : (
                <AnnouncementCountdown target={countdownTarget} now={now} />
              )}
              <Link href={`/schedule/${match.id}`} className={styles.matchLink}>
                {state === "LIVE" ? "Open live match" : <><CalendarClock size={17} /> Match details</>} <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export const TournamentTemplate: AnnouncementTemplate<TournamentContent, TournamentPayload> = {
  type: "TOURNAMENT",
  title: "Tournament",
  description: "Shows a scheduled match, or the live score while a match is running.",
  icon: Trophy,
  defaultContent: { matchId: null, headline: "" },
  Editor: () => null,
  View: TournamentView,
};
```

- [ ] **Step 3: Port the minigame view with the corrected destination**

Create `frontend/src/announcements/templates/MinigameTemplate.tsx`. This is the fix at the centre of the whole sub-project: the old `JeopardyMode` hardcoded `/minigames/jeopardy`, which is an OBS overlay. The destination now comes from saved content and routes through the token handoff.

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Gamepad2, Radio } from "lucide-react";
import { AnnouncementCountdown } from "@/announcements/AnnouncementCountdown";
import type { MinigameContent, MinigamePayload } from "@/announcements/types";
import type { AnnouncementTemplate, ViewProps } from "@/announcements/templates/types";
import styles from "@/announcements/announcements.module.css";

const FALLBACK_COVER = "/ramattra-login-cropped.webp";

// /minigames is the handoff page that carries the signed-in session across to
// the minigames frontend, so the visitor lands on the game already identified.
export function minigameHref(slug: string) {
  return `/minigames?next=${encodeURIComponent(`/${slug}`)}`;
}

function MinigameView({ content, payload, countdownAt, now, standalone }: ViewProps<MinigameContent, MinigamePayload>) {
  const game = payload?.game ?? null;
  const live = payload?.state === "LIVE";
  const [cover, setCover] = useState(game?.coverImageUrl || FALLBACK_COVER);

  useEffect(() => setCover(game?.coverImageUrl || FALLBACK_COVER), [game?.coverImageUrl]);

  return (
    <section className={`${styles.announcement} ${styles.minigame} ${standalone ? styles.standalone : ""}`}>
      {game ? <img className={styles.minigameCover} src={cover} onError={() => setCover(FALLBACK_COVER)} alt="" /> : null}
      <div className={styles.minigameShade} />
      <div className={styles.inner}>
        <div className={styles.modeLabel}><Gamepad2 size={16} /> Minigame</div>
        <div className={styles.minigameContent}>
          <div>
            <span>{game ? <><Radio size={14} /> {live ? "Live now" : "Starts soon"}</> : "Minigames"}</span>
            <h2>{game?.title || "Upcoming minigame"}</h2>
            <p>{game?.description || "The next game will appear here once it is published."}</p>
          </div>
          <div className={styles.minigameActions}>
            <AnnouncementCountdown target={countdownAt} now={now} />
            {content.minigameSlug ? (
              <Link href={minigameHref(content.minigameSlug)} className={styles.minigameLink}>
                {content.ctaLabel || "Open the game"} <ArrowRight size={18} />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export const MinigameTemplate: AnnouncementTemplate<MinigameContent, MinigamePayload> = {
  type: "MINIGAME",
  title: "Minigame",
  description: "Promotes a published minigame and sends visitors straight into it.",
  icon: Gamepad2,
  defaultContent: { minigameSlug: "", ctaLabel: "" },
  Editor: () => null,
  View: MinigameView,
};
```

- [ ] **Step 4: Write the custom view**

Create `frontend/src/announcements/templates/CustomTemplate.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import { AnnouncementCountdown } from "@/announcements/AnnouncementCountdown";
import type { CustomContent } from "@/announcements/types";
import type { AnnouncementTemplate, ViewProps } from "@/announcements/templates/types";
import styles from "@/announcements/announcements.module.css";

function CustomView({ content, countdownAt, now, standalone }: ViewProps<CustomContent, null>) {
  const external = /^https?:\/\//i.test(content.ctaHref);

  return (
    <section className={`${styles.announcement} ${styles.custom} ${standalone ? styles.standalone : ""}`}>
      {content.imageUrl ? <img className={styles.customCover} src={content.imageUrl} alt="" /> : null}
      <div className={styles.customShade} />
      <div className={styles.inner}>
        <div className={styles.modeLabel}><Megaphone size={16} /> {content.eyebrow || "Announcement"}</div>
        <div className={styles.customContent}>
          <div>
            <h2>{content.headline}</h2>
            {content.body ? <p>{content.body}</p> : null}
          </div>
          <div className={styles.customActions}>
            <AnnouncementCountdown target={countdownAt} now={now} />
            {content.ctaHref && content.ctaLabel ? (
              external ? (
                <a href={content.ctaHref} target="_blank" rel="noopener noreferrer" className={styles.customLink}>
                  {content.ctaLabel} <ArrowRight size={18} />
                </a>
              ) : (
                <Link href={content.ctaHref} className={styles.customLink}>
                  {content.ctaLabel} <ArrowRight size={18} />
                </Link>
              )
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export const CustomTemplate: AnnouncementTemplate<CustomContent, null> = {
  type: "CUSTOM",
  title: "Custom",
  description: "A free-form announcement with your own copy, image and button.",
  icon: Megaphone,
  defaultContent: { eyebrow: "", headline: "", body: "", imageUrl: "", ctaLabel: "", ctaHref: "" },
  Editor: () => null,
  View: CustomView,
};
```

- [ ] **Step 5: Rewrite the registry**

Replace the entire contents of `frontend/src/announcements/registry.ts`:

```ts
import type { AnnouncementType } from "@/announcements/types";
import type { AnnouncementTemplate } from "@/announcements/templates/types";
import { TournamentTemplate } from "@/announcements/templates/TournamentTemplate";
import { MinigameTemplate } from "@/announcements/templates/MinigameTemplate";
import { CustomTemplate } from "@/announcements/templates/CustomTemplate";

// Cast through unknown: each template is precisely typed for its own content
// and payload, and the registry deliberately erases that to a common shape.
export const announcementTemplates = [
  TournamentTemplate,
  MinigameTemplate,
  CustomTemplate,
] as unknown as AnnouncementTemplate[];

const byType = new Map(announcementTemplates.map((template) => [template.type, template]));

export function getTemplate(type: AnnouncementType) {
  return byType.get(type) ?? null;
}
```

- [ ] **Step 6: Rename the Jeopardy CSS classes and add the custom ones**

In `frontend/src/announcements/announcements.module.css`, rename every `.jeopardy*` class to its `.minigame*` equivalent (`.jeopardy` → `.minigame`, `.jeopardyCover` → `.minigameCover`, `.jeopardyShade` → `.minigameShade`, `.jeopardyContent` → `.minigameContent`, `.jeopardyActions` → `.minigameActions`, `.jeopardyLink` → `.minigameLink`), including inside any media queries.

Then append the custom template's classes, reusing the same visual language:

```css
.custom {
  position: relative;
  overflow: hidden;
}

.customCover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.customShade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(4, 6, 12, 0.55) 0%, rgba(4, 6, 12, 0.94) 88%);
}

.customContent {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.customActions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 14px;
}

.customLink {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
```

Confirm no `.jeopardy` remains: `grep -n "jeopardy" frontend/src/announcements/announcements.module.css` should print nothing.

- [ ] **Step 7: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: remaining errors only in `AnnouncementRenderer.tsx`, `AnnouncementModeControl.tsx`, `JeopardyMode.tsx` and `TournamentMode.tsx`, all handled in Tasks 7 and 10.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/announcements
git commit -m "feat(announcements): add tournament, minigame and custom template views"
```

---

### Task 7: Rewrite the public renderer

**Files:**
- Rewrite: `frontend/src/announcements/AnnouncementRenderer.tsx`
- Delete: `frontend/src/announcements/TournamentMode.tsx`
- Delete: `frontend/src/announcements/JeopardyMode.tsx`

**Interfaces:**
- Consumes: `getActiveAnnouncement()` from Task 5, `getTemplate()` from Task 6.
- Produces: `<AnnouncementRenderer standalone? />`, unchanged prop surface. Consumers (`app/page.tsx`, `app/announcements/page.tsx`) need no edit.

- [ ] **Step 1: Rewrite the renderer**

Replace the entire contents of `frontend/src/announcements/AnnouncementRenderer.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getActiveAnnouncement } from "@/lib/api/announcement";
import { getTemplate } from "@/announcements/registry";
import type { ActiveAnnouncement } from "@/announcements/types";
import styles from "@/announcements/announcements.module.css";

export function AnnouncementRenderer({ standalone = false }: { standalone?: boolean }) {
  const [active, setActive] = useState<ActiveAnnouncement | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let mounted = true;
    const load = () =>
      getActiveAnnouncement()
        .then((data) => { if (mounted) setActive(data); })
        .catch(() => undefined);

    void load();
    const poll = window.setInterval(load, 12000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { mounted = false; window.clearInterval(poll); window.clearInterval(clock); };
  }, []);

  if (!active) return standalone ? <div className={styles.loading}>Loading event...</div> : null;
  if (!active.enabled || !active.announcement) {
    return standalone ? <div className={styles.loading}>No active league event.</div> : null;
  }

  const template = getTemplate(active.announcement.type);
  if (!template) return null;

  const { View } = template;
  return (
    <View
      content={active.announcement.content}
      payload={active.payload}
      countdownAt={active.announcement.countdownAt}
      now={now}
      standalone={standalone}
    />
  );
}
```

- [ ] **Step 2: Delete the superseded mode components**

```bash
git rm frontend/src/announcements/TournamentMode.tsx frontend/src/announcements/JeopardyMode.tsx
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: the only remaining error is in `AnnouncementModeControl.tsx`, deleted in Task 10.

- [ ] **Step 4: Verify the landing page renders the announcement again**

Start the backend (`cd backend && node app.js`) and the frontend (`cd frontend && npm run dev`), then open `http://localhost:3000/`.

Expected: the "Community events and broadcasts" section shows the published announcement exactly as before the migration. Also open `http://localhost:3000/announcements` and confirm the standalone version renders.

If the published announcement is the MINIGAME one, its button must now point at `/minigames?next=/<slug>` — hover it and read the status bar. That is the whole point of this task; if it still says `/minigames/jeopardy`, the wrong component is rendering.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/announcements
git commit -m "feat(announcements): drive the public renderer from the template registry"
```

---

### Task 8: Template editors

**Files:**
- Modify: `frontend/src/announcements/templates/TournamentTemplate.tsx`
- Modify: `frontend/src/announcements/templates/MinigameTemplate.tsx`
- Modify: `frontend/src/announcements/templates/CustomTemplate.tsx`
- Create: `frontend/src/announcements/studio.module.css`

**Interfaces:**
- Consumes: `EditorProps<C>` from Task 6; `getMatches()` from `@/lib/api/match`; `listMiniGames()` from `@/lib/api/minigame`.
- Produces: a real `Editor` on each template, replacing the `() => null` placeholders. Studio styles live in `studio.module.css` and are consumed by both the editors and Task 9.

- [ ] **Step 1: Write the studio stylesheet**

Create `frontend/src/announcements/studio.module.css`:

```css
.field {
  display: grid;
  gap: 6px;
  margin-bottom: 16px;
}

.field > span {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted);
}

.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-primary);
  color: var(--color-foreground);
  font: inherit;
}

.field textarea {
  min-height: 92px;
  resize: vertical;
}

.hint {
  margin: 0;
  font-size: 0.76rem;
  color: var(--color-muted);
}

.warning {
  margin: 0;
  font-size: 0.76rem;
  color: var(--color-warning, #f0b429);
}
```

- [ ] **Step 2: Add the tournament editor**

In `TournamentTemplate.tsx`, add the imports and the editor, then point the template's `Editor` at it.

The file already has `import type { PointerEvent } from "react";` — **merge** the hooks into that
line rather than adding a second react import, or `no-duplicate-imports` will flag it:

```tsx
import { useEffect, useState, type PointerEvent } from "react";
```

Then add these three new import lines:

```tsx
import { getMatches } from "@/lib/api/match";
import type { Match } from "@/lib/api/types";
import type { EditorProps } from "@/announcements/templates/types";
import studio from "@/announcements/studio.module.css";
```

`Match` is exported as an interface from `frontend/src/lib/api/types.ts:136`. Its `status` field is
the same union used in `AnnouncementMatch`.

Add the component above the exported template:

```tsx
function TournamentEditor({ content, onChange }: EditorProps<TournamentContent>) {
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    void getMatches({ cache: "no-store" })
      .then((all) => setMatches(all.filter((match) => match.status === "SCHEDULED" || match.status === "ACTIVE")))
      .catch(() => setMatches([]));
  }, []);

  return (
    <>
      <label className={studio.field}>
        <span>Match</span>
        <select
          value={content.matchId === null ? "" : String(content.matchId)}
          onChange={(event) => onChange({ ...content, matchId: event.target.value ? Number(event.target.value) : null })}
        >
          <option value="">Automatic — live match, otherwise the next scheduled one</option>
          {matches.map((match) => (
            <option key={match.id} value={match.id}>
              {match.title || `Match #${match.id}`} · {match.status}
            </option>
          ))}
        </select>
      </label>
      <label className={studio.field}>
        <span>Headline override</span>
        <input
          value={content.headline}
          placeholder="Leave empty to use the match title"
          onChange={(event) => onChange({ ...content, headline: event.target.value })}
        />
      </label>
    </>
  );
}
```

Change the template's `Editor: () => null,` to `Editor: TournamentEditor,`.

- [ ] **Step 3: Add the minigame editor**

In `MinigameTemplate.tsx`, add to the imports. `useEffect` and `useState` are already imported from
Task 6 — do not add them again. Keep the value and type imports from `minigame` on one line:

```tsx
import { listMiniGames, type JeopardyGame } from "@/lib/api/minigame";
import type { EditorProps } from "@/announcements/templates/types";
import studio from "@/announcements/studio.module.css";
```

Add above the exported template:

```tsx
function MinigameEditor({ content, onChange }: EditorProps<MinigameContent>) {
  const [games, setGames] = useState<JeopardyGame[]>([]);

  useEffect(() => {
    void listMiniGames().then(setGames).catch(() => setGames([]));
  }, []);

  const known = games.some((game) => game.slug === content.minigameSlug);

  return (
    <>
      <label className={studio.field}>
        <span>Game</span>
        <select value={content.minigameSlug} onChange={(event) => onChange({ ...content, minigameSlug: event.target.value })}>
          <option value="">Choose a game</option>
          {games.map((game) => (
            <option key={game.id} value={game.slug}>
              {game.title} · /{game.slug} {game.status === "LIVE" ? "" : "(under development)"}
            </option>
          ))}
        </select>
      </label>
      {content.minigameSlug && !known ? (
        <p className={studio.warning}>
          /{content.minigameSlug} is not in the game library any more. Pick another game before publishing.
        </p>
      ) : null}
      <label className={studio.field}>
        <span>Button label</span>
        <input
          value={content.ctaLabel}
          placeholder="Open the game"
          onChange={(event) => onChange({ ...content, ctaLabel: event.target.value })}
        />
      </label>
      <p className={studio.hint}>
        Visitors are signed in on the way through, so they land inside the game with their account.
      </p>
    </>
  );
}
```

Change `Editor: () => null,` to `Editor: MinigameEditor,`.

- [ ] **Step 4: Add the custom editor**

In `CustomTemplate.tsx`, add to the imports:

```tsx
import type { EditorProps } from "@/announcements/templates/types";
import studio from "@/announcements/studio.module.css";
```

Add above the exported template:

```tsx
function CustomEditor({ content, onChange }: EditorProps<CustomContent>) {
  const set = (patch: Partial<CustomContent>) => onChange({ ...content, ...patch });

  return (
    <>
      <label className={studio.field}>
        <span>Eyebrow</span>
        <input value={content.eyebrow} placeholder="Announcement" onChange={(event) => set({ eyebrow: event.target.value })} />
      </label>
      <label className={studio.field}>
        <span>Headline</span>
        <input value={content.headline} onChange={(event) => set({ headline: event.target.value })} />
      </label>
      <label className={studio.field}>
        <span>Body</span>
        <textarea value={content.body} onChange={(event) => set({ body: event.target.value })} />
      </label>
      <label className={studio.field}>
        <span>Background image URL</span>
        <input value={content.imageUrl} placeholder="/landing/overview.webp" onChange={(event) => set({ imageUrl: event.target.value })} />
      </label>
      <label className={studio.field}>
        <span>Button label</span>
        <input value={content.ctaLabel} onChange={(event) => set({ ctaLabel: event.target.value })} />
      </label>
      <label className={studio.field}>
        <span>Button link</span>
        <input value={content.ctaHref} placeholder="/schedule" onChange={(event) => set({ ctaHref: event.target.value })} />
      </label>
      <p className={studio.hint}>Links must be an internal path such as /schedule, or a full https:// address.</p>
    </>
  );
}
```

Change `Editor: () => null,` to `Editor: CustomEditor,`.

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: the only remaining error is `AnnouncementModeControl.tsx`, deleted in Task 10.

If `Match` is not exported from `@/lib/api/types`, import it from `@/lib/api` instead — the manager dashboard imports it that way at `frontend/src/app/manager-dashboard/page.tsx:30`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/announcements
git commit -m "feat(announcements): add per-template editors for the studio"
```

---

### Task 9: The studio

**Files:**
- Create: `frontend/src/announcements/AnnouncementStudio.tsx`
- Modify: `frontend/src/announcements/studio.module.css`

**Interfaces:**
- Consumes: the API client from Task 5, the registry from Task 6, the editors from Task 8, `readNetworkSessionToken` from `@/features/networkSession/storage`.
- Produces: `<AnnouncementStudio />`, a self-contained component with no props, mounted in Task 10.

- [ ] **Step 1: Append the studio layout styles**

Append to `frontend/src/announcements/studio.module.css`:

```css
.studio { display: grid; gap: 20px; }

.header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; }
.header h2 { margin: 4px 0 0; }
.kicker { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-accent); }

.list { display: grid; gap: 10px; }

.row {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  text-align: left;
  width: 100%;
}
.rowLive { border-color: var(--color-accent); }
.rowMeta { display: grid; gap: 2px; flex: 1; min-width: 0; }
.rowMeta strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rowMeta small { color: var(--color-muted); font-size: 0.74rem; }
.liveTag {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px;
  background: var(--color-accent); color: #08111f;
  font-size: 0.68rem; font-weight: 900; text-transform: uppercase;
}

.editorGrid { display: grid; gap: 24px; grid-template-columns: minmax(0, 380px) minmax(0, 1fr); align-items: start; }
@media (max-width: 900px) { .editorGrid { grid-template-columns: 1fr; } }

.previewPane { display: grid; gap: 10px; position: sticky; top: 88px; }
.previewLabel { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: var(--color-muted); }
.previewFrame { border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; }

.footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.actions { display: flex; align-items: center; gap: 10px; }
.message { font-size: 0.78rem; color: var(--color-muted); }
.error { font-size: 0.78rem; color: var(--color-danger, #ff8080); }

.primary, .secondary, .danger, .toggle {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 16px; border-radius: 4px;
  font-size: 0.78rem; font-weight: 800; cursor: pointer;
  border: 1px solid var(--color-border); background: var(--color-surface-elevated); color: var(--color-foreground);
}
.primary { background: var(--color-accent); border-color: var(--color-accent); color: #08111f; }
.danger { color: var(--color-danger, #ff8080); }
.toggleOn { background: var(--color-accent); border-color: var(--color-accent); color: #08111f; }
.primary:disabled, .secondary:disabled, .danger:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 2: Write the studio**

Create `frontend/src/announcements/AnnouncementStudio.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Plus, Power, Radio, RefreshCw, Save, Trash2 } from "lucide-react";
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncementSettings,
  listAnnouncements,
  previewAnnouncement,
  updateAnnouncement,
  updateAnnouncementSettings,
} from "@/lib/api/announcement";
import { announcementTemplates, getTemplate } from "@/announcements/registry";
import type { Announcement, AnnouncementContent, AnnouncementPayload, AnnouncementType } from "@/announcements/types";
import { readNetworkSessionToken } from "@/features/networkSession/storage";
import styles from "@/announcements/studio.module.css";

type Draft = { id: number | null; name: string; type: AnnouncementType; content: AnnouncementContent; countdownAt: string };

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function toIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function draftFrom(announcement: Announcement): Draft {
  return {
    id: announcement.id,
    name: announcement.name,
    type: announcement.type,
    content: announcement.content,
    countdownAt: toDateTimeInput(announcement.countdownAt),
  };
}

export function AnnouncementStudio() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [publishedId, setPublishedId] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [payload, setPayload] = useState<AnnouncementPayload>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const load = useCallback(async () => {
    const token = readNetworkSessionToken();
    if (!token) return;
    try {
      const [list, settings] = await Promise.all([listAnnouncements(token), getAnnouncementSettings(token)]);
      setAnnouncements(list);
      setPublishedId(settings.publishedId);
      setEnabled(settings.enabled);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load announcements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // The preview must reflect unsaved edits, so it is driven by the draft rather
  // than by the saved row. Debounced to keep typing responsive.
  useEffect(() => {
    if (!draft) { setPayload(null); return; }
    const token = readNetworkSessionToken();
    if (!token) return;
    const timeout = window.setTimeout(() => {
      void previewAnnouncement(token, draft.type, draft.content)
        .then((result) => { setPayload(result.payload); setError(""); })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Preview unavailable."));
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [draft?.type, draft?.content]);

  const template = useMemo(() => (draft ? getTemplate(draft.type) : null), [draft?.type]);

  function startNew(type: AnnouncementType) {
    const chosen = getTemplate(type);
    if (!chosen) return;
    setMessage("");
    setError("");
    setDraft({ id: null, name: chosen.title, type, content: chosen.defaultContent, countdownAt: "" });
  }

  async function save() {
    const token = readNetworkSessionToken();
    if (!token || !draft) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const saved = draft.id
        ? await updateAnnouncement(token, draft.id, { name: draft.name, content: draft.content, countdownAt: toIso(draft.countdownAt) })
        : await createAnnouncement(token, { name: draft.name, type: draft.type, content: draft.content, countdownAt: toIso(draft.countdownAt) });
      setDraft(draftFrom(saved));
      await load();
      setMessage("Saved. Nothing changed on the homepage yet.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this announcement.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    const token = readNetworkSessionToken();
    if (!token || !draft?.id) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const settings = await updateAnnouncementSettings(token, { publishedId: draft.id });
      setPublishedId(settings.publishedId);
      setEnabled(settings.enabled);
      setMessage(settings.enabled ? "This announcement is live on the homepage." : "Published, but the announcement area is hidden.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not publish this announcement.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleVisibility() {
    const token = readNetworkSessionToken();
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const settings = await updateAnnouncementSettings(token, { enabled: !enabled });
      setEnabled(settings.enabled);
      setMessage(settings.enabled ? "The announcement area is visible." : "The announcement area is hidden.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not change visibility.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setMessage("Click delete again to confirm.");
      return;
    }
    const token = readNetworkSessionToken();
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      await deleteAnnouncement(token, id);
      setConfirmDelete(null);
      if (draft?.id === id) setDraft(null);
      await load();
      setMessage("Announcement deleted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete this announcement.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className={styles.message}><RefreshCw size={18} className="animate-spin" /> Loading announcements</div>;
  }

  if (draft && template) {
    const { Editor, View } = template;
    return (
      <section className={styles.studio}>
        <button type="button" className={styles.secondary} onClick={() => setDraft(null)}>
          <ArrowLeft size={16} /> All announcements
        </button>

        <div className={styles.header}>
          <div>
            <span className={styles.kicker}>{template.title}</span>
            <h2>{draft.id ? "Edit announcement" : "New announcement"}</h2>
          </div>
        </div>

        <div className={styles.editorGrid}>
          <div>
            <label className={styles.field}>
              <span>Name (only you see this)</span>
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>

            <Editor content={draft.content} onChange={(content) => setDraft({ ...draft, content })} />

            <label className={styles.field}>
              <span>Countdown</span>
              <input
                type="datetime-local"
                value={draft.countdownAt}
                onChange={(event) => setDraft({ ...draft, countdownAt: event.target.value })}
              />
            </label>
            <p className={styles.hint}>Optional, in your local time. Leave empty for no countdown.</p>
          </div>

          <div className={styles.previewPane}>
            <span className={styles.previewLabel}>Live preview</span>
            <div className={styles.previewFrame}>
              <View content={draft.content} payload={payload} countdownAt={toIso(draft.countdownAt)} now={Date.now()} standalone={false} />
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => void save()} disabled={busy}>
              <Save size={16} /> {busy ? "Working" : "Save"}
            </button>
            <button type="button" className={styles.primary} onClick={() => void publish()} disabled={busy || !draft.id}>
              <Radio size={16} /> Publish
            </button>
            {draft.id ? null : <span className={styles.hint}>Save it once before publishing.</span>}
          </div>
          {error ? <span className={styles.error} aria-live="polite">{error}</span> : null}
          {!error && message ? <span className={styles.message} aria-live="polite">{message}</span> : null}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.studio}>
      <div className={styles.header}>
        <div>
          <span className={styles.kicker}>Homepage</span>
          <h2>Announcements</h2>
          <p className={styles.hint}>One announcement shows on the homepage. Save as many as you like and publish the one you want.</p>
        </div>
        <div className={styles.actions}>
          <Link href="/announcements" target="_blank" className={styles.secondary}>
            Open output <ExternalLink size={15} />
          </Link>
          <button
            type="button"
            className={`${styles.toggle} ${enabled ? styles.toggleOn : ""}`}
            onClick={() => void toggleVisibility()}
            role="switch"
            aria-checked={enabled}
            disabled={busy}
          >
            <Power size={16} /> {enabled ? "Visible" : "Hidden"}
          </button>
        </div>
      </div>

      <div className={styles.actions}>
        {announcementTemplates.map(({ type, title, icon: Icon }) => (
          <button type="button" key={type} className={styles.secondary} onClick={() => startNew(type)}>
            <Plus size={15} /> <Icon size={15} /> {title}
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {announcements.map((announcement) => {
          const live = announcement.id === publishedId;
          const meta = getTemplate(announcement.type);
          return (
            <div key={announcement.id} className={`${styles.row} ${live ? styles.rowLive : ""}`}>
              <button type="button" className={styles.rowMeta} onClick={() => setDraft(draftFrom(announcement))}>
                <strong>{announcement.name}</strong>
                <small>{meta?.title || announcement.type} · edited {new Date(announcement.updatedAt).toLocaleString()}</small>
              </button>
              {live ? <span className={styles.liveTag}><Radio size={12} /> On homepage</span> : null}
              <button
                type="button"
                className={styles.danger}
                onClick={() => void remove(announcement.id)}
                disabled={busy}
                title={confirmDelete === announcement.id ? "Confirm deletion" : "Delete announcement"}
              >
                <Trash2 size={15} /> {confirmDelete === announcement.id ? "Confirm" : "Delete"}
              </button>
            </div>
          );
        })}
        {announcements.length === 0 ? <p className={styles.hint}>No announcements saved yet. Create one above.</p> : null}
      </div>

      {error ? <p className={styles.error} aria-live="polite">{error}</p> : null}
      {!error && message ? <p className={styles.message} aria-live="polite">{message}</p> : null}
    </section>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: the only remaining error is `AnnouncementModeControl.tsx`, deleted in Task 10.

If `View` rejects the `payload` union, widen the registry cast rather than loosening the template types — the erasure is deliberate and documented in `registry.ts`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/announcements
git commit -m "feat(announcements): add the announcement studio"
```

---

### Task 10: Mount the studio and remove the old control

**Files:**
- Modify: `frontend/src/app/social-media-dashboard/page.tsx`
- Delete: `frontend/src/announcements/AnnouncementModeControl.tsx`
- Modify: `frontend/src/app/social-media-dashboard/social-dashboard.module.css`

**Interfaces:**
- Consumes: `<AnnouncementStudio />` from Task 9.
- Produces: nothing new. This is the wiring task.

- [ ] **Step 1: Swap the component in the dashboard**

In `frontend/src/app/social-media-dashboard/page.tsx`, replace the import

```tsx
import { AnnouncementModeControl } from "@/announcements/AnnouncementModeControl";
```

with

```tsx
import { AnnouncementStudio } from "@/announcements/AnnouncementStudio";
```

and in the `league` workspace body replace `<AnnouncementModeControl />` with `<AnnouncementStudio />`. Leave `<ManagerDashboardFrame />` untouched — the iframe is sub-project 3's problem.

- [ ] **Step 2: Delete the old control**

```bash
git rm frontend/src/announcements/AnnouncementModeControl.tsx
```

- [ ] **Step 3: Remove its orphaned styles**

`AnnouncementModeControl` imported `social-dashboard.module.css`. Delete the now-unused rules from `frontend/src/app/social-media-dashboard/social-dashboard.module.css`: `.announcementControl`, `.controlHeader`, `.controlLoading`, `.modeOptions`, `.modeOption`, `.modeSelected`, `.modeIcon`, `.modeCheck`, `.countdownControl`, `.countdownCopy`, `.clearCountdown`, `.controlFooter`, `.visibilityToggle`, `.toggleEnabled`, `.publishArea`, `.saveMessage`, `.publishButton`, `.lastUpdated`, `.outlineAction`.

Before deleting each one, confirm nothing else uses it:

```bash
grep -rn "outlineAction\|publishButton\|modeOption" frontend/src --include=*.tsx
```

Keep any class that still has a consumer — `.kicker` and `.sectionHeading` are used by the dashboard page itself.

- [ ] **Step 4: Typecheck and build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: both clean, no errors.

- [ ] **Step 5: Exercise the studio end to end**

Start the backend and frontend, sign in as a `SOCIAL_MEDIA` or `ADMIN` member, open `http://localhost:3000/social-media-dashboard` on the "Goonginga League" tab, and verify each of these:

1. The saved announcements list renders, with a clear marker on the published one.
2. "Custom" creates a draft; typing a headline updates the preview within about half a second.
3. Entering `javascript:alert(1)` as the button link and pressing Save shows the validation error rather than saving.
4. Save then Publish moves the "On homepage" marker onto the new announcement.
5. The homepage at `/` now shows that announcement.
6. The visibility toggle hides the announcement from `/` and `/announcements`.
7. A MINIGAME announcement's button goes to `/minigames?next=/<slug>` and lands you inside the game, signed in.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat(announcements): replace the mode control with the announcement studio"
```

---

### Task 11: Disambiguate the /minigames route

**Files:**
- Create: `frontend/src/app/overlay/jeopardy-podium/page.tsx`
- Create: `frontend/src/app/overlay/jeopardy-podium/jeopardy-podium.module.css`
- Create: `frontend/src/app/overlay/jeopardy-scores/page.tsx`
- Create: `frontend/src/app/overlay/jeopardy-scores/jeopardy-scores.module.css`
- Delete: `frontend/src/app/minigames/jeopardy/`, `frontend/src/app/minigames/jeopardy-overview/`, `frontend/src/app/minigames/family-feud.module.css`, `frontend/src/app/minigames/minigames-directory.module.css`
- Modify: `frontend/next.config.ts`
- Modify: `frontend/src/components/layout/RouteAwareShell.tsx`
- Modify: `frontend/src/minigames/JeopardyDashboard.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `/overlay/jeopardy-podium` and `/overlay/jeopardy-scores`, with the old paths kept as permanent-free redirects.

- [ ] **Step 1: Move the two overlays with git so history follows**

```bash
cd frontend/src/app
git mv minigames/jeopardy overlay/jeopardy-podium
git mv overlay/jeopardy-podium/jeopardy.module.css overlay/jeopardy-podium/jeopardy-podium.module.css
git mv minigames/jeopardy-overview overlay/jeopardy-scores
git mv overlay/jeopardy-scores/jeopardy-overview.module.css overlay/jeopardy-scores/jeopardy-scores.module.css
```

Then fix the stylesheet import in each moved `page.tsx`:

- `overlay/jeopardy-podium/page.tsx`: `import styles from "./jeopardy.module.css";` → `import styles from "./jeopardy-podium.module.css";`
- `overlay/jeopardy-scores/page.tsx`: `import styles from "./jeopardy-overview.module.css";` → `import styles from "./jeopardy-scores.module.css";`

- [ ] **Step 2: Delete the two orphaned stylesheets**

`family-feud.module.css` and `minigames-directory.module.css` sit in `app/minigames/` but nothing imports them — the handoff page uses inline styles.

Confirm, then delete:

```bash
grep -rn "family-feud.module.css\|minigames-directory.module.css" frontend/src
git rm frontend/src/app/minigames/family-feud.module.css frontend/src/app/minigames/minigames-directory.module.css
```

Expected: the grep prints nothing before the removal. If it prints a consumer, keep that file.

- [ ] **Step 3: Add redirects so saved OBS scenes keep working**

Replace `frontend/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    // The Jeopardy OBS overlays used to live under /minigames, which also means
    // "hand off to the minigames site". These keep already-saved OBS scenes
    // working; remove them once every scene URL has been updated.
    return [
      { source: "/minigames/jeopardy", destination: "/overlay/jeopardy-podium", permanent: false },
      { source: "/minigames/jeopardy-overview", destination: "/overlay/jeopardy-scores", permanent: false },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 4: Drop the /minigames chrome exemption**

`RouteAwareShell` strips the navbar and footer for anything under `/minigames`, which existed for the overlays. `/minigames` is now only the handoff page, and `/overlay` already covers the moved routes.

In `frontend/src/components/layout/RouteAwareShell.tsx`, delete this line:

```tsx
  const isMinigamesRoute = pathname.startsWith("/minigames");
```

and remove `isMinigamesRoute ||` from the condition below it.

- [ ] **Step 5: Repoint the dashboard's overlay links**

In `frontend/src/minigames/JeopardyDashboard.tsx`, the manage header links to both overlays (around line 276) and the finalized panel links to the podium (around line 328). Update all three:

- `href="/minigames/jeopardy-overview"` → `href="/overlay/jeopardy-scores"`
- `href="/minigames/jeopardy"` → `href="/overlay/jeopardy-podium"` (two occurrences)

Leave the broken `/minigames?view=manager` link at line 229 alone — this component is removed in sub-project 2.

- [ ] **Step 6: Verify no stale references remain**

Run: `grep -rn "minigames/jeopardy" frontend/src`
Expected: no results. Any hit outside `next.config.ts` is a link that was missed.

- [ ] **Step 7: Build and check both overlays**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: clean.

Then with the dev server running, open `http://localhost:3000/overlay/jeopardy-podium` and `http://localhost:3000/overlay/jeopardy-scores`.

Expected: both render with a transparent background and **no navbar or footer**. Then open `http://localhost:3000/minigames/jeopardy` and confirm it redirects to the podium route.

Finally open `http://localhost:3000/minigames` and confirm it still performs the handoff — it must now render **with** the navbar, since the exemption is gone. That is the intended change.

- [ ] **Step 8: Commit**

```bash
git add frontend
git commit -m "refactor(minigames): move the jeopardy overlays to /overlay and free the /minigames route"
```

---

## Post-implementation

Hand to whoever runs the stream: the two Jeopardy browser sources in OBS should be repointed to `/overlay/jeopardy-podium` and `/overlay/jeopardy-scores`. Once done, the redirects in `frontend/next.config.ts` can be deleted.

Sub-project 2 (minigames consolidation) picks up from here: it removes `frontend/src/minigames/JeopardyDashboard.tsx` and the "Minigames" workspace from `social-media-dashboard`, and collapses the four management surfaces in `minigames-frontend` into a single `/manage`.
