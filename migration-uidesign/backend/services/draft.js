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

const parseHeroNameFromImgPath = (imgPath) => {
  if (typeof imgPath !== "string" || imgPath.length === 0) {
    return "Unknown Hero";
  }

  return imgPath
    .replace(/^.*\//, "")
    .replace(/^Icon-/i, "")
    .replace(/\.[^.]+$/, "")
    .replace(/%3F/gi, "o")
    .replace(/_/g, " ");
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

const determineFirstPicker = async (match) => {
  // For playoffs, semifinals, finals: team with most victories (or mapwins if tied)
  // For round robin: random
  const competitiveTypes = ["PLAYOFFS", "SEMIFINALS", "FINALS"];
  
  if (competitiveTypes.includes(match.type)) {
    const [teamA, teamB] = await Promise.all([
      prisma.team.findUnique({ where: { id: match.teamAId } }),
      prisma.team.findUnique({ where: { id: match.teamBId } }),
    ]);
    
    if (!teamA || !teamB) return match.teamAId;
    
    // Compare victories first
    if (teamA.victories !== teamB.victories) {
      return teamA.victories > teamB.victories ? match.teamAId : match.teamBId;
    }
    
    // If victories tied, compare mapWins - mapLoses (map differential)
    const teamADiff = teamA.mapWins - teamA.mapLoses;
    const teamBDiff = teamB.mapWins - teamB.mapLoses;
    
    if (teamADiff !== teamBDiff) {
      return teamADiff > teamBDiff ? match.teamAId : match.teamBId;
    }
    
    // If still tied, compare raw mapWins
    if (teamA.mapWins !== teamB.mapWins) {
      return teamA.mapWins > teamB.mapWins ? match.teamAId : match.teamBId;
    }
    
    // Truly tied - random
    return Math.random() < 0.5 ? match.teamAId : match.teamBId;
  }
  
  // Round robin or other: random
  return Math.random() < 0.5 ? match.teamAId : match.teamBId;
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
  
  // Determine who picks first map:
  // - For first game (STARTING phase): use determineFirstPicker based on match type
  // - For subsequent games (ENDMAP phase): loser of previous game picks (handled by currentTurnTeamId)
  let turnStarter;
  
  if (draft.phase === "STARTING" && currentGame === 1) {
    // First game - determine based on match type and team stats
    turnStarter = await determineFirstPicker(draft.match);
  } else {
    // Subsequent games - currentTurnTeamId is already set to loser of previous game
    const validTeams = [draft.match.teamAId, draft.match.teamBId];
    turnStarter = validTeams.includes(draft.currentTurnTeamId)
      ? draft.currentTurnTeamId
      : draft.match.teamAId;
  }

  return prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: draft.match.id },
      data: {
        gameNumber: currentGame,
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

  return prisma.$transaction(async (tx) => {
    const freshDraft = await tx.draftTable.findUnique({
      where: { id: draft.id },
      include: {
        actions: { orderBy: { order: "asc" } },
        match: true,
      },
    });

    if (!freshDraft) {
      throw new Error("Draft not found.");
    }

    if (freshDraft.phase !== "BAN") {
      throw new Error("Draft phase must be BAN.");
    }

    if (freshDraft.currentTurnTeamId && actingTeamId !== freshDraft.currentTurnTeamId) {
      throw new Error("It is not your turn to ban.");
    }

    const currentGame = normalizeGameNumber(freshDraft.match.gameNumber);
    const bansThisGame = freshDraft.actions.filter(
      (a) => a.action === "BAN" && a.gameNumber === currentGame
    );

    const teamBansThisGame = bansThisGame.filter((a) => a.teamId === actingTeamId);
    if (teamBansThisGame.length >= 2) {
      throw new Error("Each team can ban at most 2 heroes.");
    }

    if (!hasNoBan && heroId !== null) {
      const alreadyBannedByThisTeam = await tx.draftAction.findFirst({
        where: {
          draftId: freshDraft.id,
          action: "BAN",
          gameNumber: currentGame,
          value: heroId,
          teamId: actingTeamId,
        },
      });

      if (alreadyBannedByThisTeam) {
        throw new Error("Your team already banned this hero in this game.");
      }

      const bannedHeroIdsThisGame = bansThisGame
        .map((a) => a.value)
        .filter((v) => Number.isInteger(v));

      const bannedHeroesThisGame = bannedHeroIdsThisGame.length
        ? await tx.hero.findMany({ where: { id: { in: bannedHeroIdsThisGame } } })
        : [];

      const roleCounts = bannedHeroesThisGame.reduce(
        (acc, h) => {
          acc[h.role] += 1;
          return acc;
        },
        { TANK: 0, DPS: 0, SUPPORT: 0 }
      );

      if (hero && roleCounts[hero.role] >= 2) {
        throw new Error(`Role limit reached: only 2 ${hero.role} bans are allowed per game.`);
      }
    }

    const nextOrder = getNextOrder(freshDraft.actions);
    const bannedHeroes = Array.isArray(freshDraft.bannedHeroes) ? freshDraft.bannedHeroes : [];

    await tx.draftAction.create({
      data: {
        draftId: freshDraft.id,
        teamId: actingTeamId,
        action: "BAN",
        value: heroId,
        gameNumber: currentGame,
        order: nextOrder,
      },
    });

    const totalBansAfter = bansThisGame.length + 1;

    return tx.draftTable.update({
      where: { id: freshDraft.id },
      data: {
        bannedHeroes: heroId ? [...bannedHeroes, heroId] : bannedHeroes,
        currentTurnTeamId: getOtherTeamId(freshDraft.match, actingTeamId),
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
    heroes: heroes.map((hero) => ({
      ...hero,
      name: hero.name || parseHeroNameFromImgPath(hero.imgPath),
    })),
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
