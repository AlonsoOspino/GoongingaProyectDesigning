const prisma = require("../config/prisma");
const { retryAfterWrappedMigration } = require("../utils/ensureWrappedSchema");

const DAY_MS = 24 * 60 * 60 * 1000;
let cachedWrapped = null;

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

function pickBest(items, getValue, lowerIsBetter = false) {
  if (!items.length) return null;
  return items.reduce((best, item) => {
    if (!best) return item;
    return lowerIsBetter
      ? getValue(item) < getValue(best)
        ? item
        : best
      : getValue(item) > getValue(best)
        ? item
        : best;
  }, null);
}

function toPlayerLeader(stat, value, precision = 0) {
  if (!stat) return null;
  return {
    player: stat.user.nickname,
    profilePic: stat.user.profilePic || null,
    team: stat.user.team?.name || null,
    value: Number(value.toFixed(precision)),
    gameNumber: stat.gameNumber,
  };
}

function mostFrequent(actions, actionType, recordsById, labelField) {
  const counts = new Map();
  for (const action of actions) {
    if (action.action !== actionType || !action.value) continue;
    counts.set(action.value, (counts.get(action.value) || 0) + 1);
  }

  let winner = null;
  for (const [id, count] of counts) {
    if (!winner || count > winner.count) winner = { id, count };
  }
  if (!winner) return null;

  const record = recordsById.get(winner.id);
  if (!record) return null;
  return {
    name: record[labelField] || "Unknown",
    image: record.imgPath || null,
    count: winner.count,
  };
}

async function buildSnapshot(tournament) {
  const [stats, actions, teams] = await Promise.all([
    prisma.playerStat.findMany({
      where: { match: { tournamentId: tournament.id, status: "FINISHED" } },
      select: {
        kills: true,
        assists: true,
        deaths: true,
        damage: true,
        healing: true,
        mitigation: true,
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
        action: { in: ["BAN", "PICK"] },
        value: { not: null },
        draft: { match: { tournamentId: tournament.id, status: "FINISHED" } },
      },
      select: { action: true, value: true },
    }),
    prisma.team.findMany({
      where: { tournamentId: tournament.id },
      select: { id: true, name: true, logo: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const heroIds = [...new Set(actions.filter((item) => item.action === "BAN").map((item) => item.value))];
  const mapIds = [...new Set(actions.filter((item) => item.action === "PICK").map((item) => item.value))];
  const [heroes, maps] = await Promise.all([
    heroIds.length ? prisma.hero.findMany({ where: { id: { in: heroIds } } }) : [],
    mapIds.length ? prisma.map.findMany({ where: { id: { in: mapIds } } }) : [],
  ]);

  const heroesById = new Map(heroes.map((hero) => [hero.id, hero]));
  const mapsById = new Map(maps.map((map) => [map.id, map]));
  const totalByPlayer = new Map();

  for (const stat of stats) {
    const key = stat.user.nickname;
    const current = totalByPlayer.get(key) || { stat, damage: 0, healing: 0 };
    current.damage += stat.damage;
    current.healing += stat.healing;
    totalByPlayer.set(key, current);
  }

  const bestKdaStat = pickBest(stats, (stat) => stat.kills / Math.max(1, stat.deaths));
  const topDamage = pickBest([...totalByPlayer.values()], (item) => item.damage);
  const topHealing = pickBest([...totalByPlayer.values()], (item) => item.healing);
  const generatedAt = new Date();
  const elapsedWeeks = Math.max(1, Math.ceil((generatedAt.getTime() - new Date(tournament.startDate).getTime()) / (7 * DAY_MS)));
  const scheduledWeeks = Math.max(0, ...stats.map((stat) => Number(stat.match?.semanas || 0)));

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
      players: new Set(stats.map((stat) => stat.user.nickname)).size,
      teams,
    },
    leaders: {
      kills: toPlayerLeader(pickBest(stats, (stat) => stat.kills), pickBest(stats, (stat) => stat.kills)?.kills || 0),
      healing: toPlayerLeader(pickBest(stats, (stat) => stat.healing), pickBest(stats, (stat) => stat.healing)?.healing || 0),
      assists: toPlayerLeader(pickBest(stats, (stat) => stat.assists), pickBest(stats, (stat) => stat.assists)?.assists || 0),
      lowestDeaths: toPlayerLeader(pickBest(stats, (stat) => stat.deaths, true), pickBest(stats, (stat) => stat.deaths, true)?.deaths || 0),
      mitigation: toPlayerLeader(pickBest(stats, (stat) => stat.mitigation), pickBest(stats, (stat) => stat.mitigation)?.mitigation || 0),
      kda: toPlayerLeader(bestKdaStat, bestKdaStat ? bestKdaStat.kills / Math.max(1, bestKdaStat.deaths) : 0, 2),
      totalDamage: topDamage ? toPlayerLeader(topDamage.stat, topDamage.damage) : null,
      totalHealing: topHealing ? toPlayerLeader(topHealing.stat, topHealing.healing) : null,
    },
    draft: {
      mostBannedHero: mostFrequent(actions, "BAN", heroesById, "name"),
      mostPickedMap: mostFrequent(actions, "PICK", mapsById, "description"),
    },
  };
}

async function getCurrentWrapped(req, res) {
  try {
    const wrapped = await getLatestWrapped();
    if (!wrapped) return res.status(404).json({ message: "Goonginga Wrapped has not been generated yet." });
    res.set("Cache-Control", "public, max-age=300");
    return res.json(wrapped);
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to load Goonginga Wrapped." });
  }
}

async function getAdminWrapped(_req, res) {
  return getCurrentWrapped(_req, res);
}

async function generateWrapped(_req, res) {
  try {
    const tournament = await prisma.tournament.findFirst({ orderBy: { id: "asc" } });
    if (!tournament) return res.status(400).json({ message: "Create a tournament before generating its Wrapped." });

    const existing = await retryAfterWrappedMigration(() =>
      prisma.wrapped.findUnique({ where: { tournamentId: tournament.id } })
    );
    if (existing) {
      return res.status(409).json({ message: "This tournament already has a generated Wrapped. Its stats are locked." });
    }

    const snapshot = await buildSnapshot(tournament);
    const wrapped = await prisma.wrapped.create({ data: { tournamentId: tournament.id, snapshot, assets: {} } });
    cachedWrapped = wrapped;
    return res.status(201).json(wrapped);
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Failed to generate Goonginga Wrapped." });
  }
}

async function updateAssets(req, res) {
  try {
    const wrapped = await getLatestWrapped();
    if (!wrapped) return res.status(404).json({ message: "Generate the Wrapped before adding its images." });

    const assets = req.body?.assets;
    if (!assets || typeof assets !== "object" || Array.isArray(assets)) {
      return res.status(400).json({ message: "assets must be an object of image URLs." });
    }

    const cleanAssets = Object.fromEntries(
      Object.entries(assets)
        .filter(([key, value]) => typeof key === "string" && typeof value === "string")
        .map(([key, value]) => [key, value.trim()])
    );
    const updated = await prisma.wrapped.update({ where: { id: wrapped.id }, data: { assets: cleanAssets } });
    cachedWrapped = updated;
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Failed to save Wrapped images." });
  }
}

module.exports = { getCurrentWrapped, getAdminWrapped, generateWrapped, updateAssets, invalidateWrappedCache };
