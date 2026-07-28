const prisma = require("../config/prisma");
const { retryAfterWrappedMigration } = require("../utils/ensureWrappedSchema");

const DAY_MS = 24 * 60 * 60 * 1000;
const RATE_PER_TEN_SECONDS = 10 * 60;
const ASSET_KEYS = new Set([
  "averageKills",
  "averageHealing",
  "averageDamage",
  "averageMitigation",
  "averageAssists",
  "averageSurvival",
  "totalDamage",
  "totalHealing",
  "totalMitigation",
  "bestKd",
  "mostPickedMap",
  "leastPickedMap",
]);

let cachedWrapped = null;
const activeSnapshotBuilds = new Set();

async function getLatestWrapped() {
  if (cachedWrapped) return cachedWrapped;
  cachedWrapped = await retryAfterWrappedMigration(() =>
    prisma.wrapped.findFirst({ orderBy: { generatedAt: "desc" } })
  );
  return cachedWrapped;
}

function invalidateWrappedCache() {
  cachedWrapped = null;
}

function compareLabels(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, { sensitivity: "base" });
}

function pickBest(items, getValue, { lowerIsBetter = false, getTieLabel = () => "" } = {}) {
  return items.reduce((best, item) => {
    const value = getValue(item);
    if (!Number.isFinite(value)) return best;
    if (!best) return item;

    const bestValue = getValue(best);
    if (value === bestValue) {
      return compareLabels(getTieLabel(item), getTieLabel(best)) < 0 ? item : best;
    }
    const wins = lowerIsBetter ? value < bestValue : value > bestValue;
    return wins ? item : best;
  }, null);
}

function toPlayerLeader(player, value, precision = 0) {
  if (!player || !Number.isFinite(value)) return null;
  return {
    userId: player.userId,
    player: player.user.nickname,
    profilePic: player.user.profilePic || null,
    team: player.user.team?.name || null,
    value: Number(value.toFixed(precision)),
  };
}

function toMapRanking(map, count) {
  if (!map) return null;
  return {
    mapId: map.id,
    name: map.description || "Unknown",
    image: map.imgPath || null,
    count,
  };
}

function getPlayerRate(player, field) {
  if (player.validDuration <= 0) return Number.NaN;
  return (player[field] / player.validDuration) * RATE_PER_TEN_SECONDS;
}

function getSnapshotAssetSubject(snapshot, key) {
  if (!snapshot) return null;
  const playerPaths = {
    averageKills: snapshot.averagesPer10?.kills,
    averageHealing: snapshot.averagesPer10?.healing,
    averageDamage: snapshot.averagesPer10?.damage,
    averageMitigation: snapshot.averagesPer10?.mitigation,
    averageAssists: snapshot.averagesPer10?.assists,
    averageSurvival: snapshot.averagesPer10?.lowestDeaths,
    totalDamage: snapshot.totals?.damage,
    totalHealing: snapshot.totals?.healing,
    totalMitigation: snapshot.totals?.mitigation,
    bestKd: snapshot.performance?.kd,
  };

  if (playerPaths[key]?.userId) return `player:${playerPaths[key].userId}`;
  if (key === "mostPickedMap" && snapshot.maps?.mostPicked?.mapId) return `map:${snapshot.maps.mostPicked.mapId}`;
  if (key === "leastPickedMap" && snapshot.maps?.leastPicked?.mapId) return `map:${snapshot.maps.leastPicked.mapId}`;
  return null;
}

function retainMatchingAssets(previousWrapped, nextSnapshot) {
  const previousAssets = previousWrapped?.assets;
  if (!previousAssets || typeof previousAssets !== "object" || Array.isArray(previousAssets)) return {};

  return Object.fromEntries(
    Object.entries(previousAssets).filter(([key, url]) =>
      ASSET_KEYS.has(key) &&
      typeof url === "string" &&
      getSnapshotAssetSubject(previousWrapped.snapshot, key) &&
      getSnapshotAssetSubject(previousWrapped.snapshot, key) === getSnapshotAssetSubject(nextSnapshot, key)
    )
  );
}

