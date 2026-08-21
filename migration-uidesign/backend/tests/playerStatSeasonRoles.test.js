const test = require("node:test");
const assert = require("node:assert/strict");
const playerStatController = require("../controllers/playerStat");
const playerStatService = require("../services/playerStat");

test("legacy ADMIN scalar receives 403 when submitting player stats for another member", async () => {
  const request = {
    user: { id: 7, role: "ADMIN", roles: ["MEMBER"] },
    body: { userId: 8 },
  };
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await playerStatController.create(request, response);

  assert.equal(response.statusCode, 403);
  assert.match(response.body.message, /only submit stats for your own user/i);
});

test("Network ADMIN and SOCIAL_MEDIA roles can submit player stats for another member", () => {
  for (const role of ["ADMIN", "SOCIAL_MEDIA"]) {
    const request = {
      user: { id: 7, role: "DEFAULT", roles: [role] },
      body: { userId: 8 },
    };
    assert.equal(playerStatController.__testables.resolveEffectiveUserId(request), 8);
  }
});

test("only Network ADMIN and SOCIAL_MEDIA can submit stats for others", () => {
  const { canSubmitForOthers } = playerStatController.__testables;
  assert.equal(canSubmitForOthers({ roles: ["ADMIN"] }), true);
  assert.equal(canSubmitForOthers({ roles: ["SOCIAL_MEDIA"] }), true);
  assert.equal(canSubmitForOthers({ roles: ["CASTER"] }), false);
  assert.equal(canSubmitForOthers({ roles: ["MEMBER"] }), false);
  assert.equal(canSubmitForOthers({ role: "ADMIN", roles: ["MEMBER"] }), false);
});

test("match players resolve only from match-team SeasonPlayers in the match tournament", async () => {
  let seasonPlayerQuery = null;
  const rows = [
    { id: 101, tournamentId: 9, teamId: 30, member: { id: 7, nickname: "Ana", username: "ana" } },
    { id: 102, tournamentId: 8, teamId: 30, member: { id: 8, nickname: "Old", username: "old" } },
    { id: 103, tournamentId: 9, teamId: null, member: { id: 9, nickname: "Waiting", username: "waiting" } },
  ];
  const client = {
    match: {
      findUnique: async () => ({ id: 20, tournamentId: 9, teamAId: 30, teamBId: 31 }),
    },
    seasonPlayer: {
      findMany: async (query) => {
        seasonPlayerQuery = query;
        return rows.filter((row) =>
          row.tournamentId === query.where.tournamentId &&
          query.where.teamId.in.includes(row.teamId),
        );
      },
    },
  };

  const result = await playerStatService.__testables.getMatchPlayers(20, client);

  assert.deepEqual(seasonPlayerQuery.where, {
    tournamentId: 9,
    teamId: { in: [30, 31] },
  });
  assert.deepEqual(result.players, [
    { memberId: 7, seasonPlayerId: 101, nickname: "Ana", username: "ana", teamId: 30 },
  ]);
});
