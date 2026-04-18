const prisma = require("../config/prisma");

const mapOrder = ["CONTROL", "HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"];
const TURN_TIMEOUT_MS = 75 * 1000;

const normalizeGameNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
};

const assertPositiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return parsed;
};

const getAllowedMapTypes = (gameNumber) => {
  const safeGameNumber = normalizeGameNumber(gameNumber);
  const requiredType = mapOrder[(safeGameNumber - 1) % 5];

  if (safeGameNumber === 5) {
    return ["FLASHPOINT", "CONTROL"];
  }

  return requiredType ? [requiredType] : ["CONTROL"];
};

const getRoundKey = (gameNumber) => {
  const safe = normalizeGameNumber(gameNumber);
  return String(((safe - 1) % 5) + 1);
};

const parseAllowedMapPool = (mapsAllowedByRound, gameNumber) => {
  if (!mapsAllowedByRound || typeof mapsAllowedByRound !== "object") return null;
  const key = getRoundKey(gameNumber);
  const maybeArray = mapsAllowedByRound[key];
  if (!Array.isArray(maybeArray)) return null;
  const ids = maybeArray
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0);
  return ids.length ? ids : null;
};

const getNextOrder = (actions) => {
  if (!actions.length) return 1;
  return Math.max(...actions.map((a) => a.order)) + 1;
};