async function buildSnapshot(tournament) {
  const [stats, actions, teams, maps] = await Promise.all([
    prisma.playerStat.findMany({
      where: { match: { tournamentId: tournament.id, status: "FINISHED" } },
      select: {
        userId: true,
        kills: true,
        assists: true,
        deaths: true,
        damage: true,
        healing: true,
        mitigation: true,
        gameDuration: true,
        matchId: true,
        gameNumber: true,
        match: { select: { semanas: true } },
        user: {
          select: {
            nickname: true,
            profilePic: true,
            team: { select: { name: true } },
          },
        },
      },
    }),
    prisma.draftAction.findMany({
      where: {
        action: "PICK",
        value: { not: null },
        draft: { match: { tournamentId: tournament.id, status: "FINISHED" } },
      },
      select: { value: true },
    }),
    prisma.team.findMany({
      where: { tournamentId: tournament.id },
      select: { id: true, name: true, logo: true },
      orderBy: { name: "asc" },
    }),
    prisma.map.findMany({
      select: { id: true, description: true, imgPath: true },
      orderBy: { description: "asc" },
    }),
  ]);

  if (!stats.length) {
    const error = new Error("At least one finished game with registered stats is required before freezing the Wrapped.");
    error.statusCode = 422;
    throw error;
  }

  const totalsByPlayer = new Map();
  const globalTotals = { damage: 0, healing: 0, mitigation: 0 };

  for (const stat of stats) {
    const current = totalsByPlayer.get(stat.userId) || {
      userId: stat.userId,
      user: stat.user,
      kills: 0,
      assists: 0,
      deaths: 0,
      damage: 0,
      healing: 0,
      mitigation: 0,
      validDuration: 0,
    };
    current.kills += stat.kills;
    current.assists += stat.assists;
    current.deaths += stat.deaths;
    current.damage += stat.damage;
    current.healing += stat.healing;
    current.mitigation += stat.mitigation;
    if (Number(stat.gameDuration) > 0) current.validDuration += Number(stat.gameDuration);
    totalsByPlayer.set(stat.userId, current);

    globalTotals.damage += stat.damage;
    globalTotals.healing += stat.healing;
    globalTotals.mitigation += stat.mitigation;
  }

  const players = [...totalsByPlayer.values()];
  const playerOptions = { getTieLabel: (player) => player.user.nickname };
  const rateLeader = (field, lowerIsBetter = false) => {
    const winner = pickBest(players, (player) => getPlayerRate(player, field), { ...playerOptions, lowerIsBetter });
    return winner ? toPlayerLeader(winner, getPlayerRate(winner, field), 2) : null;
  };
  const totalLeader = (field) => {
    const winner = pickBest(players, (player) => player[field], playerOptions);
    return winner ? toPlayerLeader(winner, winner[field]) : null;
  };

  const mapCounts = new Map(actions.map((action) => [action.value, 0]));
  for (const action of actions) mapCounts.set(action.value, (mapCounts.get(action.value) || 0) + 1);
  const mapOptions = { getTieLabel: (item) => item.map.description };
  const mapEntries = maps.map((map) => ({ map, count: mapCounts.get(map.id) || 0 }));
  const mostPicked = actions.length
    ? pickBest(mapEntries, (item) => item.count, mapOptions)
    : null;
  const leastPicked = pickBest(mapEntries, (item) => item.count, { ...mapOptions, lowerIsBetter: true });

  const generatedAt = new Date();
  const elapsedWeeks = Math.max(1, Math.ceil((generatedAt.getTime() - new Date(tournament.startDate).getTime()) / (7 * DAY_MS)));
  const scheduledWeeks = Math.max(0, ...stats.map((stat) => Number(stat.match?.semanas || 0)));
  const bestKd = pickBest(players, (player) => player.kills / Math.max(1, player.deaths), playerOptions);

  return {
    generatedAt: generatedAt.toISOString(),
    tournament: {
      id: tournament.id,
      name: tournament.name,
      startDate: tournament.startDate.toISOString(),
    },
    overview: {
      weeks: Math.max(elapsedWeeks, scheduledWeeks),
      games: new Set(stats.map((stat) => `${stat.matchId}:${stat.gameNumber}`)).size,
      players: new Set(stats.map((stat) => stat.userId)).size,
      teams,
      totals: globalTotals,
    },
    averagesPer10: {
      kills: rateLeader("kills"),
      healing: rateLeader("healing"),
      damage: rateLeader("damage"),
      mitigation: rateLeader("mitigation"),
      assists: rateLeader("assists"),
      lowestDeaths: rateLeader("deaths", true),
    },
    totals: {
      damage: totalLeader("damage"),
      healing: totalLeader("healing"),
      mitigation: totalLeader("mitigation"),
    },
    performance: {
      kd: bestKd ? toPlayerLeader(bestKd, bestKd.kills / Math.max(1, bestKd.deaths), 2) : null,
    },
    maps: {
      mostPicked: mostPicked ? toMapRanking(mostPicked.map, mostPicked.count) : null,
      leastPicked: leastPicked ? toMapRanking(leastPicked.map, leastPicked.count) : null,
    },
  };
}

