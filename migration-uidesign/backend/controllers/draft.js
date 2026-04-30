const prisma = require("../config/prisma");

const mapOrder = ["CONTROL", "HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"];
// Timer is 75 seconds per turn
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
    return ["CONTROL"];
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
  // Current game is gameNumber+1 (gameNumber is last completed game, 0 at start)
  const currentGame = (match.gameNumber || 0) + 1;
  const poolIds = parseAllowedMapPool(match.mapsAllowedByRound, currentGame);

  if (currentGame === 5) {
    return prisma.map.findMany({
      where: {
        id: { notIn: pickedMapIds },
      },
      orderBy: { id: "asc" },
    });
  }

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
  if (!["MAPPICKING", "BAN"].includes(draft.phase)) return draft;
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
        phase: totalBansAfter >= 4 ? "ENDMAP" : "BAN",
        currentTurnTeamId:
          totalBansAfter >= 4
            ? originalTurnTeamId
            : getOtherTeamId(fresh.match, originalTurnTeamId),
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
  const competitiveTypes = ["PLAYOFFS", "SEMIFINALS", "FINALS"];

  if (competitiveTypes.includes(match.type)) {
    const [teamA, teamB] = await Promise.all([
      prisma.team.findUnique({ where: { id: match.teamAId } }),
      prisma.team.findUnique({ where: { id: match.teamBId } }),
    ]);

    if (!teamA || !teamB) return match.teamAId;

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

  if (!["STARTING", "ENDMAP"].includes(draft.phase)) {
    throw new Error("Draft must be in STARTING or ENDMAP phase.");
  }

  if (draft.match.status === "FINISHED") {
    throw new Error("Match is finished.");
  }

  // Current game being played is gameNumber+1 (gameNumber = last completed)
  const currentGame = (draft.match.gameNumber || 0) + 1;

  let turnStarter;

  if (draft.phase === "STARTING" && draft.match.gameNumber === 0) {
    turnStarter = await determineFirstPicker(draft.match);
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

  const currentGame = (draft.match.gameNumber || 0) + 1;
  const allowedTypes = getAllowedMapTypes(currentGame);
  const poolIds = parseAllowedMapPool(draft.match.mapsAllowedByRound, currentGame);

  const map = await prisma.map.findUnique({ where: { id: mapId } });
  if (!map) {
    throw new Error("Map not found.");
  }

  if (currentGame !== 5 && poolIds && !poolIds.includes(mapId)) {
    throw new Error(`Map ${mapId} is not allowed for round ${getRoundKey(currentGame)}.`);
  }

  if (currentGame !== 5 && !poolIds && !allowedTypes.includes(map.type)) {
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

const buildDraftState = async (draft) => {
  // Current game is gameNumber+1 (gameNumber = last completed, 0 at start)
  const gameNumber = (draft.match.gameNumber || 0) + 1;
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

  // Compute server-side remaining seconds for the current turn so clients
  // don't have to trust their local clock. This accounts for manager pause.
  const TURN_SECONDS = Math.floor(TURN_TIMEOUT_MS / 1000);
  let remainingSeconds = TURN_SECONDS;
  if (draft && draft.phase && ["MAPPICKING", "BAN"].includes(draft.phase)) {
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
    allowedMapTypes: allowedTypesFromPool,
    availableMaps,
    allMaps,
    heroes: heroes.map((hero) => ({
      ...hero,
      name: hero.name || parseHeroNameFromImgPath(hero.imgPath),
    })),
    remainingSeconds,
  };
};

// Helper to authorize manager role or URL key
const isAuthorizedByManagerOrKey = (req) => {
  if (!req) return false;
  if (req.user && (req.user.role === "MANAGER" || req.user.role === "ADMIN")) return true;
  const key = (req.query && req.query.key) || req.headers["x-draft-key"];
  const expected = process.env.DRAFT_TABLE_MANAGER_KEY;
  return key && expected && String(key) === String(expected);
};

// Read-only draft state for polling: does NOT apply timeouts or mutate DB.
const getDraftStateReadOnly = async (draftId, req) => {
  if (!isAuthorizedByManagerOrKey(req)) {
    throw new Error("Forbidden: managers only or provide valid key.");
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

  return getDraftStateReadOnly(draft.id, req);
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
  getDraftStateReadOnly,
  getDraftByMatchId,
};