const getDraftByIdOrThrow = async (id) => {
  const draftId = assertPositiveInt(id, "draft id");

  const draft = await prisma.draftTable.findUnique({
    where: { id: draftId },
    include: {
      match: true,
      actions: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!draft) {
    throw new Error("Draft not found.");
  }

  return draft;
};

const ensureManagerRole = (user) => {
  if (!user || (user.role !== "MANAGER" && user.role !== "ADMIN")) {
    throw new Error("Only manager/admin can perform this action.");
  }
};

const resolveActingTeamId = (user, bodyTeamId, match) => {
  if (!user) {
    throw new Error("Unauthorized.");
  }

  if (user.role === "CAPTAIN") {
    const captainTeamId = Number(user.teamId);
    if (captainTeamId !== match.teamAId && captainTeamId !== match.teamBId) {
      throw new Error("Captain can only act on own match.");
    }
    return captainTeamId;
  }

  if (user.role === "MANAGER" || user.role === "ADMIN") {
    const parsed = assertPositiveInt(bodyTeamId, "teamId");
    if (parsed !== match.teamAId && parsed !== match.teamBId) {
      throw new Error("teamId must be one of the match teams.");
    }
    return parsed;
  }

  throw new Error("Unauthorized role for this action.");
};

const getOtherTeamId = (match, actingTeamId) => {
  return actingTeamId === match.teamAId ? match.teamBId : match.teamAId;
};

const getAvailableMaps = async ({ match, pickedMapIds }) => {
  const currentGame = normalizeGameNumber(match.gameNumber);
  const poolIds = parseAllowedMapPool(match.mapsAllowedByRound, currentGame);

  if (poolIds) {
    return prisma.map.findMany({
      where: {
        id: { in: poolIds.filter((id) => !pickedMapIds.includes(id)) },
      },
      orderBy: { id: "asc" },
    });
  }

  const allowedTypes = getAllowedMapTypes(currentGame);
  return prisma.map.findMany({
    where: {
      type: { in: allowedTypes },
      id: { notIn: pickedMapIds },
    },
    orderBy: { id: "asc" },
  });
};

const applyTimeoutIfNeeded = async (draft) => {
  if (!draft.currentTurnTeamId) return draft;
  if (!["MAPPICKING", "BAN"].includes(draft.phase)) return draft;

  const startedAt = draft.phaseStartedAt ? new Date(draft.phaseStartedAt).getTime() : Date.now();
  if (Date.now() - startedAt < TURN_TIMEOUT_MS) return draft;

  const currentGame = normalizeGameNumber(draft.match.gameNumber);
  const nextOrder = getNextOrder(draft.actions);

  if (draft.phase === "MAPPICKING") {
    const alreadyPicked = draft.actions.some(
      (a) => a.action === "PICK" && a.gameNumber === currentGame
    );
    if (alreadyPicked) return draft;

    const pickedMapIds = Array.isArray(draft.pickedMaps) ? draft.pickedMaps : [];
    const availableMaps = await getAvailableMaps({ match: draft.match, pickedMapIds });
    if (!availableMaps.length) {
      throw new Error("No available maps left for random timeout pick.");
    }

    const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];

    return prisma.$transaction(async (tx) => {
      await tx.draftAction.create({
        data: {
          draftId: draft.id,
          teamId: draft.currentTurnTeamId,
          action: "PICK",
          value: randomMap.id,
          gameNumber: currentGame,
          order: nextOrder,
        },
      });

      return tx.draftTable.update({
        where: { id: draft.id },
        data: {
          pickedMaps: [...pickedMapIds, randomMap.id],
          currentMapId: randomMap.id,
          currentTurnTeamId: draft.currentTurnTeamId,
          phaseStartedAt: new Date(),
        },
        include: {
          match: true,
          actions: { orderBy: { order: "asc" } },
        },
      });
    });
  }

  const bansThisGame = draft.actions.filter(
    (a) => a.action === "BAN" && a.gameNumber === currentGame
  );
  if (bansThisGame.length >= 4) return draft;

  return prisma.$transaction(async (tx) => {
    await tx.draftAction.create({
      data: {
        draftId: draft.id,
        teamId: draft.currentTurnTeamId,
        action: "BAN",
        value: null,
        gameNumber: currentGame,
        order: nextOrder,
      },
    });

    const totalBansAfter = bansThisGame.length + 1;
    return tx.draftTable.update({
      where: { id: draft.id },
      data: {
        phase: totalBansAfter >= 4 ? "ENDMAP" : "BAN",
        currentTurnTeamId:
          totalBansAfter >= 4 ? draft.currentTurnTeamId : getOtherTeamId(draft.match, draft.currentTurnTeamId),
        phaseStartedAt: new Date(),
      },
      include: {
        match: true,
        actions: { orderBy: { order: "asc" } },
      },
    });
  });
};

const createDraft = async (matchId, user) => {
  ensureManagerRole(user);
  const parsedMatchId = assertPositiveInt(matchId, "matchId");

  const match = await prisma.match.findUnique({
    where: { id: parsedMatchId },
  });

  if (!match) {
    throw new Error("Match not found.");
  }

  const existingDraft = await prisma.draftTable.findUnique({
    where: { matchId: parsedMatchId },
  });

  if (existingDraft) {
    throw new Error("Draft already exists for this match.");
  }

  return prisma.draftTable.create({
    data: {
      matchId: parsedMatchId,
      phase: "STARTING",
      currentTurnTeamId: match.teamAId,
      phaseStartedAt: new Date(),
      bannedHeroes: [],
      pickedMaps: [],
      currentMapId: null,
    },
    include: {
      actions: { orderBy: { order: "asc" } },
      match: true,
    },
  });
};

const startMapPicking = async (draftId, user) => {
  ensureManagerRole(user);
  const draft = await getDraftByIdOrThrow(draftId);

  if (!["STARTING", "ENDMAP"].includes(draft.phase)) {
    throw new Error("Draft must be in STARTING or ENDMAP phase.");
  }

  if (draft.match.status === "FINISHED") {
    throw new Error("Match is finished.");
  }

  // Managers can force progression even if captains have not confirmed ready.

  const currentGame = normalizeGameNumber(draft.match.gameNumber);
  const validTeams = [draft.match.teamAId, draft.match.teamBId];
  const turnStarter = validTeams.includes(draft.currentTurnTeamId)
    ? draft.currentTurnTeamId
    : draft.match.teamAId;

  return prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: draft.match.id },
      data: {
        gameNumber: currentGame,
        teamAready: 0,
        teamBready: 0,
        status: "ACTIVE",
      },
    });

    return tx.draftTable.update({
      where: { id: draft.id },
      data: {
        phase: "MAPPICKING",
        currentTurnTeamId: turnStarter,
        currentMapId: null,
        phaseStartedAt: new Date(),
      },
      include: {
        actions: { orderBy: { order: "asc" } },
        match: true,
      },
    });
  });
};

