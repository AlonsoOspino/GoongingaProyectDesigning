const prisma = require("../config/prisma");
const { retryAfterWrappedMigration } = require("../utils/ensureWrappedSchema");

const DAY_MS = 24 * 60 * 60 * 1000;
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
  const mapsPlayed = Number.isFinite(player.mapsPlayed)
    ? player.mapsPlayed
    : player.mapKeys instanceof Set
      ? player.mapKeys.size
      : 0;
  return {
    userId: player.userId,
    player: player.user.nickname,
    profilePic: player.user.profilePic || null,
    team: player.user.team?.name || null,
    mapsPlayed,
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

function toHeroRanking(hero, count) {
  if (!hero) return null;
  return {
    heroId: hero.id,
    name: hero.name || "Unknown hero",
    image: hero.imgPath || null,
    role: hero.role,
    count,
  };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// Keep the Wrapped leaderboard in lockstep with /playerStat/public and the
// frontend buildPlayerAverages helper. That page averages each stored /10
// value per recorded game (rather than recomputing a duration-weighted rate).
function buildLeaderboardAverages(stats) {
  const byUser = new Map();
  const metrics = ["damagePer10", "mitigationPer10", "healingPer10", "assistsPer10", "deathsPer10", "killsPer10"];

  for (const stat of stats) {
    const current = byUser.get(stat.userId) || {
      userId: stat.userId,
      user: stat.user,
      games: 0,
      mapKeys: new Set(),
      ...Object.fromEntries(metrics.map((metric) => [metric, 0])),
    };
    const n = current.games;
    current.games += 1;
    current.user = stat.user || current.user;
    for (const metric of metrics) {
      current[metric] = (current[metric] * n + Number(stat[metric] || 0)) / (n + 1);
    }
    if (stat.matchId !== undefined && stat.gameNumber !== undefined) {
      current.mapKeys.add(`${stat.matchId}:${stat.gameNumber}`);
    }
    byUser.set(stat.userId, current);
  }

  return [...byUser.values()].map((player) => {
    const { mapKeys, ...snapshotPlayer } = player;
    return {
      ...snapshotPlayer,
      mapsPlayed: mapKeys.size,
      ...Object.fromEntries(metrics.map((metric) => [metric, round2(player[metric])])),
    };
  });
}

function hydrateCurrentProfilePictures(wrapped, members) {
  if (!wrapped?.snapshot) return wrapped;
  const profileByUserId = new Map(members.map((member) => [member.id, member.profilePic || null]));
  const withCurrentProfile = (leader) => {
    if (!leader || !profileByUserId.has(leader.userId)) return leader;
    return { ...leader, profilePic: profileByUserId.get(leader.userId) };
  };
  const snapshot = wrapped.snapshot;

  return {
    ...wrapped,
    snapshot: {
      ...snapshot,
      averagesPer10: snapshot.averagesPer10 ? {
        ...snapshot.averagesPer10,
        kills: withCurrentProfile(snapshot.averagesPer10.kills),
        healing: withCurrentProfile(snapshot.averagesPer10.healing),
        damage: withCurrentProfile(snapshot.averagesPer10.damage),
        mitigation: withCurrentProfile(snapshot.averagesPer10.mitigation),
        assists: withCurrentProfile(snapshot.averagesPer10.assists),
        lowestDeaths: withCurrentProfile(snapshot.averagesPer10.lowestDeaths),
      } : snapshot.averagesPer10,
      totals: snapshot.totals ? {
        ...snapshot.totals,
        damage: withCurrentProfile(snapshot.totals.damage),
        healing: withCurrentProfile(snapshot.totals.healing),
        mitigation: withCurrentProfile(snapshot.totals.mitigation),
      } : snapshot.totals,
      performance: snapshot.performance ? {
        ...snapshot.performance,
        kd: withCurrentProfile(snapshot.performance.kd),
        kda: withCurrentProfile(snapshot.performance.kda),
      } : snapshot.performance,
    },
  };
}

async function withCurrentProfilePictures(wrapped) {
  const snapshot = wrapped?.snapshot;
  if (!snapshot) return wrapped;
  const leaders = [
    ...Object.values(snapshot.averagesPer10 || {}),
    ...Object.values(snapshot.totals || {}),
    ...Object.values(snapshot.performance || {}),
  ];
  const userIds = [...new Set(leaders.map((leader) => leader?.userId).filter(Number.isInteger))];
  if (!userIds.length) return wrapped;
  const members = await prisma.member.findMany({
    where: { id: { in: userIds } },
    select: { id: true, profilePic: true },
  });
  return hydrateCurrentProfilePictures(wrapped, members);
}

function pickLeaderboardLeader(players, metric, lowerIsBetter = false) {
  return players.reduce((best, player) => {
    if (!best) return player;
    return lowerIsBetter
      ? player[metric] < best[metric] ? player : best
      : player[metric] > best[metric] ? player : best;
  }, null);
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

function normalizeAssets(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { images: {}, flipped: {}, videos: {}, videoPositions: {}, storyAudios: {}, soundtrack: {} };
  }

  const imageSource = value.images && typeof value.images === "object" && !Array.isArray(value.images)
    ? value.images
    : value;
  const flipSource = value.flipped && typeof value.flipped === "object" && !Array.isArray(value.flipped)
    ? value.flipped
    : {};
  const videoSource = value.videos && typeof value.videos === "object" && !Array.isArray(value.videos)
    ? value.videos
    : {};
  const videoPositionSource = value.videoPositions && typeof value.videoPositions === "object" && !Array.isArray(value.videoPositions)
    ? value.videoPositions
    : {};
  const storyAudioSource = value.storyAudios && typeof value.storyAudios === "object" && !Array.isArray(value.storyAudios)
    ? value.storyAudios
    : {};
  const soundtrackSource = value.soundtrack && typeof value.soundtrack === "object" && !Array.isArray(value.soundtrack)
    ? value.soundtrack
    : {};
  const storyDurationSource = value.storyDurations && typeof value.storyDurations === "object" && !Array.isArray(value.storyDurations)
    ? value.storyDurations
    : {};

  const normalizeTrack = (track, legacyUrl = null) => {
    const source = track && typeof track === "object" && !Array.isArray(track) ? track : {};
    const rawUrl = typeof source.url === "string" ? source.url : legacyUrl;
    if (typeof rawUrl !== "string" || !rawUrl.trim()) return null;
    const rawDuration = Number(source.durationSeconds);
    return {
      url: rawUrl.trim(),
      ...(Number.isFinite(rawDuration) && rawDuration > 0 ? { durationSeconds: Math.round(rawDuration * 1000) / 1000 } : {}),
    };
  };

  // `general` was the old looping soundtrack. Preserve it as the new
  // one-shot recap track until a manager replaces it; the intro loop is
  // intentionally discarded.
  const recapTrack = normalizeTrack(soundtrackSource.recap, typeof soundtrackSource.general === "string" ? soundtrackSource.general : null);
  const countdownTrack = normalizeTrack(soundtrackSource.countdown);
  const storyDurations = Object.fromEntries(
    Object.entries(storyDurationSource)
      .filter(([key, rawValue]) => ["intro", "finalists", "thanksBefore", "thanks", "community", "leaderboard"].includes(key) && typeof rawValue === "number" && Number.isFinite(rawValue) && rawValue > 0)
      .map(([key, rawValue]) => [key, Math.round(Number(rawValue) * 1000) / 1000])
  );

  return {
    images: Object.fromEntries(
      Object.entries(imageSource)
        .filter(([key, url]) => ASSET_KEYS.has(key) && typeof url === "string" && url.trim())
        .map(([key, url]) => [key, url.trim()])
    ),
    flipped: Object.fromEntries(
      Object.entries(flipSource).filter(([key, enabled]) => ASSET_KEYS.has(key) && enabled === true)
    ),
    videos: Object.fromEntries(
      Object.entries(videoSource)
        .filter(([key, url]) => ASSET_KEYS.has(key) && typeof url === "string" && url.trim())
        .map(([key, url]) => [key, url.trim()])
    ),
    videoPositions: Object.fromEntries(
      Object.entries(videoPositionSource)
        .filter(([key, position]) => ASSET_KEYS.has(key) && position && typeof position === "object" && !Array.isArray(position))
        .map(([key, position]) => {
          const rawX = Number.isFinite(position.x) ? position.x : 50;
          const rawY = Number.isFinite(position.y) ? position.y : 50;
          return [key, {
            x: Math.min(100, Math.max(0, rawX)),
            y: Math.min(100, Math.max(0, rawY)),
          }];
        })
    ),
    storyAudios: Object.fromEntries(
      Object.entries(storyAudioSource)
        .filter(([key, sources]) => ASSET_KEYS.has(key) && Array.isArray(sources))
        .map(([key, sources]) => [key, sources.filter((source) => typeof source === "string" && source.trim()).map((source) => source.trim()).slice(0, 3)])
        .filter(([, sources]) => sources.length)
    ),
    soundtrack: {
      ...(recapTrack ? { recap: recapTrack } : {}),
      ...(countdownTrack ? { countdown: countdownTrack } : {}),
    },
    ...(Object.keys(storyDurations).length ? { storyDurations } : {}),
  };
}

function retainMatchingAssets(previousWrapped, nextSnapshot) {
  const previousAssets = normalizeAssets(previousWrapped?.assets);
  const images = Object.fromEntries(
    Object.entries(previousAssets.images).filter(([key]) =>
      getSnapshotAssetSubject(previousWrapped?.snapshot, key) &&
      getSnapshotAssetSubject(previousWrapped?.snapshot, key) === getSnapshotAssetSubject(nextSnapshot, key)
    )
  );
  const flipped = Object.fromEntries(
    Object.entries(previousAssets.flipped).filter(([key]) => Object.prototype.hasOwnProperty.call(images, key))
  );
  const videos = Object.fromEntries(
    Object.entries(previousAssets.videos).filter(([key]) =>
      getSnapshotAssetSubject(previousWrapped?.snapshot, key) &&
      getSnapshotAssetSubject(previousWrapped?.snapshot, key) === getSnapshotAssetSubject(nextSnapshot, key)
    )
  );
  const storyAudios = Object.fromEntries(
    Object.entries(previousAssets.storyAudios).filter(([key]) => Object.prototype.hasOwnProperty.call(videos, key))
  );
  const videoPositions = Object.fromEntries(
    Object.entries(previousAssets.videoPositions).filter(([key]) => Object.prototype.hasOwnProperty.call(videos, key))
  );

  return {
    images,
    flipped,
    videos,
    videoPositions,
    storyAudios,
    soundtrack: previousAssets.soundtrack,
    ...(Object.keys(previousAssets.storyDurations || {}).length ? { storyDurations: previousAssets.storyDurations } : {}),
  };
}

async function buildSnapshot(tournament) {
  const [stats, leaderboardStats, draftActions, teams, maps, heroes] = await Promise.all([
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
    prisma.playerStat.findMany({
      // Same source and ordering as GET /playerStat/public, which powers the
      // Player Stats leaderboard shown to managers and viewers.
      where: { match: { tournamentId: tournament.id, status: "FINISHED" } },
      select: {
        userId: true,
        matchId: true,
        gameNumber: true,
        damagePer10: true,
        healingPer10: true,
        mitigationPer10: true,
        killsPer10: true,
        assistsPer10: true,
        deathsPer10: true,
        user: {
          select: {
            nickname: true,
            profilePic: true,
            team: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.draftAction.findMany({
      where: {
        action: { in: ["PICK", "BAN"] },
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
    prisma.hero.findMany({
      select: { id: true, name: true, imgPath: true, role: true },
      orderBy: { name: "asc" },
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
      mapKeys: new Set(),
    };
    current.kills += stat.kills;
    current.assists += stat.assists;
    current.deaths += stat.deaths;
    current.damage += stat.damage;
    current.healing += stat.healing;
    current.mitigation += stat.mitigation;
    if (Number(stat.gameDuration) > 0) current.validDuration += Number(stat.gameDuration);
    current.mapKeys.add(`${stat.matchId}:${stat.gameNumber}`);
    totalsByPlayer.set(stat.userId, current);

    globalTotals.damage += stat.damage;
    globalTotals.healing += stat.healing;
    globalTotals.mitigation += stat.mitigation;
  }

  const players = [...totalsByPlayer.values()];
  const leaderboardPlayers = buildLeaderboardAverages(leaderboardStats);
  const playerOptions = { getTieLabel: (player) => player.user.nickname };
  const rateLeader = (metric, lowerIsBetter = false) => {
    const winner = pickLeaderboardLeader(leaderboardPlayers, metric, lowerIsBetter);
    return winner ? toPlayerLeader(winner, winner[metric], 2) : null;
  };
  const totalLeader = (field) => {
    const winner = pickBest(players, (player) => player[field], playerOptions);
    return winner ? toPlayerLeader(winner, winner[field]) : null;
  };

  const mapPicks = draftActions.filter((action) => action.action === "PICK");
  const heroBans = draftActions.filter((action) => action.action === "BAN");
  const mapCounts = new Map(mapPicks.map((action) => [action.value, 0]));
  for (const action of mapPicks) mapCounts.set(action.value, (mapCounts.get(action.value) || 0) + 1);
  const mapOptions = { getTieLabel: (item) => item.map.description };
  const mapEntries = maps.map((map) => ({ map, count: mapCounts.get(map.id) || 0 }));
  const mostPicked = mapPicks.length
    ? pickBest(mapEntries, (item) => item.count, mapOptions)
    : null;
  const leastPicked = pickBest(mapEntries, (item) => item.count, { ...mapOptions, lowerIsBetter: true });
  const heroCounts = new Map();
  for (const action of heroBans) heroCounts.set(action.value, (heroCounts.get(action.value) || 0) + 1);
  const heroEntries = heroes.map((hero) => ({ hero, count: heroCounts.get(hero.id) || 0 }));
  const heroOptions = { getTieLabel: (item) => item.hero.name || "" };
  const mostBanned = heroBans.length ? pickBest(heroEntries, (item) => item.count, heroOptions) : null;
  const leastBanned = pickBest(heroEntries, (item) => item.count, { ...heroOptions, lowerIsBetter: true });

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
      kills: rateLeader("killsPer10"),
      healing: rateLeader("healingPer10"),
      damage: rateLeader("damagePer10"),
      mitigation: rateLeader("mitigationPer10"),
      assists: rateLeader("assistsPer10"),
      lowestDeaths: rateLeader("deathsPer10", true),
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
    heroes: {
      mostBanned: mostBanned ? toHeroRanking(mostBanned.hero, mostBanned.count) : null,
      leastBanned: leastBanned ? toHeroRanking(leastBanned.hero, leastBanned.count) : null,
    },
  };
}

async function getCurrentWrapped(_req, res) {
  try {
    const wrapped = await getLatestWrapped();
    if (!wrapped) return res.status(404).json({ message: "Goonginga Wrapped has not been generated yet." });
    const hydratedWrapped = await withCurrentProfilePictures(wrapped);
    res.set("Cache-Control", "no-store");
    return res.json(hydratedWrapped);
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
    if (!wrapped) return res.status(404).json({ message: "Freeze the Wrapped before adding its media." });

    const assets = req.body?.assets;
    if (!assets || typeof assets !== "object" || Array.isArray(assets)) {
      return res.status(400).json({ message: "assets must contain Wrapped media settings." });
    }

    const cleanAssets = normalizeAssets(assets);
    const updated = await prisma.wrapped.update({ where: { id: wrapped.id }, data: { assets: cleanAssets } });
    cachedWrapped = updated;
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Failed to save Wrapped media." });
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
  __testables: { buildLeaderboardAverages, pickBest, normalizeAssets, retainMatchingAssets, hydrateCurrentProfilePictures },
};
