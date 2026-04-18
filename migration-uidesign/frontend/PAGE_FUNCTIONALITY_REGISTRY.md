# Page Functionality Registry

Last updated: 2026-04-17
Target app: Next.js logic-only frontend for Overwatch League live operations

## Scope
This document tracks page-level functionality contracts without UI markup.
No buttons/components are defined yet; only data/API behavior is registered.

## Global App Contracts
- Base API URL is read from NEXT_PUBLIC_API_BASE_URL.
- Auth token is JWT from /member/login.
- All protected API requests must include Authorization: Bearer <token>.
- Canonical API wrappers live in src/lib/api.
- Cross-page orchestration lives in src/features/liveHub.
- Session persistence lives in src/features/session (localStorage + context).

## Session and Auth State
Purpose:
- Provide a single source of truth for JWT/user across all pages without UI coupling.

Modules:
- SessionProvider: global React context wrapper in src/features/session/SessionProvider.tsx
- useSession(): access token/user state
- loginAndPersist(): runs /member/login and stores token+user
- logoutAndClear(): clears session state and storage

Storage behavior:
- key: goon.live.session
- persisted fields: token, user
- hydration: provider restores session on client mount

## 1) LIVE CONTROL PAGE (all-in-one hub)
Purpose:
- Aggregate real-time operational data for managers/captains.

Data load flow:
1. Read token from session/auth state.
2. Call getLiveHubSnapshot(token, draftIds?, tournamentId?).
3. Internally collect:
   - leaderboard (team/leaderboard)
   - soonest match (match/soonest)
   - active matches (match/active)
   - player own stats (playerStat/mine)
   - selected draft states (draft/:id/state)

Supported actions:
- set captain ready/start date on match
- begin map-picking phase
- pick map
- begin ban phase
- ban hero
- end map and move to register stage
- submit map winner
- register stats manually
- register stats via OCR image upload

Failure behavior:
- API errors throw ApiError with status and payload for role-aware handling.

## 2) MAP PICK + BAN DRAFT PAGE
Purpose:
- Manage draft state machine for a single active match.

Read operations:
- getDraftState(draftId)

Write operations:
- createDraft(matchId) [manager/admin]
- startMapPicking(draftId) [manager/admin]
- pickMap(draftId, mapId, teamId?) [captain/manager/admin]
- startBan(draftId) [manager/admin]
- banHero(draftId, heroId|null, teamId?) [captain/manager/admin]
- endMap(draftId) [manager/admin]

State assumptions from backend:
- phase progression: STARTING -> MAPPICKING -> BAN -> ENDMAP -> FINISHED
- timeout auto-actions can happen server-side after 75s
- gameNumber controls map type rotations and pools

## 3) LEADERBOARD PAGE
Purpose:
- Show ranked teams by tournament standings.

Read operations:
- getLeaderboard(tournamentId?)

Sort logic source:
- backend order: victories desc, mapWins desc, mapLoses asc, id asc

## 4) SCHEDULE PAGE
Purpose:
- Show upcoming and active match timeline.

Read operations:
- getMatches()
- getSoonestMatch()
- getActiveMatches()

Update operations by role:
- captain readiness/startDate updates via updateCaptainMatch
- manager operational updates via updateManagerMatch
- manager result submit via submitMatchResult

## 5) PLAYER STAT REGISTER PAGE
Purpose:
- Register player stats manually or from screenshot OCR.

Read operations:
- getMyPlayerStats() [authenticated]
- getAllPlayerStats() [manager]

Write operations:
- createPlayerStat(payload)
- uploadPlayerStatImage(image + optional metadata)

Validation assumptions:
- mapType: CONTROL | HYBRID | PAYLOAD | PUSH | FLASHPOINT
- role: TANK | DPS | SUPPORT
- duration can be seconds or mm:ss/hh:mm:ss (backend normalizes)

## 6) NEWS FEED PAGE (optional in same app shell)
Purpose:
- Keep tournament communications visible in the same frontend domain.

Read operations:
- getNews()

Write operations (editor/admin):
- createNews({ title, content, imageUrl? })

## File Map
- src/lib/api/client.ts: request abstraction + ApiError
- src/lib/api/types.ts: frontend API types
- src/lib/api/index.ts: public API barrel
- src/lib/api/auth.ts
- src/lib/api/team.ts
- src/lib/api/match.ts
- src/lib/api/draft.ts
- src/lib/api/playerStat.ts
- src/lib/api/news.ts
- src/features/liveHub/service.ts: all-in-one snapshot aggregation
- src/features/liveHub/actions.ts: write-action wrappers
- src/features/liveHub/types.ts
- src/features/session/SessionProvider.tsx: auth context provider
- src/features/session/actions.ts: login/logout persistence helpers
- src/features/session/storage.ts: local storage adapter
- src/features/session/types.ts

## Pending Integration Task
When original legacy frontend API/functions are provided, replace current wrappers by:
1. importing legacy functions into src/lib/api,
2. preserving identical function signatures,
3. keeping PAGE_FUNCTIONALITY_REGISTRY.md as the single source of page contracts.
