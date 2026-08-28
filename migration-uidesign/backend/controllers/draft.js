const prisma = require("../config/prisma");
const { hasManagerAccess, resolveSeasonPlayer } = require("../utils/permissions");

const mapOrder = ["CONTROL", "HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"];
const FIRST_GAME_MAP_TYPE = "CONTROL";
const LOSER_PICKABLE_MAP_TYPES = ["HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"];

// Bracket matches (playoff rounds and the Grand Final) draft from the full map
// pool filtered by the cycle type, not from the per-round pools of round robin.
const isBracketMatchType = (matchType) =>
  matchType === "PLAYOFFS" || matchType === "FINALS";
// Timer is 95 seconds per turn
const TURN_TIMEOUT_MS = 95 * 1000;
const ALERT_HOLD_MS = 3 * 1000;
const PHASE_START_HOLD_MS = 5 * 1000;

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

// Game one always opens on Control. From game two onward the team that lost
// the previous game chooses the mode before choosing a map. Match type no
// longer changes that sequence; the parameter remains for API compatibility.
const getAllowedMapTypes = (gameNumber, _matchType) => {
  const safeGameNumber = normalizeGameNumber(gameNumber);
  return safeGameNumber === 1
    ? [FIRST_GAME_MAP_TYPE]
    : [...LOSER_PICKABLE_MAP_TYPES];
};

// Round keys must span the whole cycle, otherwise games 6-7 of a best of 7
// would collide with the pools configured for games 1-2.
const getRoundKey = (gameNumber, matchType) => {
  const safe = normalizeGameNumber(gameNumber);
  const cycleLength = matchType === "FINALS" ? 7 : 5;
  return String(((safe - 1) % cycleLength) + 1);
};

const parseAllowedMapPool = (mapsAllowedByRound, gameNumber, matchType) => {
  if (!mapsAllowedByRound || typeof mapsAllowedByRound !== "object") return null;
  const key = getRoundKey(gameNumber, matchType);
  const maybeArray = mapsAllowedByRound[key];
  if (!Array.isArray(maybeArray)) return null;
  const ids = maybeArray
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0);
  return ids.length ? ids : null;
};

// Weekly map configuration was historically stored by fixed game number. The
// loser-picks-mode flow treats that object as one weekly pool and filters the
// union by the selected mode. This preserves existing admin data without
// forcing a second map-pool migration.
const parseAllAllowedMapIds = (mapsAllowedByRound) => {
  if (!mapsAllowedByRound || typeof mapsAllowedByRound !== "object") return null;

  const ids = Object.values(mapsAllowedByRound)
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  const uniqueIds = [...new Set(ids)];
  return uniqueIds.length ? uniqueIds : null;
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
  if (!hasManagerAccess(user)) {
    throw new Error("Only manager, Social Media, or admin can perform this action.");
  }
};