const pickMap = async (draftId, payload, user) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Body is required.");
  }

  const mapId = assertPositiveInt(payload.mapId, "mapId");
  const currentDraft = await getDraftByIdOrThrow(draftId);
  const draft = await applyTimeoutIfNeeded(currentDraft);

  if (draft.phase !== "MAPPICKING") {
    throw new Error("Draft phase must be MAPPICKING.");
  }

  const actingTeamId = resolveActingTeamId(user, payload.teamId, draft.match);

  if (draft.currentTurnTeamId && actingTeamId !== draft.currentTurnTeamId) {
    throw new Error("It is not your turn to pick the map.");
  }

  const currentGame = normalizeGameNumber(draft.match.gameNumber);
  const allowedTypes = getAllowedMapTypes(currentGame);
  const poolIds = parseAllowedMapPool(draft.match.mapsAllowedByRound, currentGame);

  const map = await prisma.map.findUnique({ where: { id: mapId } });
  if (!map) {
    throw new Error("Map not found.");
  }

  if (poolIds && !poolIds.includes(mapId)) {
    throw new Error(`Map ${mapId} is not allowed for round ${getRoundKey(currentGame)}.`);
  }

  if (!poolIds && !allowedTypes.includes(map.type)) {
    throw new Error(`Invalid map type. Allowed for game ${currentGame}: ${allowedTypes.join(", ")}.`);
  }

  const pickedMapIds = Array.isArray(draft.pickedMaps) ? draft.pickedMaps : [];
  if (pickedMapIds.includes(mapId)) {
    throw new Error("Map already picked in this match.");
  }

  const pickForCurrentGame = draft.actions.find(
    (a) => a.action === "PICK" && a.gameNumber === currentGame
  );

  if (pickForCurrentGame) {
    throw new Error("Map already picked for current game.");
  }

  const nextOrder = getNextOrder(draft.actions);

  return prisma.$transaction(async (tx) => {
    await tx.draftAction.create({
      data: {
        draftId: draft.id,
        teamId: actingTeamId,
        action: "PICK",
        value: mapId,
        gameNumber: currentGame,
        order: nextOrder,
      },
    });

    return tx.draftTable.update({
      where: { id: draft.id },
      data: {
        pickedMaps: [...pickedMapIds, mapId],
        currentMapId: mapId,
        currentTurnTeamId: actingTeamId,
        phaseStartedAt: new Date(),
      },
      include: {
        actions: { orderBy: { order: "asc" } },
        match: true,
      },
    });
  });
};

const startBan = async (draftId, user) => {
  ensureManagerRole(user);
  const draft = await getDraftByIdOrThrow(draftId);

  if (draft.phase !== "MAPPICKING") {
    throw new Error("Draft must be in MAPPICKING phase.");
  }

  const currentGame = normalizeGameNumber(draft.match.gameNumber);
  const pickedThisGame = draft.actions.find(
    (a) => a.action === "PICK" && a.gameNumber === currentGame
  );

  if (!pickedThisGame) {
    throw new Error("Current game must have a picked map before bans.");
  }

  const firstBanTeam = pickedThisGame.teamId;

  return prisma.draftTable.update({
    where: { id: draft.id },
    data: {
      phase: "BAN",
      currentTurnTeamId: firstBanTeam,
      phaseStartedAt: new Date(),
    },
    include: {
      actions: { orderBy: { order: "asc" } },
      match: true,
    },
  });
};

