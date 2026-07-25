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

function toMapRanking(map, count) {
  if (!map) return null;
  return {
    name: map.description || "Unknown",
    image: map.imgPath || null,
    count,
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
        userId: true,
        kills: true,
        assists: true,
        deaths: true,
        damage: true,
        healing: true,
        mitigation: true,
        damagePer10: true,
        healingPer10: true,
        mitigationPer10: true,
        killsPer10: true,
        assistsPer10: true,
        deathsPer10: true,
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
    prisma.map.findMany({
      select: { id: true, description: true, imgPath: true },
      orderBy: { description: "asc" },
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
    const key = stat.userId;
    const current = totalByPlayer.get(key) || {
      stat,
      user: stat.user,
      kills: 0,
      assists: 0,
      deaths: 0,
      damage: 0,
      healing: 0,
      mitigation: 0,
      damagePer10: 0,
      healingPer10: 0,
      mitigationPer10: 0,
      killsPer10: 0,
      assistsPer10: 0,
      deathsPer10: 0,
      games: 0,
      latestGameNumber: stat.gameNumber,
    };
    current.games += 1;
    current.kills += stat.kills;
    current.assists += stat.assists;
    current.deaths += stat.deaths;
    current.damage += stat.damage;
    current.healing += stat.healing;
    current.mitigation += stat.mitigation;
    current.damagePer10 += stat.damagePer10;
    current.healingPer10 += stat.healingPer10;
    current.mitigationPer10 += stat.mitigationPer10;
    current.killsPer10 += stat.killsPer10;
    current.assistsPer10 += stat.assistsPer10;
    current.deathsPer10 += stat.deathsPer10;
    current.latestGameNumber = Math.max(current.latestGameNumber, stat.gameNumber);
    totalByPlayer.set(key, current);
  }

  const aggregatedPlayers = [...totalByPlayer.values()];
  const bestKdaStat = pickBest(aggregatedPlayers, (item) => item.kills / Math.max(1, item.deaths));
  const topDamage = pickBest([...totalByPlayer.values()], (item) => item.damage);
  const topHealing = pickBest([...totalByPlayer.values()], (item) => item.healing);
  const topKills = pickBest([...totalByPlayer.values()], (item) => item.kills);
  const generatedAt = new Date();
  const elapsedWeeks = Math.max(1, Math.ceil((generatedAt.getTime() - new Date(tournament.startDate).getTime()) / (7 * DAY_MS)));
  const scheduledWeeks = Math.max(0, ...stats.map((stat) => Number(stat.match?.semanas || 0)));
  const bestKills = pickBest(aggregatedPlayers, (item) => item.kills);
  const bestHealing = pickBest(aggregatedPlayers, (item) => item.healing);
  const bestAssists = pickBest(aggregatedPlayers, (item) => item.assists);
  const lowestDeaths = pickBest(aggregatedPlayers, (item) => item.deaths, true);
  const bestMitigation = pickBest(aggregatedPlayers, (item) => item.mitigation);
  const bestDamagePer10 = pickBest(aggregatedPlayers, (item) => item.damagePer10);
  const bestHealingPer10 = pickBest(aggregatedPlayers, (item) => item.healingPer10);
  const bestKillsPer10 = pickBest(aggregatedPlayers, (item) => item.killsPer10);
  const bestAssistsPer10 = pickBest(aggregatedPlayers, (item) => item.assistsPer10);
  const bestMitigationPer10 = pickBest(aggregatedPlayers, (item) => item.mitigationPer10);
  const lowestDeathsPer10 = pickBest(aggregatedPlayers, (item) => item.deathsPer10, true);

  const mapPlayCounts = new Map();
  for (const action of actions) {
    if (action.action !== "PICK" || !action.value) continue;
    mapPlayCounts.set(action.value, (mapPlayCounts.get(action.value) || 0) + 1);
  }
  const leastPlayedMaps = maps
    .map((map) => ({ map, count: mapPlayCounts.get(map.id) || 0 }))
    .filter((item) => item.count > 0)
    .sort((left, right) => left.count - right.count || left.map.description.localeCompare(right.map.description))
    .slice(0, 3)
    .map(({ map, count }) => toMapRanking(map, count))
    .filter(Boolean);

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
    },
    averagesPer10: {
      damage: bestDamagePer10 ? toPlayerLeader(bestDamagePer10.stat, bestDamagePer10.damagePer10, 2) : null,
      healing: bestHealingPer10 ? toPlayerLeader(bestHealingPer10.stat, bestHealingPer10.healingPer10, 2) : null,
      kills: bestKillsPer10 ? toPlayerLeader(bestKillsPer10.stat, bestKillsPer10.killsPer10, 2) : null,
      assists: bestAssistsPer10 ? toPlayerLeader(bestAssistsPer10.stat, bestAssistsPer10.assistsPer10, 2) : null,
      mitigation: bestMitigationPer10 ? toPlayerLeader(bestMitigationPer10.stat, bestMitigationPer10.mitigationPer10, 2) : null,
      lowestDeaths: lowestDeathsPer10 ? toPlayerLeader(lowestDeathsPer10.stat, lowestDeathsPer10.deathsPer10, 2) : null,
    },
    totals: {
      damage: topDamage ? toPlayerLeader(topDamage.stat, topDamage.damage) : null,
      healing: topHealing ? toPlayerLeader(topHealing.stat, topHealing.healing) : null,
      kills: topKills ? toPlayerLeader(topKills.stat, topKills.kills) : null,
      assists: bestAssists ? toPlayerLeader(bestAssists.stat, bestAssists.assists) : null,
      mitigation: bestMitigation ? toPlayerLeader(bestMitigation.stat, bestMitigation.mitigation) : null,
    },
    performance: {
      kda: bestKdaStat ? toPlayerLeader(bestKdaStat.stat, bestKdaStat.kills / Math.max(1, bestKdaStat.deaths), 2) : null,
    },
    leaders: {
      kills: bestKills ? toPlayerLeader(bestKills.stat, bestKills.kills) : null,
      healing: bestHealing ? toPlayerLeader(bestHealing.stat, bestHealing.healing) : null,
      assists: bestAssists ? toPlayerLeader(bestAssists.stat, bestAssists.assists) : null,
      lowestDeaths: lowestDeaths ? toPlayerLeader(lowestDeaths.stat, lowestDeaths.deaths) : null,
      mitigation: bestMitigation ? toPlayerLeader(bestMitigation.stat, bestMitigation.mitigation) : null,
      kda: bestKdaStat ? toPlayerLeader(bestKdaStat.stat, bestKdaStat.kills / Math.max(1, bestKdaStat.deaths), 2) : null,
      totalDamage: topDamage ? toPlayerLeader(topDamage.stat, topDamage.damage) : null,
      totalHealing: topHealing ? toPlayerLeader(topHealing.stat, topHealing.healing) : null,
    },
    draft: {
      mostBannedHero: mostFrequent(actions, "BAN", heroesById, "name"),
      mostPickedMap: mostFrequent(actions, "PICK", mapsById, "description"),
      leastPlayedMaps,
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

    const snapshot = await buildSnapshot(tournament);
    const wrapped = existing
      ? await prisma.wrapped.update({
          where: { id: existing.id },
          data: { snapshot, generatedAt: new Date(), updatedAt: new Date() },
        })
      : await prisma.wrapped.create({ data: { tournamentId: tournament.id, snapshot, assets: {} } });
    cachedWrapped = wrapped;
    return res.status(existing ? 200 : 201).json(wrapped);
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