const resolveActingTeamId = async (user, bodyTeamId, match, client = prisma) => {
  if (!user) {
    throw new Error("Unauthorized.");
  }

  const seasonPlayer = await resolveSeasonPlayer(user.id, match.tournamentId, client);
  if (seasonPlayer?.role === "CAPTAIN") {
    const captainTeamId = seasonPlayer.teamId;
    if (captainTeamId !== match.teamAId && captainTeamId !== match.teamBId) {
      throw new Error("Captain can only act on own match.");
    }
    return captainTeamId;
  }

  if (hasManagerAccess(user)) {
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

const getMapPoolWhere = ({ match, pickedMapIds, mapTypes }) => {
  const configuredPoolIds = isBracketMatchType(match.type)
    ? null
    : parseAllAllowedMapIds(match.mapsAllowedByRound);

  return {
    type: { in: mapTypes },
    id: configuredPoolIds
      ? {
          in: configuredPoolIds,
          notIn: pickedMapIds,
        }
      : { notIn: pickedMapIds },
  };
};

const getAvailableMapTypes = async ({ match, pickedMapIds }) => {
  const currentGame = (match.gameNumber || 0) + 1;
  const candidateTypes = getAllowedMapTypes(currentGame, match.type);
  const maps = await prisma.map.findMany({
    where: getMapPoolWhere({ match, pickedMapIds, mapTypes: candidateTypes }),
    select: { type: true },
  });
  const availableTypes = new Set(maps.map((map) => map.type));

  return candidateTypes.filter((mapType) => availableTypes.has(mapType));
};

// How many unplayed maps sit behind each mode this game. The map-type screen
// shows this on every plate so a captain can see that picking Push leaves them
// one map while Payload leaves four, before committing to the mode.
const getAvailableMapTypeCounts = async ({ match, pickedMapIds }) => {
  const currentGame = (match.gameNumber || 0) + 1;
  const candidateTypes = getAllowedMapTypes(currentGame, match.type);
  const grouped = await prisma.map.groupBy({
    by: ["type"],
    where: getMapPoolWhere({ match, pickedMapIds, mapTypes: candidateTypes }),
    _count: { _all: true },
  });

  return Object.fromEntries(grouped.map((row) => [row.type, row._count._all]));
};

const getAvailableMaps = async ({ match, pickedMapIds, selectedMapType }) => {
  const currentGame = (match.gameNumber || 0) + 1;
  const effectiveMapType =
    selectedMapType || (currentGame === 1 ? FIRST_GAME_MAP_TYPE : null);

  if (!effectiveMapType) return [];

  return prisma.map.findMany({
    where: getMapPoolWhere({
      match,
      pickedMapIds,
      mapTypes: [effectiveMapType],
    }),
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

const reloadDraft = (tx, draftId) =>
  tx.draftTable.findUnique({
    where: { id: draftId },
    include: {
      match: true,
      actions: { orderBy: { order: "asc" } },
    },
  });

const applyTimeoutIfNeeded = async (draft) => {
  if (!draft.currentTurnTeamId) return draft;
  if (!["MAPTYPEPICKING", "MAPPICKING", "BAN"].includes(draft.phase)) return draft;
  // Manager-initiated pause freezes the draft turn timer entirely.
  if (draft.match && draft.match.mapTimerPaused) return draft;

  const startedAt = draft.phaseStartedAt ? new Date(draft.phaseStartedAt).getTime() : Date.now();
  if (Date.now() - startedAt < TURN_TIMEOUT_MS) return draft;

  // Use gameNumber+1 for current game being played
  const currentGame = (draft.match.gameNumber || 0) + 1;

  // Snapshot the values we will compare-and-swap against to prevent
  // concurrent timeout writers from each registering their own skip.
  const originalPhase = draft.phase;
  const originalTurnTeamId = draft.currentTurnTeamId;
  const originalPhaseStartedAt = draft.phaseStartedAt;

  if (draft.phase === "MAPTYPEPICKING") {
    const pickedMapIds = Array.isArray(draft.pickedMaps) ? draft.pickedMaps : [];
    const availableMapTypes = await getAvailableMapTypes({
      match: draft.match,
      pickedMapIds,
    });
    const fallbackMapType = availableMapTypes[0];

    if (!fallbackMapType) {
      throw new Error("No map types with available maps remain for this match.");
    }

    return prisma.$transaction(async (tx) => {
      const claim = await tx.draftTable.updateMany({
        where: {
          id: draft.id,
          phase: originalPhase,
          currentTurnTeamId: originalTurnTeamId,
          phaseStartedAt: originalPhaseStartedAt,
        },
        data: { phaseStartedAt: new Date() },
      });

      if (claim.count === 0) {
        return reloadDraft(tx, draft.id);
      }

      return tx.draftTable.update({
        where: { id: draft.id },
        data: {
          phase: "MAPPICKING",
          selectedMapType: fallbackMapType,
          currentTurnTeamId: originalTurnTeamId,
          phaseStartedAt: new Date(Date.now() + PHASE_START_HOLD_MS),
        },
        include: {
          match: true,
          actions: { orderBy: { order: "asc" } },
        },
      });
    });
  }

  if (draft.phase === "MAPPICKING") {
    const alreadyPicked = draft.actions.some(
      (a) => a.action === "PICK" && a.gameNumber === currentGame
    );
    if (alreadyPicked) return draft;

    const pickedMapIds = Array.isArray(draft.pickedMaps) ? draft.pickedMaps : [];
    const availableMaps = await getAvailableMaps({
      match: draft.match,
      pickedMapIds,
      selectedMapType: draft.selectedMapType,
    });
    if (!availableMaps.length) {
      throw new Error("No available maps left for random timeout pick.");
    }

    const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];

    return prisma.$transaction(async (tx) => {
      // Atomic claim: only one concurrent timeout writer wins. The where
      // clause includes the original phaseStartedAt so racing requests that
      // already see an updated timestamp will match 0 rows and bail out.
      const claim = await tx.draftTable.updateMany({
        where: {
          id: draft.id,
          phase: originalPhase,
          currentTurnTeamId: originalTurnTeamId,
          phaseStartedAt: originalPhaseStartedAt,
        },
        data: { phaseStartedAt: new Date() },
      });

      if (claim.count === 0) {
        return reloadDraft(tx, draft.id);
      }

      const fresh = await reloadDraft(tx, draft.id);
      const alreadyPickedFresh = fresh.actions.some(
        (a) => a.action === "PICK" && a.gameNumber === currentGame
      );
      if (alreadyPickedFresh) return fresh;

      const freshPickedMapIds = Array.isArray(fresh.pickedMaps) ? fresh.pickedMaps : [];

      await tx.draftAction.create({
        data: {
          draftId: draft.id,
          teamId: originalTurnTeamId,
          action: "PICK",
          value: randomMap.id,
          gameNumber: currentGame,
          order: getNextOrder(fresh.actions),
        },
      });

      return tx.draftTable.update({
        where: { id: draft.id },
        data: {
          pickedMaps: [...freshPickedMapIds, randomMap.id],
          currentMapId: randomMap.id,
          currentTurnTeamId: originalTurnTeamId,
          phaseStartedAt: new Date(Date.now() + ALERT_HOLD_MS),
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
    // Atomic claim: only one concurrent timeout writer wins. Racing
    // requests will see an updated phaseStartedAt and match 0 rows here.
    const claim = await tx.draftTable.updateMany({
      where: {
        id: draft.id,
        phase: originalPhase,
        currentTurnTeamId: originalTurnTeamId,
        phaseStartedAt: originalPhaseStartedAt,
      },
      data: { phaseStartedAt: new Date() },
    });

    if (claim.count === 0) {
      return reloadDraft(tx, draft.id);
    }

    const fresh = await reloadDraft(tx, draft.id);
    const freshBans = fresh.actions.filter(
      (a) => a.action === "BAN" && a.gameNumber === currentGame
    );

    if (freshBans.length >= 4) {
      return fresh;
    }

    await tx.draftAction.create({
      data: {
        draftId: draft.id,
        teamId: originalTurnTeamId,
        action: "BAN",
        value: null,
        gameNumber: currentGame,
        order: getNextOrder(fresh.actions),
      },
    });

    const totalBansAfter = freshBans.length + 1;
    return tx.draftTable.update({
      where: { id: draft.id },
      data: {
        phase: totalBansAfter >= 4 ? "PLAYING" : "BAN",
        currentTurnTeamId:
          totalBansAfter >= 4
            ? originalTurnTeamId
            : getOtherTeamId(fresh.match, originalTurnTeamId),
        phaseStartedAt: new Date(Date.now() + ALERT_HOLD_MS),
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

  const firstPickerTeamId = await determineFirstPicker(match);

  return prisma.draftTable.create({
    data: {
      matchId: parsedMatchId,
      phase: "STARTING",
      currentTurnTeamId: firstPickerTeamId,
      phaseStartedAt: new Date(),
      bannedHeroes: [],
      pickedMaps: [],
      currentMapId: null,
      selectedMapType: null,
    },
    include: {
      actions: { orderBy: { order: "asc" } },
      match: true,
    },
  });
};

const determineFirstPicker = async (match) => {
  const competitiveTypes = ["PLAYOFFS", "SEMIFINALS", "FINALS"];

  if (competitiveTypes.includes(match.type)) {
    const [teamA, teamB] = await Promise.all([
      prisma.team.findUnique({ where: { id: match.teamAId } }),
      prisma.team.findUnique({ where: { id: match.teamBId } }),
    ]);

    if (!teamA || !teamB) return match.teamAId;

    if (Number.isInteger(teamA.playoffSeed) && Number.isInteger(teamB.playoffSeed)) {
      return teamA.playoffSeed < teamB.playoffSeed ? match.teamAId : match.teamBId;
    }

    if (teamA.victories !== teamB.victories) {
      return teamA.victories > teamB.victories ? match.teamAId : match.teamBId;
    }

    const teamADiff = teamA.mapWins - teamA.mapLoses;
    const teamBDiff = teamB.mapWins - teamB.mapLoses;

    if (teamADiff !== teamBDiff) {
      return teamADiff > teamBDiff ? match.teamAId : match.teamBId;
    }

    if (teamA.mapWins !== teamB.mapWins) {
      return teamA.mapWins > teamB.mapWins ? match.teamAId : match.teamBId;
    }

    return Math.random() < 0.5 ? match.teamAId : match.teamBId;
  }

  return Math.random() < 0.5 ? match.teamAId : match.teamBId;
};

const startMapPicking = async (draftId, user) => {
  ensureManagerRole(user);
  const draft = await getDraftByIdOrThrow(draftId);

  if (!["STARTING", "ENDMAP", "PLAYING"].includes(draft.phase)) {
    throw new Error("Draft must be in STARTING, ENDMAP, or PLAYING phase.");
  }

  if (draft.match.status === "FINISHED") {
    throw new Error("Match is finished.");
  }

  // Current game being played is gameNumber+1 (gameNumber = last completed)
  const currentGame = (draft.match.gameNumber || 0) + 1;

  let turnStarter;

  if (draft.phase === "STARTING" && draft.match.gameNumber === 0) {
    const validTeams = [draft.match.teamAId, draft.match.teamBId];
    turnStarter = validTeams.includes(draft.currentTurnTeamId)
      ? draft.currentTurnTeamId
      : await determineFirstPicker(draft.match);
  } else {
    const validTeams = [draft.match.teamAId, draft.match.teamBId];
    turnStarter = validTeams.includes(draft.currentTurnTeamId)
      ? draft.currentTurnTeamId
      : draft.match.teamAId;
  }

  return prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: draft.match.id },
      data: {
        status: "ACTIVE",
      },
    });

    const isFirstGame = currentGame === 1;

    return tx.draftTable.update({
      where: { id: draft.id },
      data: {
        phase: isFirstGame ? "MAPPICKING" : "MAPTYPEPICKING",
        currentTurnTeamId: turnStarter,
        currentMapId: null,
        selectedMapType: isFirstGame ? FIRST_GAME_MAP_TYPE : null,
        phaseStartedAt: new Date(Date.now() + PHASE_START_HOLD_MS),
      },
      include: {
        actions: { orderBy: { order: "asc" } },
        match: true,
      },
    });
  });
};

const pickMapType = async (draftId, payload, user) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Body is required.");
  }

  const mapType = String(payload.mapType || "").trim().toUpperCase();
  if (!mapType) {
    throw new Error("mapType is required.");
  }

  const currentDraft = await getDraftByIdOrThrow(draftId);
  const draft = await applyTimeoutIfNeeded(currentDraft);

  if (draft.phase !== "MAPTYPEPICKING") {
    throw new Error("Draft phase must be MAPTYPEPICKING.");
  }

  const actingTeamId = await resolveActingTeamId(user, payload.teamId, draft.match);
  if (draft.currentTurnTeamId && actingTeamId !== draft.currentTurnTeamId) {
    throw new Error("It is not your turn to pick the map type.");
  }

  const pickedMapIds = Array.isArray(draft.pickedMaps) ? draft.pickedMaps : [];
  const availableMapTypes = await getAvailableMapTypes({
    match: draft.match,
    pickedMapIds,
  });

  if (!availableMapTypes.includes(mapType)) {
    throw new Error(
      `Invalid map type. Available choices: ${availableMapTypes.join(", ") || "none"}.`
    );
  }

  return prisma.draftTable.update({
    where: { id: draft.id },
    data: {
      phase: "MAPPICKING",
      selectedMapType: mapType,
      currentTurnTeamId: actingTeamId,
      phaseStartedAt: new Date(Date.now() + PHASE_START_HOLD_MS),
    },
    include: {
      actions: { orderBy: { order: "asc" } },
      match: true,
    },
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

  const actingTeamId = await resolveActingTeamId(user, payload.teamId, draft.match);

  if (draft.currentTurnTeamId && actingTeamId !== draft.currentTurnTeamId) {
    throw new Error("It is not your turn to pick the map.");
  }

  const currentGame = (draft.match.gameNumber || 0) + 1;
  const selectedMapType =
    draft.selectedMapType || (currentGame === 1 ? FIRST_GAME_MAP_TYPE : null);

  if (!selectedMapType) {
    throw new Error("A map type must be selected before picking a map.");
  }

  const map = await prisma.map.findUnique({ where: { id: mapId } });
  if (!map) {
    throw new Error("Map not found.");
  }

  if (map.type !== selectedMapType) {
    throw new Error(
      `Invalid map type. ${selectedMapType} was selected for game ${currentGame}.`
    );
  }

  const pickedMapIds = Array.isArray(draft.pickedMaps) ? draft.pickedMaps : [];
  if (pickedMapIds.includes(mapId)) {
    throw new Error("Map already picked in this match.");
  }

  const availableMaps = await getAvailableMaps({
    match: draft.match,
    pickedMapIds,
    selectedMapType,
  });
  if (!availableMaps.some((availableMap) => availableMap.id === mapId)) {
    throw new Error("Map is not available in this match pool.");
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
        phaseStartedAt: new Date(Date.now() + ALERT_HOLD_MS),
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

  const currentGame = (draft.match.gameNumber || 0) + 1;
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
      phaseStartedAt: new Date(Date.now() + PHASE_START_HOLD_MS),
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

  const actingTeamId = await resolveActingTeamId(user, payload.teamId, draft.match);

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

    const currentGame = (freshDraft.match.gameNumber || 0) + 1;
    const bansThisGame = freshDraft.actions.filter(
      (a) => a.action === "BAN" && a.gameNumber === currentGame
    );

    const teamBansThisGame = bansThisGame.filter((a) => a.teamId === actingTeamId);
    if (teamBansThisGame.length >= 2) {
      throw new Error("Each team can ban at most 2 heroes.");
    }

    if (!hasNoBan && heroId !== null) {
      const alreadyBannedInGame = await tx.draftAction.findFirst({
        where: {
          draftId: freshDraft.id,
          action: "BAN",
          gameNumber: currentGame,
          value: heroId,
        },
      });

      if (alreadyBannedInGame) {
        throw new Error("Hero already banned in this game.");
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
        phase: totalBansAfter >= 4 ? "PLAYING" : "BAN",
        phaseStartedAt: new Date(Date.now() + ALERT_HOLD_MS),
      },
      include: {
        actions: { orderBy: { order: "asc" } },
        match: true,
      },
    });
  });
};

const endGame = async (draftId, user) => {
  ensureManagerRole(user);
  const draft = await getDraftByIdOrThrow(draftId);

  if (draft.phase !== "PLAYING") {
    throw new Error("Draft must be in PLAYING phase to end game.");
  }

  return prisma.draftTable.update({
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
};

const endMap = async (draftId, user) => {
  ensureManagerRole(user);
  const draft = await getDraftByIdOrThrow(draftId);

  if (draft.phase !== "BAN" && draft.phase !== "PLAYING") {
    throw new Error("Draft phase must be BAN or PLAYING to end map.");
  }

  return prisma.draftTable.update({
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
};

const yieldFirstPick = async (draftId, user) => {
  if (!user) {
    throw new Error("Only the higher-seeded captain can hand over first pick.");
  }

  const draft = await getDraftByIdOrThrow(draftId);
  const seasonPlayer = await resolveSeasonPlayer(user.id, draft.match.tournamentId);
  if (seasonPlayer?.role !== "CAPTAIN") {
    throw new Error("Only the higher-seeded captain can hand over first pick.");
  }
  if (
    !isBracketMatchType(draft.match.type) ||
    draft.match.gameNumber !== 0 ||
    draft.phase !== "STARTING"
  ) {
    throw new Error("First pick can only be handed over before game one of a playoff match.");
  }

  const teams = await prisma.team.findMany({
    where: { id: { in: [draft.match.teamAId, draft.match.teamBId] } },
    select: { id: true, playoffSeed: true },
  });
  if (teams.length !== 2 || teams.some((team) => !Number.isInteger(team.playoffSeed))) {
    throw new Error("Playoff seeds are missing for this match.");
  }

  const higherSeed = [...teams].sort((a, b) => a.playoffSeed - b.playoffSeed)[0];
  const captainTeamId = seasonPlayer.teamId;
  if (captainTeamId !== higherSeed.id || draft.currentTurnTeamId !== higherSeed.id) {
    throw new Error("Only the higher-seeded captain can hand over first pick.");
  }

  const updated = await prisma.draftTable.update({
    where: { id: draft.id },
    data: {
      currentTurnTeamId: getOtherTeamId(draft.match, higherSeed.id),
      phaseStartedAt: new Date(),
    },
    include: {
      match: true,
      actions: { orderBy: { order: "asc" } },
    },
  });
  return buildDraftState(updated);
};

const buildDraftState = async (draft) => {
  // Current game is gameNumber+1 (gameNumber = last completed, 0 at start)
  const gameNumber = (draft.match.gameNumber || 0) + 1;
  const pickedMapIds = Array.isArray(draft.pickedMaps) ? draft.pickedMaps : [];
  const selectedMapType =
    draft.selectedMapType || (gameNumber === 1 ? FIRST_GAME_MAP_TYPE : null);

  const [availableMapTypes, availableMaps, availableMapTypeCounts] = await Promise.all([
    getAvailableMapTypes({ match: draft.match, pickedMapIds }),
    getAvailableMaps({
      match: draft.match,
      pickedMapIds,
      selectedMapType,
    }),
    getAvailableMapTypeCounts({ match: draft.match, pickedMapIds }),
  ]);

  const allowedMapTypes = selectedMapType
    ? [selectedMapType]
    : availableMapTypes;

  const heroes = await prisma.hero.findMany({
    orderBy: { id: "asc" },
  });

  const allMaps = await prisma.map.findMany({
    orderBy: { id: "asc" },
  });

  // Compute server-side remaining seconds for the current turn so clients
  // don't have to trust their local clock. This accounts for manager pause.
  const TURN_SECONDS = Math.floor(TURN_TIMEOUT_MS / 1000);
  let remainingSeconds = TURN_SECONDS;
  if (draft && draft.phase && ["MAPTYPEPICKING", "MAPPICKING", "BAN"].includes(draft.phase)) {
    const phaseStart = draft.phaseStartedAt ? new Date(draft.phaseStartedAt).getTime() : Date.now();
    const referenceNow =
      draft.match && draft.match.mapTimerPaused && draft.match.mapTimerPausedAt
        ? new Date(draft.match.mapTimerPausedAt).getTime()
        : Date.now();
    const safePhaseStart = Math.min(phaseStart, referenceNow);
    const elapsed = Math.floor((referenceNow - safePhaseStart) / 1000);
    remainingSeconds = Math.max(0, TURN_SECONDS - elapsed);
  }

  return {
    ...draft,
    selectedMapType,
    allowedMapTypes,
    availableMapTypes,
    availableMapTypeCounts,
    availableMaps,
    allMaps,
    heroes: heroes.map((hero) => ({
      ...hero,
      name: hero.name || parseHeroNameFromImgPath(hero.imgPath),
    })),
    remainingSeconds,
  };
};

const isAuthorizedByUserOrKey = (req) => {
  if (req?.user) return true;
  const key = req?.query?.key || req?.headers?.["x-draft-key"];
  const expected = process.env.DRAFT_TABLE_MANAGER_KEY;
  return Boolean(key && expected && String(key) === String(expected));
};

// Draft state for polling. When the background worker is disabled, this applies
// elapsed timeouts on demand, so no process has to stay awake between drafts.
const getDraftStateReadOnly = async (draftId, req) => {
  if (!isAuthorizedByUserOrKey(req)) {
    throw new Error("Forbidden: provide login token or valid key.");
  }

  if (process.env.ENABLE_DRAFT_TIMEOUT_WORKER !== "true") {
    return getDraftState(draftId);
  }

  const draft = await getDraftByIdOrThrow(draftId);
  return buildDraftState(draft);
};

const getDraftState = async (draftId) => {
  const currentDraft = await getDraftByIdOrThrow(draftId);
  const draft = await applyTimeoutIfNeeded(currentDraft);
  return buildDraftState(draft);
};

const getDraftByMatchId = async (matchId, req) => {
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

  // Use getDraftState (not the read-only variant) so timeouts are applied
  // when clients poll the draft by match. This ensures auto-skip and
  // random map pick occur server-side instead of relying on clients.
  return getDraftState(draft.id);
};

const getDraftShareInfo = async (matchId, user) => {
  const parsedMatchId = assertPositiveInt(matchId, "matchId");
  if (!user) {
    throw new Error("Unauthorized.");
  }

  const draft = await prisma.draftTable.findUnique({
    where: { matchId: parsedMatchId },
    include: { match: true },
  });

  if (!draft) {
    throw new Error("Draft not found for this match.");
  }

  const isManager = hasManagerAccess(user);
  const seasonPlayer = await resolveSeasonPlayer(user.id, draft.match.tournamentId);
  const isMatchCaptain =
    seasonPlayer?.role === "CAPTAIN" &&
    (seasonPlayer.teamId === draft.match.teamAId || seasonPlayer.teamId === draft.match.teamBId);

  if (!isManager && !isMatchCaptain) {
    throw new Error("Forbidden: only match captains or managers can share this draft.");
  }

  const key = process.env.DRAFT_TABLE_MANAGER_KEY;
  if (!key) {
    throw new Error("DRAFT_TABLE_MANAGER_KEY is not configured.");
  }

  return {
    matchId: parsedMatchId,
    key,
  };
};

module.exports = {
  mapOrder,
  createDraft,
  startMapPicking,
  pickMapType,
  pickMap,
  startBan,
  banHero,
  endGame,
  endMap,
  getDraftState,
  getDraftStateReadOnly,
  getDraftByMatchId,
  getDraftShareInfo,
  yieldFirstPick,
  getAllowedMapTypes,
  getRoundKey,
  isBracketMatchType,
  determineFirstPicker,
  __testables: {
    resolveActingTeamId,
    parseAllAllowedMapIds,
    FIRST_GAME_MAP_TYPE,
    LOSER_PICKABLE_MAP_TYPES,
  },
};

// Background worker: periodically scan active drafts and apply timeouts server-side.
const startDraftTimeoutWorker = (intervalMs = 3000) => {
  setInterval(async () => {
    try {
      const activeDrafts = await prisma.draftTable.findMany({
        where: {
          phase: { in: ["MAPTYPEPICKING", "MAPPICKING", "BAN"] },
          currentTurnTeamId: { not: null },
        },
        include: { actions: { orderBy: { order: "asc" } }, match: true },
      });

      for (const d of activeDrafts) {
        try {
          // applyTimeoutIfNeeded will mutate DB if timeout elapsed
          await applyTimeoutIfNeeded(d);
        } catch (e) {
          console.error("Draft timeout worker error for draft", d.id, e?.message || e);
        }
      }
    } catch (err) {
      console.error("Draft timeout worker failed:", err?.message || err);
    }
  }, intervalMs);
};

module.exports.startDraftTimeoutWorker = startDraftTimeoutWorker;
