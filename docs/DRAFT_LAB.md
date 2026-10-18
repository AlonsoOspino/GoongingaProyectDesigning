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

## Published release

Frontend commit `20154e3` was deployed on 2026-10-18 UTC (2026-10-17 in Lima). The existing backend container stayed running throughout. Public lab, operator, broadcast, landing and Season 9 routes returned HTTP 200; the published lab bundle includes the walkthrough and replay controls. Database health remained connected. Season 9 stayed at zero teams/fixtures, and the shared developer match remained match 64 / draft 52 in Preparation.

- Build log: `/opt/goonginga/migration-uidesign/backups/draft-lab-frontend-20261018T043301Z.log`
- Previous frontend image: `migration-uidesign-frontend:rollback-draft-lab-20261018T043301Z`

## Mode selection scene, 2026-10-18

Choosing a mode now carries the selected portrait card from its original screen position into the center with two 3D rotations over 1.4 seconds. The backdrop darkens while two opposing vertical reels rapidly cycle every map of that mode in grayscale. The reels brake and stop **2.5 seconds after the rotation ends** (3.9 seconds total); the eligible maps light up in color and become the actual map-selection buttons. Two maps split 1/1; three split 1/2; larger pools stay balanced. The central mode card and side lanes remain in place when the animation finishes.

The same scene runs for captain/operator and broadcast observers. Initial loads and ordinary polls show the settled board without replaying the spin. Same-draft older versions cannot overwrite a confirmed choice. Map selection stays blocked during the reveal, pending requests, pauses and open dialogs. Manager pause/resume stays above the scene, and the broadcast view remains read-only. Reduced-motion preferences disable spinning and reel movement.

Validation: production build and typecheck passed; 18 transition/layout/permission tests passed. Browser tests covered 2, 3 and 8 eligible maps, the actual selection of a revealed map, and pause/resume. Observed stage boundaries in the compiled browser were approximately 1450 ms for spin and 2464 ms from spin completion to reel stop (the implementation deadlines are exactly 1400 + 2500 ms). Tests used only the isolated QA database; its eight season teams and thirteen fixtures were unchanged.

Visual evidence: [grayscale reels](visual-review/map-mode-reels.png), [three-map layout](visual-review/map-mode-three-maps.png), [two-map layout](visual-review/map-mode-two-maps.png), [eight-map layout](visual-review/map-mode-eight-maps.png).
