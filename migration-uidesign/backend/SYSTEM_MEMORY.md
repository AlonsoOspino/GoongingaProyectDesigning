# Backend System Memory

Last reviewed: 2026-04-17
Scope: migration-uidesign/backend

## 1) Runtime and boot
- Tech stack: Express (CommonJS), Prisma, SQLite, JWT, bcrypt, multer, Google Vision API.
- Entrypoint: app.js
- Server port: 3000
- Static files:
  - /assets/heroes -> ../frontend/HeroImages
  - /assets/maps -> ../frontend/MapImages

## 2) Route registry
- /member -> routes/member.js
- /tournament -> routes/tournament.js
- /draftAction -> routes/draftAction.js
- /draftTable -> routes/draftTable.js
- /draft -> routes/draft.js
- /match -> routes/match.js
- /team -> routes/team.js
- /playerStat -> routes/playerStat.js
- /news -> routes/news.js

## 3) Architecture pattern
- Usual flow: route -> controller -> service -> repository -> Prisma.
- Services contain most business logic.
- Repositories are thin Prisma wrappers.
- Exception: member controller also calls member repository directly in some handlers.

## 4) Auth and permissions
- authMiddleware verifies Bearer token and sets req.user.
- JWT payload includes: id, role, teamId.
- Role middlewares:
  - admin: ADMIN only
  - manager: MANAGER only
  - editor: EDITOR or ADMIN
  - captain: CAPTAIN and req.user.teamId must equal req.params.id
  - captainMatch: CAPTAIN and captain team must belong to match in req.params.id
  - captainDraftAction: CAPTAIN and captain team must belong to req.body.matchId

## 5) Module behavior summary

### Member
- register/login in services/authUser.js.
- register creates DEFAULT role with bcrypt hash.
- login supports bcrypt compare and a legacy plain-text fallback.
- profile update:
  - self update or ADMIN only
  - regular users cannot change role/team fields
  - admin update can change role/teamId/password

### Tournament
- create requires name + startDate.
- currently blocks creating more than one tournament in total.
- getCurrent returns first tournament.

### Team
- create requires unique name and tournamentId.
- leaderboard sort: victories desc, mapWins desc, mapLoses asc, id asc.
- captain update only allows name/logo/roster.

### Match
- admin CRUD and round-robin generation.
- round-robin generation requires:
  - valid tournamentId
  - tournament state ROUNDROBIN
  - confirmationText exactly "CONFIRM ROUND ROBIN"
- captain update can set own ready flag and startDate.
- manager update excludes id, bestOf, tournamentId, teamAId, teamBId, allowedMaps.
- submitResult updates mapWins/mapLoses/victories, advances gameNumber, stores mapResults, resets ready flags, and updates draft phase/turn.

### Draft (state machine in services/draft.js)
- lifecycle:
  - createDraft -> STARTING
  - startMapPicking -> MAPPICKING
  - pickMap
  - startBan -> BAN
  - banHero (up to 4 bans total per map)
  - endMap -> ENDMAP + match PENDINGREGISTERS
- timeout rule: 75s turn timeout auto-resolves with random map pick or skip-ban action.
- map type order by game number: CONTROL, HYBRID, PAYLOAD, PUSH, FLASHPOINT.
- game 5 allows FLASHPOINT or CONTROL.
- optional map pool by round from match.mapsAllowedByRound.

### DraftTable and DraftAction (legacy CRUD APIs)
- draftTable routes have admin/manager write and public list.
- draftAction routes have captain create plus admin CRUD and public list.

### News
- public read.
- editor/admin write.

### PlayerStat
- validated create endpoint with numeric parsing, enum checks, and per-10 calculations.
- OCR endpoint:
  - image upload with multer memory storage
  - text extraction via Google Vision
  - stat extraction and normalization in service

## 6) Prisma model map
- Models:
  - Tournament, Team, Member, Match
  - DraftTable, DraftAction
  - News
  - PlayerStat
  - Map, Hero
- Notable match fields:
  - gameNumber, semanas
  - mapsAllowedByRound (Json)
  - mapResults (Json)
  - allowedMaps relation

## 7) Known caveats
- Both middleware/admin.js and middlewares/admin.js exist; active routes import from middlewares.
- package.json lacks start/dev scripts.
- auth middleware uses fallback JWT secret if env is missing.
- login plain-text fallback should be removed once all passwords are hashed.
- single-tournament restriction may be intentional but should be confirmed.

## 8) Where to edit quickly
- New endpoint: routes + controller + service (+ repository if DB).
- Auth changes: middlewares/authMiddleware.js and role middlewares.
- DB schema: prisma/schema.prisma and related repository/service validation.
- Draft behavior: services/draft.js with repositories/match.js submitResult alignment.
