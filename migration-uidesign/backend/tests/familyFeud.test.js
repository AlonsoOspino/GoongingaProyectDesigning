const test = require("node:test");
const assert = require("node:assert/strict");
const { __testables } = require("../controllers/familyFeud");

function gameFixture() {
  const joinedAt = new Date();
  const alphaMember = { id: 11, discordUserId: "111", username: "alpha", nickname: "Alex", avatarUrl: null, profilePic: null };
  const betaMember = { id: 12, discordUserId: "222", username: "beta", nickname: "Jordan", avatarUrl: null, profilePic: null };
  return {
    id: 1,
    code: "FF-2048",
    roomId: "FF-2048",
    alphaInviteToken: "ALPHA-PRIVATE",
    betaInviteToken: "BETA-PRIVATE",
    title: "Family Feud",
    status: "ROUND_PLAY",
    managerMemberId: 99,
    version: 4,
    developmentMode: false,
    timerEndsAt: null,
    manager: { id: 99, username: "host", nickname: "Host", avatarUrl: null, profilePic: null },
    state: {
      ...__testables.defaultState(),
      phase: "ROUND_PLAY",
      currentRound: 1,
      activeSide: "ALPHA",
      activeMemberId: 11,
      revealedAnswerIds: [101],
    },
    teams: [
      { id: 21, side: "ALPHA", name: "Nova", color: "#00ffff", score: 20, captainMemberId: 11 },
      { id: 22, side: "BETA", name: "Pulse", color: "#ff0088", score: 10, captainMemberId: 12 },
    ],
    participants: [
      { id: 31, gameId: 1, teamId: 21, memberId: 11, role: "PLAYER", ready: true, joinedAt, lastSeenAt: joinedAt, member: alphaMember },
      { id: 32, gameId: 1, teamId: 22, memberId: 12, role: "PLAYER", ready: true, joinedAt, lastSeenAt: joinedAt, member: betaMember },
    ],
    rounds: [{
      id: 41,
      roundNumber: 1,
      multiplier: 1,
      roundBank: 40,
      strikes: 1,
      question: {
        question: "Name something people do when they cannot sleep.",
        category: "GENERAL",
        answers: [
          { id: 101, rank: 1, answer: "Check their phone", points: 40, aliases: ["phone"] },
          { id: 102, rank: 2, answer: "Watch television", points: 25, aliases: ["tv"] },
        ],
      },
      responses: [],
      faceOff: null,
    }],
  };
}

test("Family Feud normalizes answer matching text", () => {
  assert.equal(__testables.normalizeAnswer("  Watch T.V.! "), "watch tv");
  assert.ok(__testables.answerSimilarity("watch television", "watch televsion") > 0.9);
});

test("spectator projection never includes hidden answer data or database ids", () => {
  const projection = __testables.buildProjection(gameFixture(), "spectator", null);
  assert.deepEqual(projection.round.board[0], { rank: 1, revealed: true, answer: "Check their phone", points: 40 });
  assert.deepEqual(projection.round.board[1], { rank: 2, revealed: false });
  assert.equal(JSON.stringify(projection).includes("Watch television"), false);
  assert.equal(JSON.stringify(projection).includes("aliases"), false);
  assert.equal(JSON.stringify(projection).includes("memberId"), false);
  assert.equal(JSON.stringify(projection).includes("ALPHA-PRIVATE"), false);
});

test("manager projection is limited to the assigned manager", () => {
  const game = gameFixture();
  assert.throws(() => __testables.buildProjection(game, "manager", { id: 11, role: "DEFAULT", roles: ["MEMBER"], accountType: "NETWORK_MEMBER" }), /assigned match manager/);
  const projection = __testables.buildProjection(game, "manager", { id: 99, role: "MANAGER", roles: ["MEMBER"], accountType: "NETWORK_MEMBER" });
  assert.equal(projection.round.board[1].answer, "Watch television");
  assert.equal(projection.manager.participants[0].memberId, 11);
  assert.deepEqual(projection.manager.captainInvites, { alpha: "ALPHA-PRIVATE", beta: "BETA-PRIVATE" });
});

test("Social Media can open every Family Feud manager room", () => {
  const projection = __testables.buildProjection(gameFixture(), "manager", { id: 500, role: "DEFAULT", roles: ["SOCIAL_MEDIA"], accountType: "NETWORK_MEMBER" });
  assert.equal(projection.manager.captainInvites.alpha, "ALPHA-PRIVATE");
});

test("a development guest receives only its player projection", () => {
  const game = gameFixture();
  game.developmentMode = true;
  game.participants[0].member.discordUserId = "FEUD_GUEST:1:test";
  const projection = __testables.buildProjection(game, "player", { id: 11, accountType: "FEUD_GUEST", feudGameCode: game.code });
  assert.equal(projection.me.isGuest, true);
  assert.equal(projection.me.side, "ALPHA");
  assert.equal(projection.manager, undefined);
});

test("an expired Family Feud turn becomes NO ANSWER and adds a strike", async () => {
  const game = gameFixture();
  const updates = [];
  const tx = { feudRound: { update: async (input) => { updates.push(input); } } };
  const transition = await __testables.resolveNoAnswer(tx, game);
  assert.equal(transition.status, "ROUND_PLAY");
  assert.equal(transition.state.lastEvent.type, "NO_ANSWER");
  assert.equal(transition.state.lastEvent.label, "NO ANSWER");
  assert.equal(updates[0].data.strikes, 2);
  assert.ok(transition.timerEndsAt instanceof Date);
});

test("a face-off timeout advances instead of freezing the game", async () => {
  const game = gameFixture();
  game.status = "FACE_OFF_FIRST_ANSWER";
  game.state = { ...game.state, phase: "FACE_OFF_FIRST_ANSWER", activeMemberId: 11, faceOffResults: [] };
  game.rounds[0].faceOff = { teamARepresentativeId: 11, teamBRepresentativeId: 12, externalWinnerMemberId: 11 };
  const transition = await __testables.resolveNoAnswer({}, game);
  assert.equal(transition.status, "FACE_OFF_SECOND_ANSWER");
  assert.equal(transition.state.activeMemberId, 12);
  assert.equal(transition.state.lastEvent.type, "NO_ANSWER");
});
