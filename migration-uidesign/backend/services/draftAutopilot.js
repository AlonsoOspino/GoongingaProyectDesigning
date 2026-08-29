/*
 * Draft autopilot.
 *
 * Stand-in captains for sandbox matches. This is not a simulation: every step
 * calls the same controller function a real captain's click would, with a
 * synthetic operator that resolveActingTeamId lets play either side. Turn
 * order, available map types, already-picked maps, ban role limits and the
 * two-bans-per-team rule are all enforced by the real code, so a draft the
 * autopilot finishes is a draft the league rules allowed.
 *
 * It only ever loads matches that belong to the developer sandbox season.
 */

const prisma = require("../config/prisma");
const draftController = require("../controllers/draft");
const matchService = require("./match");
const devSandbox = require("./devSandbox");

const DEFAULT_TICK_MS = 3000;
const MAX_BANS_PER_TEAM = 2;
const MAX_BANS_PER_ROLE = 2;

// The operator the autopilot acts as. It is not a season player in the sandbox
// tournament, so resolveActingTeamId takes the manager branch and honours the
// teamId the autopilot passes for whichever side is on turn.
const AUTOPILOT_USER = Object.freeze({ id: 0, roles: ["ADMIN"] });

/**
 * The one legal move available from this draft state.
 *
 * Pure on purpose: the whole state machine is decided here and tested without a
 * database, while the executor below only knows how to perform a named step.
 */
const decideNextStep = ({
  phase,
  matchStatus,
  teamAready,
  teamBready,
  hasPickThisGame,
} = {}) => {
  if (matchStatus === "FINISHED" || phase === "FINISHED") return "IDLE";

  switch (phase) {
    case "STARTING":
      return teamAready === 1 && teamBready === 1 ? "START_MAP_PICKING" : "READY_UP";
    case "MAPTYPEPICKING":
      return "PICK_MAP_TYPE";
    case "MAPPICKING":
      return hasPickThisGame ? "START_BAN" : "PICK_MAP";
    case "BAN":
      return "BAN_HERO";
    case "PLAYING":
      return "END_MAP";
    case "ENDMAP":
      return "SUBMIT_RESULT";
    default:
      return "IDLE";
  }
};

const randomOf = (items) => items[Math.floor(Math.random() * items.length)];

/**
 * A hero this team may still ban: not already gone this game, and not a third
 * ban of its role. Mirrors the checks in banHero so the autopilot asks for
 * something the controller will accept.
 */
const chooseBannableHero = async (draft, currentGame) => {
  const bansThisGame = draft.actions.filter(
    (action) => action.action === "BAN" && action.gameNumber === currentGame
  );

  const bannedIds = bansThisGame
    .map((action) => action.value)
    .filter((value) => Number.isInteger(value));

  const [heroes, bannedHeroes] = await Promise.all([
    prisma.hero.findMany(),
    bannedIds.length ? prisma.hero.findMany({ where: { id: { in: bannedIds } } }) : [],
  ]);

  const roleCounts = bannedHeroes.reduce(
    (acc, hero) => {
      acc[hero.role] = (acc[hero.role] || 0) + 1;
      return acc;
    },
    { TANK: 0, DPS: 0, SUPPORT: 0 }
  );

  const legal = heroes.filter(
    (hero) =>
      !bannedIds.includes(hero.id) && (roleCounts[hero.role] || 0) < MAX_BANS_PER_ROLE
  );

  return legal.length > 0 ? randomOf(legal) : null;
};

const teamOnTurn = (draft) =>
  draft.currentTurnTeamId || draft.match.teamAId;

/**
 * Perform one step for one draft. Returns what it did, so the caller can log a
 * readable trace of the match rather than a wall of state dumps.
 */
