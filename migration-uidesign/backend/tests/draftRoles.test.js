const test = require("node:test");
const assert = require("node:assert/strict");
const { __testables } = require("../controllers/draft");

const match = { tournamentId: 9, teamAId: 30, teamBId: 31 };

function clientWith(rows) {
  return {
    seasonPlayer: {
      findUnique: async ({ where }) => {
        const key = where.memberId_tournamentId;
        return rows.find((row) => row.memberId === key.memberId && row.tournamentId === key.tournamentId) || null;
      },
    },
  };
}

test("a season captain acts only as their own match team", async () => {
  const client = clientWith([{ memberId: 1, tournamentId: 9, teamId: 30, role: "CAPTAIN" }]);
  assert.equal(await __testables.resolveActingTeamId({ id: 1, roles: ["MEMBER"] }, undefined, match, client), 30);
  // A captain cannot impersonate the opposing team through bodyTeamId; the server resolves their own team.
  assert.equal(await __testables.resolveActingTeamId({ id: 1, roles: ["MEMBER"] }, 31, match, client), 30);
});

test("captain authority does not cross match teams or tournaments", async () => {
  const outsideTeam = clientWith([{ memberId: 2, tournamentId: 9, teamId: 44, role: "CAPTAIN" }]);
  await assert.rejects(
    __testables.resolveActingTeamId({ id: 2, roles: ["MEMBER"] }, undefined, match, outsideTeam),
    /own match/i
  );

  const otherTournament = clientWith([{ memberId: 2, tournamentId: 10, teamId: 30, role: "CAPTAIN" }]);
  await assert.rejects(
    __testables.resolveActingTeamId({ id: 2, roles: ["MEMBER"] }, undefined, match, otherTournament),
    /Unauthorized role/i
  );
});

test("players, casters, and members without a season row cannot act", async () => {
  const player = clientWith([{ memberId: 3, tournamentId: 9, teamId: 30, role: "PLAYER" }]);
  await assert.rejects(
    __testables.resolveActingTeamId({ id: 3, roles: ["MEMBER"] }, undefined, match, player),
    /Unauthorized role/i
  );
  await assert.rejects(
    __testables.resolveActingTeamId({ id: 4, roles: ["MEMBER", "CASTER"] }, undefined, match, clientWith([])),
    /Unauthorized role/i
  );
  await assert.rejects(
    __testables.resolveActingTeamId({ id: 5, roles: ["MEMBER"] }, undefined, match, clientWith([])),
    /Unauthorized role/i
  );
});

test("network managers must explicitly choose one of the match teams", async () => {
  const noSeasonPlayer = clientWith([]);
  assert.equal(
    await __testables.resolveActingTeamId({ id: 6, roles: ["SOCIAL_MEDIA"] }, 31, match, noSeasonPlayer),
    31
  );
  assert.equal(
    await __testables.resolveActingTeamId({ id: 7, roles: ["ADMIN"] }, 30, match, noSeasonPlayer),
    30
  );
  await assert.rejects(
    __testables.resolveActingTeamId({ id: 7, roles: ["ADMIN"] }, 44, match, noSeasonPlayer),
    /one of the match teams/i
  );
});
