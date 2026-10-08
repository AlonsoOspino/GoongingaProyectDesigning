# Casting game logs

The casting control room reads Overwatch Workshop files through the browser. OBS is a separate WebSocket connection; OBS neither requests this folder nor parses its files.

## Recording setup

1. Import **M3FFX** (SupaScrim) into the Overwatch custom game.
2. On the recording PC, enable **Enable Workshop Inspector** and **Enable Workshop Inspector Log File** in Overwatch Gameplay settings.
3. Select `Documents\Overwatch\Workshop` from **Connect Workshop folder** in the casting control room. The browser requests read permission only. An entered filesystem path cannot grant browser access.
4. Arm the watcher before the first round starts by entering the web match's Playing stage. A new round-one `setup_complete` must arrive after arming. If the caster connects after it happened, use manual results for that map.

The recorder must stay in the custom game. Files are local to clients that enabled logging. The folder handle remains only in this page's memory; reloads require selecting it again. Unsupported or insecure browsers expose an explicit message and allow manual controls. Folder polling never requests write access, uploads raw logs, or recursively scans child folders.

Sources: [SupaScrim author recording guide](https://supatimer.com/en/guides/overwatch-scrim-logs), [M3FFX official public metadata](https://workshop.codes/M3FFX.json), [browser picker permissions](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker), [permission checks](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission).

## Actual format and supported decisions

SupaScrim documents compatibility with ScrimTime's ordinary CSV rows. The parser's field positions are grounded in the [published ScrimTime schema implementation](https://github.com/luxdotdev/parsertime/blob/main/apps/web/src/lib/parser/schema.ts) and verified against this [complete public ScrimTime log](https://github.com/luxdotdev/parsertime/blob/main/apps/web/test/samples/Log-2024-01-22-20-02-45.txt).

The relevant schema is:

| Event | Fields after the event name | Meaning |
| --- | --- | --- |
| `match_start` | match time, map name, mode, side 1 name, side 2 name | Map/session metadata; emitted before gameplay |
| `hero_spawn` / `hero_swap` | match time, player side, player name, hero, additional fields | Player identity and side |
| `player_stat` | match time, round, player side, player name, hero, stats | Player identity and side; stats do not establish the winner |
| `setup_complete` | match time, round, remaining time | Round becomes live |
| `match_end` | match time, final round, side 1 score, side 2 score | Full map completed; `round_end` alone does not complete it |

Raw lines use an Inspector prefix such as `[00:00:00] ,match_start,...`. Player side labels come from `match_start`, including custom lobby names. They are mapped to website team IDs through exact registered player names. Case and BattleTag numeric suffixes are normalized; accents and punctuation are retained. At least two distinct registered names are required, with one on each side. Duplicate normalized usernames, a player appearing on both sides, multiple website teams on one side, or two log sides mapping to the same website team require manual review. Pass only the two current match rosters to the watcher.

For Control, Escort, Hybrid, Flashpoint and Clash, unequal final integer scores establish the winner. Equal integer scores do **not** prove a draw: payload distance and time-bank tiebreaks can decide Escort/Hybrid. These cases deliberately request a manual result. The parser never guesses a winner from damage, kills, healing or other performance totals.

### SupaScrim Push validation still needed

The [author's M3FFX description](https://workshop.codes/M3FFX) says Push has additional robot metres and winner data and was tested on one of four Push maps. Its public API currently provides no source snippet and no column schema for that extension. Ordinary ScrimTime `match_end` scores cannot establish a Push winner. Therefore Push currently becomes **manual review**, even when its generic final scores differ. A finished M3FFX Push sample with both teams and a known winner is needed before enabling automatic Push results. Validate each relevant Push map; do not borrow an unrelated parser's approximation.

## Watcher contract

`migration-uidesign/frontend/src/lib/casting/logs.ts` exports:

```ts
const watcher = createWorkshopLogWatcher({
  roster: [{ username: "CaptainA", teamId: 1 }, { username: "CaptainB", teamId: 2 }],
  onState(state) { /* render status/message */ },
  onGameStart(event) { /* automatic mode may switch hero bans to gameplay */ },
  async onResult(event) { /* verify current match/game, persist result, then show winner */ },
});

// Called directly from a button click to preserve browser user activation.
await watcher.selectFolder();
// Called once per map when Playing begins; do not re-arm on each render.
await watcher.arm({ matchId: 42, gameNumber: 1, mapName: "Lijiang Tower", startedAt: Date.now() });
watcher.setRoster(updatedCurrentMatchRoster);
watcher.disarm(); // after a result, on leaving Playing, or before the next map
watcher.stop(); // component cleanup
```

`parseWorkshopLog(text, { roster, session, sourceFile?, minimumLiveOffset? })` is pure and returns `unrecognized`, `incomplete`, `review`, `started`, or `complete`. Events carry the web match ID, game number, selected map, mode, matched usernames and file name. Result events also carry final scores and winner team ID. The raw log identity is independent of filename to reject copies.

The control room owns automatic-scene ON/OFF behavior and final result submission. Gate both callbacks against the current match/game, the current automation setting and the server's current stage. A watcher result is evidence for one map; it is not permission to skip to the next map or finish a whole best-of series.

## Freshness, incomplete files and failure behavior

- At arming, snapshot the character boundary of each existing `Log-*.txt` / `Log_*.txt`. Completed preexisting logs are retained as stale identities. Unchanged files never create events.
- A preexisting partial file may continue recording, but its first-round live event must be appended after that snapshot. A new file must have a modification time at or after `startedAt`.
- Parse only newline-terminated rows. A partial trailing write cannot become a final score. A valid result must survive two consecutive unchanged polling observations before delivery.
- Poll every two seconds, inspect only immediate files, and skip files larger than 4 MiB. Re-query read permission each poll. Revocation stops the session and asks for reconnection.
- Never emit a result from mismatched maps, conflicting terminal rows, merged sessions, ambiguous roster mapping, equal scores, or unsupported mode schemas. More than one distinct new final result matching the current map requests manual review.
- Deduplicate terminal identities and starts. Callbacks may be asynchronous; rejected delivery is retried on a subsequent poll. Session changes or component cleanup invalidate in-flight reads before delivery.

Inspector timestamps are elapsed values, not trustworthy absolute match IDs. File freshness, an armed game boundary, map identity and roster identity reduce accidental cross-match association. They do not authenticate client-edited local files. Server result validation and normal caster permissions remain necessary. Tabs can be throttled in the background; this integration is polling and does not promise frame-accurate scene changes.

## Validation

Run from `migration-uidesign/frontend`:

```powershell
node --test src/lib/casting/logs.test.mjs
npx tsc --noEmit --incremental false --noUnusedLocals
```

The tests exercise real-schema rows, side reversal, round-only events, incomplete/censored final rows, wrong maps, duplicate names, insufficient identities, equal scores, unsupported Push, stale files, stable completion, copied logs, live partial files, revoked permissions and unsupported/cancelled picker states. A real Overwatch/OBS rehearsal remains necessary before enabling automation for a live stream, including verification of when the recording client's files actually flush to disk.