const advanceDraft = async (draft) => {
  const currentGame = (draft.match.gameNumber || 0) + 1;
  const hasPickThisGame = draft.actions.some(
    (action) => action.action === "PICK" && action.gameNumber === currentGame
  );

  const step = decideNextStep({
    phase: draft.phase,
    matchStatus: draft.match.status,
    teamAready: draft.match.teamAready,
    teamBready: draft.match.teamBready,
    hasPickThisGame,
  });

  switch (step) {
    case "READY_UP": {
      // Both stand-in captains check in at once. There is nobody to wait for.
      await prisma.match.update({
        where: { id: draft.match.id },
        data: { teamAready: 1, teamBready: 1 },
      });
      return { step, detail: "both captains ready" };
    }

    case "START_MAP_PICKING": {
      await draftController.startMapPicking(draft.id, AUTOPILOT_USER);
      return { step, detail: `game ${currentGame} opened` };
    }

    case "PICK_MAP_TYPE": {
      const pickedMapIds = Array.isArray(draft.pickedMaps) ? draft.pickedMaps : [];
      const availableTypes = await draftController.getAvailableMapTypes({
        match: draft.match,
        pickedMapIds,
      });

      if (availableTypes.length === 0) {
        return { step: "IDLE", detail: "no map type left to pick" };
      }

      const mapType = randomOf(availableTypes);
      await draftController.pickMapType(
        draft.id,
        { mapType, teamId: teamOnTurn(draft) },
        AUTOPILOT_USER
      );
      return { step, detail: mapType };
    }

    case "PICK_MAP": {
      const pickedMapIds = Array.isArray(draft.pickedMaps) ? draft.pickedMaps : [];
      const available = await draftController.getAvailableMaps({
        match: draft.match,
        pickedMapIds,
        selectedMapType: draft.selectedMapType,
      });

      if (available.length === 0) {
        return { step: "IDLE", detail: "no map left to pick" };
      }

      const map = randomOf(available);
      await draftController.pickMap(
        draft.id,
        { mapId: map.id, teamId: teamOnTurn(draft) },
        AUTOPILOT_USER
      );
      return { step, detail: map.description };
    }

    case "START_BAN": {
      await draftController.startBan(draft.id, AUTOPILOT_USER);
      return { step, detail: "bans open" };
    }

    case "BAN_HERO": {
      const hero = await chooseBannableHero(draft, currentGame);
      await draftController.banHero(
        draft.id,
        { heroId: hero ? hero.id : null, teamId: teamOnTurn(draft) },
        AUTOPILOT_USER
      );
      return { step, detail: hero ? hero.name || `hero ${hero.id}` : "no ban" };
    }

    case "END_MAP": {
      await draftController.endMap(draft.id, AUTOPILOT_USER);
      return { step, detail: "map ended" };
    }

    case "SUBMIT_RESULT": {
      const winnerTeamId = randomOf([draft.match.teamAId, draft.match.teamBId]);
      await matchService.submitResult(draft.match.id, winnerTeamId);
      return { step, detail: `team ${winnerTeamId} won game ${currentGame}` };
    }

    default:
      return { step: "IDLE", detail: draft.phase };
  }
};

/**
 * Advance every unfinished sandbox draft by one step. Scoped by tournament, so
 * it is structurally incapable of touching a real match.
 */
const tick = async () => {
  const tournament = await devSandbox.findSandboxTournament();
  if (!tournament) return [];

  const drafts = await prisma.draftTable.findMany({
    where: {
      match: {
        tournamentId: tournament.id,
        status: { not: "FINISHED" },
      },
    },
    include: {
      match: true,
      actions: { orderBy: { order: "asc" } },
    },
  });

  const results = [];
  for (const draft of drafts) {
    try {
      const outcome = await advanceDraft(draft);
      results.push({ matchId: draft.matchId, ...outcome });
    } catch (error) {
      // One stuck draft must not stop the others. The message is kept so the
      // dev panel can show why a match stopped moving.
      results.push({
        matchId: draft.matchId,
        step: "ERROR",
        detail: error?.message || "autopilot step failed",
      });
    }
  }

  return results;
};

let timer = null;
let lastResults = [];
let running = false;

const isRunning = () => timer !== null;

const getLastResults = () => lastResults;

const start = (tickMs = DEFAULT_TICK_MS) => {
  if (timer) return false;

  const interval = Number(tickMs);
  const safeInterval = Number.isFinite(interval) && interval >= 500 ? interval : DEFAULT_TICK_MS;

  timer = setInterval(() => {
    // Skip a beat rather than stacking ticks if a step runs long.
    if (running) return;
    running = true;
    tick()
      .then((results) => {
        if (results.length > 0) lastResults = results;
      })
      .catch((error) => {
        console.error("[draftAutopilot] tick failed:", error);
      })
      .finally(() => {
        running = false;
      });
  }, safeInterval);

  // Never hold the process open just for the sandbox.
  if (typeof timer.unref === "function") timer.unref();
  return true;
};

const stop = () => {
  if (!timer) return false;
  clearInterval(timer);
  timer = null;
  return true;
};

module.exports = {
  DEFAULT_TICK_MS,
  AUTOPILOT_USER,
  advanceDraft,
  tick,
  start,
  stop,
  isRunning,
  getLastResults,
  __testables: { decideNextStep, chooseBannableHero, MAX_BANS_PER_TEAM },
};
