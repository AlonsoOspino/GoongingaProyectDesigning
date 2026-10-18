import assert from "node:assert/strict";
import test from "node:test";
import { deriveDraftPermissions } from "../src/lib/draft/permissions.ts";

const match = { type: "PRACTICE", tournamentId: 9, teamAId: 101, teamBId: 102 };
const input = { roles: ["DEVELOPER"], matchReference: "dev", match, currentTurnTeamId: 101, captainOf: [], readOnly: false };

test("a developer drives either team's real turn in the practice alias without becoming a captain", () => {
  for (const currentTurnTeamId of [101, 102]) {
    const result = deriveDraftPermissions({ ...input, currentTurnTeamId });
    assert.equal(result.isDevOperator, true);
    assert.equal(result.isManager, true);
    assert.equal(result.isCaptain, false);
    assert.equal(result.canActForTeam, true);
    assert.equal(result.actingTeamId, currentTurnTeamId);
    assert.equal(result.canChooseForCurrentTurn, true);
  }
});

test("developer elevation requires both the dev alias and the actual practice match", () => {
  for (const changes of [{ matchReference: 64 }, { match: { ...match, type: "ROUNDROBIN" } }, { match: null }, { roles: ["MEMBER"] }]) {
    const result = deriveDraftPermissions({ ...input, ...changes });
    assert.equal(result.isDevOperator, false);
    assert.equal(result.isManager, false);
    assert.equal(result.canChooseForCurrentTurn, false);
    assert.equal(result.actingTeamId, undefined);
  }
});

test("broadcast and share-key access stays read-only for developers, staff and captains", () => {
  const result = deriveDraftPermissions({ ...input, roles: ["DEVELOPER", "ADMIN", "SOCIAL_MEDIA"], captainOf: [{ tournamentId: 9, teamId: 101 }], readOnly: true });
  assert.equal(result.isDevOperator, false);
  assert.equal(result.isManager, false);
  assert.equal(result.isCaptain, false);
  assert.equal(result.canActForTeam, false);
  assert.equal(result.canChooseForCurrentTurn, false);
  assert.equal(result.actingTeamId, undefined);
});

test("a league captain only acts on their own turn in the assigned season", () => {
  const competition = { ...input, roles: ["MEMBER"], matchReference: 65, match: { ...match, type: "ROUNDROBIN" }, captainOf: [{ tournamentId: 9, teamId: 101 }] };
  assert.equal(deriveDraftPermissions(competition).canChooseForCurrentTurn, true);
  assert.equal(deriveDraftPermissions({ ...competition, currentTurnTeamId: 102 }).canChooseForCurrentTurn, false);
  assert.equal(deriveDraftPermissions({ ...competition, captainOf: [{ tournamentId: 8, teamId: 101 }] }).isCaptain, false);
  assert.equal(deriveDraftPermissions({ ...competition, captainOf: [{ tournamentId: 9, teamId: 999 }] }).isCaptain, false);
});

test("normal production staff keep phase controls without gaining captain team actions", () => {
  for (const role of ["ADMIN", "SOCIAL_MEDIA"]) {
    const result = deriveDraftPermissions({ ...input, roles: [role], matchReference: 65, match: { ...match, type: "ROUNDROBIN" } });
    assert.equal(result.isManager, true);
    assert.equal(result.isCaptain, false);
    assert.equal(result.canActForTeam, false);
    assert.equal(result.canChooseForCurrentTurn, false);
  }
});

test("a developer who is also an assigned league captain keeps only their normal captain permissions", () => {
  const result = deriveDraftPermissions({ ...input, matchReference: 65, match: { ...match, type: "ROUNDROBIN" }, captainOf: [{ tournamentId: 9, teamId: 101 }] });
  assert.equal(result.isDevOperator, false);
  assert.equal(result.isManager, false);
  assert.equal(result.isCaptain, true);
  assert.equal(result.actingTeamId, 101);
  assert.equal(result.canChooseForCurrentTurn, true);
});

test("the lab never submits a team action without a valid current match turn", () => {
  for (const currentTurnTeamId of [null, undefined, 999]) {
    const result = deriveDraftPermissions({ ...input, currentTurnTeamId });
    assert.equal(result.isDevOperator, true);
    assert.equal(result.canChooseForCurrentTurn, false);
    assert.equal(result.actingTeamId, undefined);
  }
});