const banHero = async (draftId, payload, user) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Body is required.");
  }

  const hasNoBan = payload.heroId === null || payload.heroId === undefined || payload.heroId === "";
  const heroId = hasNoBan ? null : assertPositiveInt(payload.heroId, "heroId");

  const currentDraft = await getDraftByIdOrThrow(draftId);
  const draft = await applyTimeoutIfNeeded(currentDraft);

  if (draft.phase !== "BAN") {
    throw new Error("Draft phase must be BAN.");
  }

  const actingTeamId = resolveActingTeamId(user, payload.teamId, draft.match);

  if (draft.currentTurnTeamId && actingTeamId !== draft.currentTurnTeamId) {
    throw new Error("It is not your turn to ban.");
  }

  let hero = null;
  if (!hasNoBan) {
    hero = await prisma.hero.findUnique({ where: { id: heroId } });
    if (!hero) {
      throw new Error("Hero not found.");
    }
  }

  const alreadyBannedInMatch = hasNoBan
    ? null
    : await prisma.draftAction.findFirst({
      where: {
        draftId: draft.id,
        action: "BAN",
        value: heroId,
      },
    });

  if (alreadyBannedInMatch) {
    throw new Error("Hero already banned in this match.");
  }

  const currentGame = normalizeGameNumber(draft.match.gameNumber);
  const bansThisGame = draft.actions.filter(
    (a) => a.action === "BAN" && a.gameNumber === currentGame
  );

  const teamBanCount = bansThisGame.filter((a) => a.teamId === actingTeamId).length;
  if (teamBanCount >= 2) {
    throw new Error("Each team can ban at most 2 heroes.");
  }

  const bannedHeroIdsThisGame = bansThisGame.map((a) => a.value).filter((v) => Number.isInteger(v));
  const heroesInThisGame = bannedHeroIdsThisGame.length
    ? await prisma.hero.findMany({ where: { id: { in: bannedHeroIdsThisGame } } })
    : [];

  const roleCounts = heroesInThisGame.reduce(
    (acc, h) => {
      acc[h.role] += 1;
      return acc;
    },
    { TANK: 0, DPS: 0, SUPPORT: 0 }
  );

  if (hero && roleCounts[hero.role] >= 2) {
    throw new Error(`Role limit reached: at most 2 bans for ${hero.role}.`);
  }

  const nextOrder = getNextOrder(draft.actions);
  const bannedHeroes = Array.isArray(draft.bannedHeroes) ? draft.bannedHeroes : [];

  return prisma.$transaction(async (tx) => {
    await tx.draftAction.create({
      data: {
        draftId: draft.id,
        teamId: actingTeamId,
        action: "BAN",
        value: heroId,
        gameNumber: currentGame,
        order: nextOrder,
      },
    });

    const totalBansAfter = bansThisGame.length + 1;

    return tx.draftTable.update({
      where: { id: draft.id },
      data: {
        bannedHeroes: heroId ? [...bannedHeroes, heroId] : bannedHeroes,
        currentTurnTeamId: getOtherTeamId(draft.match, actingTeamId),
        phase: totalBansAfter >= 4 ? "ENDMAP" : "BAN",
        phaseStartedAt: new Date(),
      },
      include: {
        actions: { orderBy: { order: "asc" } },
        match: true,
      },
    });
  });
};

const endMap = async (draftId, user) => {
  ensureManagerRole(user);
  const draft = await getDraftByIdOrThrow(draftId);

  if (draft.phase !== "BAN" && draft.phase !== "ENDMAP") {
    throw new Error("Draft phase must be BAN or ENDMAP to end map.");
  }

  const currentGame = normalizeGameNumber(draft.match.gameNumber);
  const bansThisGame = draft.actions.filter(
    (a) => a.action === "BAN" && a.gameNumber === currentGame
  );

  // Manager override: allow ending map even with incomplete bans to avoid deadlocks.

  return prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: draft.match.id },
      data: { status: "PENDINGREGISTERS" },
    });

    return tx.draftTable.update({
      where: { id: draft.id },
      data: {
        phase: "ENDMAP",
        phaseStartedAt: new Date(),
      },
      include: {
        actions: { orderBy: { order: "asc" } },
        match: true,
      },
    });
  });
};

const getDraftState = async (draftId) => {
  const currentDraft = await getDraftByIdOrThrow(draftId);
  const draft = await applyTimeoutIfNeeded(currentDraft);

  const gameNumber = normalizeGameNumber(draft.match.gameNumber);
  const allowedMapTypes = getAllowedMapTypes(gameNumber);
  const pickedMapIds = Array.isArray(draft.pickedMaps) ? draft.pickedMaps : [];

  const availableMaps = await getAvailableMaps({ match: draft.match, pickedMapIds });

  const poolIds = parseAllowedMapPool(draft.match.mapsAllowedByRound, gameNumber);
  const allowedTypesFromPool = poolIds
    ? [...new Set(availableMaps.map((m) => m.type))]
    : allowedMapTypes;

  const heroes = await prisma.hero.findMany({
    orderBy: { id: "asc" },
  });

  const allMaps = await prisma.map.findMany({
    orderBy: { id: "asc" },
  });

  return {
    ...draft,
    allowedMapTypes: allowedTypesFromPool,
    availableMaps,
    allMaps,
    heroes,
  };
};

const getDraftByMatchId = async (matchId) => {
  const parsedMatchId = assertPositiveInt(matchId, "matchId");

  const draft = await prisma.draftTable.findUnique({
    where: { matchId: parsedMatchId },
    include: {
      match: true,
      actions: { orderBy: { order: "asc" } },
    },
  });

  if (!draft) {
    throw new Error("Draft not found for this match.");
  }

  // Return full state like getDraftState
  return getDraftState(draft.id);
};

module.exports = {
  mapOrder,
  createDraft,
  startMapPicking,
  pickMap,
  startBan,
  banHero,
  endMap,
  getDraftState,
  getDraftByMatchId,
};