async function getCurrentWrapped(_req, res) {
  try {
    const wrapped = await getLatestWrapped();
    if (!wrapped) return res.status(404).json({ message: "Goonginga Wrapped has not been generated yet." });
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=300");
    return res.json(wrapped);
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to load Goonginga Wrapped." });
  }
}

async function generateWrapped(_req, res) {
  let tournamentId = null;
  try {
    const tournament = await prisma.tournament.findFirst({ orderBy: { id: "asc" } });
    if (!tournament) return res.status(400).json({ message: "Create a tournament before freezing its Wrapped." });
    tournamentId = tournament.id;
    if (activeSnapshotBuilds.has(tournamentId)) {
      return res.status(409).json({ message: "A Wrapped snapshot refresh is already in progress for this tournament." });
    }

    activeSnapshotBuilds.add(tournamentId);
    const existing = await retryAfterWrappedMigration(() =>
      prisma.wrapped.findUnique({ where: { tournamentId } })
    );
    const snapshot = await buildSnapshot(tournament);
    const assets = retainMatchingAssets(existing, snapshot);
    const wrapped = existing
      ? await prisma.wrapped.update({
          where: { id: existing.id },
          data: { snapshot, assets, generatedAt: new Date() },
        })
      : await prisma.wrapped.create({ data: { tournamentId, snapshot, assets } });
    cachedWrapped = wrapped;
    return res.status(existing ? 200 : 201).json(wrapped);
  } catch (error) {
    return res.status(error?.statusCode || 400).json({ message: error?.message || "Failed to freeze Goonginga Wrapped." });
  } finally {
    if (tournamentId !== null) activeSnapshotBuilds.delete(tournamentId);
  }
}

async function updateAssets(req, res) {
  try {
    const wrapped = await getLatestWrapped();
    if (!wrapped) return res.status(404).json({ message: "Freeze the Wrapped before adding its images." });

    const assets = req.body?.assets;
    if (!assets || typeof assets !== "object" || Array.isArray(assets)) {
      return res.status(400).json({ message: "assets must be an object of image URLs." });
    }

    const cleanAssets = Object.fromEntries(
      Object.entries(assets)
        .filter(([key, value]) => ASSET_KEYS.has(key) && typeof value === "string")
        .map(([key, value]) => [key, value.trim()])
        .filter(([, value]) => value)
    );
    const updated = await prisma.wrapped.update({ where: { id: wrapped.id }, data: { assets: cleanAssets } });
    cachedWrapped = updated;
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Failed to save Wrapped images." });
  }
}

module.exports = {
  ASSET_KEYS,
  buildSnapshot,
  getCurrentWrapped,
  getManageWrapped: getCurrentWrapped,
  getAdminWrapped: getCurrentWrapped,
  generateWrapped,
  updateAssets,
  invalidateWrappedCache,
  __testables: { getPlayerRate, pickBest, retainMatchingAssets },
};
