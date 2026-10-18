# Draft animation lab

The developer sandbox is available at:

- Setup and previews: <https://goongingaleague.duckdns.org/dev/draft-app>
- Interactive operator: <https://goongingaleague.duckdns.org/draft-table/dev>
- Broadcast preview: <https://goongingaleague.duckdns.org/draft-table/dev?broadcast=1>

Sign in with an active network account that has the `DEVELOPER` role. The navigation menu includes **Draft Animation Lab** for those accounts.

## Replay the real draft

1. Create two test teams with their names and logos in the lab.
2. Create the practice match and choose its map pool. Include Control maps for game one and other modes for later games. **Select all maps** is convenient for a full walkthrough.
3. Open **Open operator table**. One developer can drive both sides; each pick and ban follows the current team's turn.
4. Open Control map picking, select a map, and start the ban phase. Hero selections play the regular ban ceremony and alternate teams automatically.
5. After the bans, use the phase controls to end the map, record a test winner, then continue through mode selection and the next map.
6. Use **Reset practice** in the operator or **Restart draft** in setup to clear test results, bans and timers and replay. Teams and the map pool remain available.

The preview is a scaled 1920×1080 broadcast canvas. Open it beside the operator to inspect the audience view. It has no operator controls. Header and map-pool overlay previews remain available in the same panel.

The setup panel's manual scores and bans are presentation overrides for testing overlays. Use the operator table to exercise real draft transitions and animations. Restart clears those overrides as well.

## Scope

This is one shared practice sandbox for developers, so coordinate before resetting another developer's test. Its hidden tournament and teams do not enter the public season schedule or standings. The developer operator UI is limited to the `dev` alias resolving to an actual `PRACTICE` match; normal league captain and production permissions remain in effect elsewhere.

Local verification uses the isolated `goonginga_flow_qa` database with synthetic teams and a developer-only account. Production checks are read-only; no Season 9 fixtures or rosters are seeded by this walkthrough.

## Verification, 2026-10-17

- Production frontend build and TypeScript check passed; seven permission tests passed.
- In the compiled local UI, a developer-only account completed Control map selection, four alternating hero bans, Playing → Endmap, a test result, the losing team's Hybrid selection, and a second map's ban phase. Own previous bans stayed disabled while the opponent's previous bans stayed available.
- Reset returned the same `/draft-table/dev` route to game one and 0–0, retaining the teams and pool. The separate season retained its eight QA teams and thirteen fixtures.
- Broadcast preview kept team actions disabled. Ban ceremonies now release the scrim after five seconds if browser rendering stalls, with no change to the normal animation timeline.
- Visual evidence: [setup](visual-review/draft-lab-setup.png), [second-map operator](visual-review/draft-lab-operator.png).
