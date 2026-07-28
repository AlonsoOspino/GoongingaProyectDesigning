const assert = require("node:assert/strict");
const test = require("node:test");

const prisma = require("../config/prisma");
const wrappedController = require("../controllers/wrapped");
const wrappedManagerMiddleware = require("../middlewares/wrappedManager");

const tournament = {
  id: 1,
  name: "Season One",
  startDate: new Date("2026-01-01T00:00:00.000Z"),
};

function stat({ userId, nickname, duration, damage, kills, deaths, matchId = 1, gameNumber = 1, rates = {} }) {
  const per10 = (value) => duration > 0 ? (value / duration) * 600 : 0;
  return {
    userId,
    kills,
    assists: 2,
    deaths,
    damage,
    healing: damage / 2,
    mitigation: damage / 3,
    damagePer10: rates.damagePer10 ?? per10(damage),
    healingPer10: rates.healingPer10 ?? per10(damage / 2),
    mitigationPer10: rates.mitigationPer10 ?? per10(damage / 3),
    killsPer10: rates.killsPer10 ?? per10(kills),
    assistsPer10: rates.assistsPer10 ?? per10(2),
    deathsPer10: rates.deathsPer10 ?? per10(deaths),
    gameDuration: duration,
    matchId,
    gameNumber,
    match: { semanas: 1 },
    user: { nickname, profilePic: null, team: { name: "Team One" } },
  };
}

function savePrismaMethods() {
  return {
    playerStatFindMany: prisma.playerStat.findMany,
    draftActionFindMany: prisma.draftAction.findMany,
    teamFindMany: prisma.team.findMany,
    mapFindMany: prisma.map.findMany,
    tournamentFindFirst: prisma.tournament.findFirst,
    wrappedFindUnique: prisma.wrapped.findUnique,
    wrappedCreate: prisma.wrapped.create,
    wrappedUpdate: prisma.wrapped.update,
  };
}

function restorePrismaMethods(original) {
  prisma.playerStat.findMany = original.playerStatFindMany;
  prisma.draftAction.findMany = original.draftActionFindMany;
  prisma.team.findMany = original.teamFindMany;
  prisma.map.findMany = original.mapFindMany;
  prisma.tournament.findFirst = original.tournamentFindFirst;
  prisma.wrapped.findUnique = original.wrappedFindUnique;
  prisma.wrapped.create = original.wrappedCreate;
  prisma.wrapped.update = original.wrappedUpdate;
}

function mockSnapshotQueries(stats, leaderboardStats = stats, actions = [{ value: 2 }]) {
  let playerStatQueryCount = 0;
  prisma.playerStat.findMany = async () => playerStatQueryCount++ === 0 ? stats : leaderboardStats;
  prisma.draftAction.findMany = async () => actions;
  prisma.team.findMany = async () => [{ id: 1, name: "Team One", logo: null }];
  prisma.map.findMany = async () => [
    { id: 1, description: "Alpha", imgPath: "/alpha.jpg" },
    { id: 2, description: "Zulu", imgPath: "/zulu.jpg" },
  ];
}

test("buildSnapshot mirrors the Player Stats per-game averages, total sums, and zero-pick maps", async (t) => {
  const original = savePrismaMethods();
  t.after(() => restorePrismaMethods(original));
  const seasonStats = [
    stat({ userId: 1, nickname: "Alpha", duration: 100, damage: 100, kills: 10, deaths: 2 }),
    stat({ userId: 2, nickname: "Bravo", duration: 400, damage: 200, kills: 15, deaths: 1, matchId: 2 }),
  ];
  const leaderboardStats = [
    stat({ userId: 1, nickname: "Alpha", duration: 100, damage: 100, kills: 10, deaths: 2, rates: { damagePer10: 1200 } }),
    stat({ userId: 1, nickname: "Alpha", duration: 100, damage: 100, kills: 10, deaths: 2, matchId: 3, rates: { damagePer10: 0 } }),
    stat({ userId: 2, nickname: "Bravo", duration: 400, damage: 200, kills: 15, deaths: 1, matchId: 4, rates: { damagePer10: 700 } }),
  ];
  mockSnapshotQueries(seasonStats, leaderboardStats);

  const snapshot = await wrappedController.buildSnapshot(tournament);

  assert.equal(snapshot.averagesPer10.damage.player, "Bravo");
  assert.equal(snapshot.averagesPer10.damage.value, 700);
  assert.equal(snapshot.totals.damage.player, "Bravo");
  assert.equal(snapshot.overview.totals.damage, 300);
  assert.equal(snapshot.maps.mostPicked.name, "Zulu");
  assert.equal(snapshot.maps.leastPicked.name, "Alpha");
  assert.equal(snapshot.performance.kd.player, "Bravo");
});

test("buildLeaderboardAverages matches the Player Stats running average formula", () => {
  const rows = wrappedController.__testables.buildLeaderboardAverages([
    stat({ userId: 1, nickname: "Alpha", duration: 1, damage: 1, kills: 1, deaths: 1, rates: { killsPer10: 2 } }),
    stat({ userId: 1, nickname: "Alpha", duration: 1, damage: 1, kills: 1, deaths: 1, rates: { killsPer10: 4 } }),
  ]);
  assert.equal(rows[0].killsPer10, 3);
});

test("refresh retains artwork only when the player or map subject is unchanged", () => {
  const previous = {
    assets: { averageKills: "https://cdn.example/alpha.png", mostPickedMap: "https://cdn.example/zulu.png" },
    snapshot: {
      averagesPer10: { kills: { userId: 1 } },
      maps: { mostPicked: { mapId: 2 } },
    },
  };
  const next = {
    averagesPer10: { kills: { userId: 1 } },
    maps: { mostPicked: { mapId: 3 } },
  };

  assert.deepEqual(wrappedController.__testables.retainMatchingAssets(previous, next), {
    averageKills: "https://cdn.example/alpha.png",
  });
});

test("manager/admin middleware permits both roles and rejects others", () => {
  for (const role of ["MANAGER", "ADMIN"]) {
    let nextCalled = false;
    wrappedManagerMiddleware({ user: { role } }, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  }

  let statusCode = 0;
  let payload = null;
  wrappedManagerMiddleware({ user: { role: "DEFAULT" } }, {
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; },
  }, () => assert.fail("default users must not be authorized"));
  assert.equal(statusCode, 403);
  assert.match(payload.message, /Managers and admins/);
});

test("a concurrent snapshot request returns a conflict instead of recomputing twice", async (t) => {
  const original = savePrismaMethods();
  t.after(() => restorePrismaMethods(original));
  mockSnapshotQueries([stat({ userId: 1, nickname: "Alpha", duration: 100, damage: 100, kills: 10, deaths: 2 })]);
  prisma.tournament.findFirst = async () => tournament;
  prisma.wrapped.findUnique = async () => null;
  prisma.wrapped.create = async ({ data }) => ({ id: 1, ...data, generatedAt: new Date(), updatedAt: new Date() });
  const originalPlayerStats = prisma.playerStat.findMany;
  prisma.playerStat.findMany = async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return originalPlayerStats();
  };

  const responses = [];
  const response = () => {
    const result = { statusCode: 200, body: null };
    responses.push(result);
    return {
      status(code) { result.statusCode = code; return this; },
      json(body) { result.body = body; return this; },
    };
  };

  await Promise.all([
    wrappedController.generateWrapped({}, response()),
    wrappedController.generateWrapped({}, response()),
  ]);

  assert.deepEqual(responses.map((item) => item.statusCode).sort(), [201, 409]);
});
