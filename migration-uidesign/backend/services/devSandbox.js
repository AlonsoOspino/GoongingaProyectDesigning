/*
 * Developer sandbox.
 *
 * A real season, real teams and real matches that the live site cannot see.
 * Everything the draft touches — standings, map pools, results — is written to
 * rows that belong to this sandbox, so a test match exercises the production
 * code paths without moving a single number that anybody cares about.
 *
 * Two properties keep it invisible:
 *
 *   state FINISHED    tournamentRepo.findActive() only looks at non-FINISHED
 *                     seasons, so the sandbox can never become "the current
 *                     season" for the public site.
 *   startDate 1990    findMostRecent() orders by startDate descending, so even
 *                     when every real season is finished the sandbox loses.
 *
 * Change either of those and the sandbox starts leaking into production.
 */

const prisma = require("../config/prisma");
const matchService = require("./match");

const SANDBOX_TOURNAMENT_NAME = "Developer Sandbox";
// Deliberately older than any real season. See the note above.
const SANDBOX_START_DATE = new Date("1990-01-01T00:00:00.000Z");

const SANDBOX_TEAMS = [
  { name: "Sandbox Alpha", key: "A" },
  { name: "Sandbox Beta", key: "B" },
];

/*
 * Which map types each round of a best-of-five draws from. This mirrors the
 * columns the wincards overlay expects, so a sandbox match renders on the real
 * broadcast graphics instead of looking like a special case.
 */
const ROUND_TYPES = {
  1: ["CONTROL"],
  2: ["HYBRID"],
  3: ["PAYLOAD"],
  4: ["PUSH", "FLASHPOINT"],
  5: ["CONTROL"],
};

const MAPS_PER_ROUND = 2;

const isSandboxTournament = (tournament) =>
  Boolean(tournament) && tournament.name === SANDBOX_TOURNAMENT_NAME;

const findSandboxTournament = () =>
  prisma.tournament.findFirst({ where: { name: SANDBOX_TOURNAMENT_NAME } });

/**
 * Find or create the sandbox season and its two teams. Safe to call on every
 * request: it never duplicates and never touches a real tournament.
 */
const ensureSandbox = async () => {
  let tournament = await findSandboxTournament();

  if (!tournament) {
    tournament = await prisma.tournament.create({
      data: {
        name: SANDBOX_TOURNAMENT_NAME,
        startDate: SANDBOX_START_DATE,
        state: "FINISHED",
      },
    });
  } else if (tournament.state !== "FINISHED") {
    // Somebody, or some earlier bug, made the sandbox look live. Put it back
    // before the public site starts reading it as the current season.
    tournament = await prisma.tournament.update({
      where: { id: tournament.id },
      data: { state: "FINISHED", startDate: SANDBOX_START_DATE },
    });
  }

  const existingTeams = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { id: "asc" },
  });

  const teams = [];
  for (const definition of SANDBOX_TEAMS) {
    const found = existingTeams.find((team) => team.name === definition.name);
    if (found) {
      teams.push(found);
      continue;
    }
    teams.push(
      await prisma.team.create({
        data: { name: definition.name, tournamentId: tournament.id },
      })
    );
  }

  return { tournament, teamA: teams[0], teamB: teams[1] };
};

const pickSome = (items, count) => {
  const pool = [...items];
  const chosen = [];
  while (pool.length > 0 && chosen.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    chosen.push(pool.splice(index, 1)[0]);
  }
  return chosen;
};

/**
 * Build a week's map pool shaped like a real one: each round drawn from the
 * types that round is allowed to use.
 */
const buildMapPool = async () => {
  const maps = await prisma.map.findMany();
  if (maps.length === 0) {
    throw new Error("No maps exist yet, so a sandbox match would have nothing to draft.");
  }

  const pool = {};
  for (const [round, types] of Object.entries(ROUND_TYPES)) {
    const candidates = maps.filter((map) => types.includes(map.type));
    pool[round] = pickSome(candidates, MAPS_PER_ROUND).map((map) => map.id);
  }

  return pool;
};

/**
 * Round robin matches are unique per week and team pair, so each sandbox match
 * takes the next free week rather than colliding with the previous one.
 */
const nextFreeWeek = async (tournamentId) => {
  const latest = await prisma.match.findFirst({
    where: { tournamentId },
    orderBy: { semanas: "desc" },
    select: { semanas: true },
  });
  return (latest?.semanas || 0) + 1;
};

const listSandboxMatches = async () => {
  const tournament = await findSandboxTournament();
  if (!tournament) return [];

  return prisma.match.findMany({
    where: { tournamentId: tournament.id },
    include: { draft: { select: { id: true, phase: true, currentTurnTeamId: true } } },
    orderBy: { id: "desc" },
  });
};

const getSandboxMatch = async (matchId) => {
  const tournament = await findSandboxTournament();
  if (!tournament) return null;

  const match = await prisma.match.findUnique({ where: { id: Number(matchId) } });
  if (!match || match.tournamentId !== tournament.id) return null;
  return match;
};

/**
 * Create a real match plus its real draft inside the sandbox. The draft is
 * created through the normal draft controller so the row is indistinguishable
 * from one a manager would open.
 */
const createSandboxMatch = async ({ bestOf = 5 } = {}) => {
  const draftController = require("../controllers/draft");
  const { tournament, teamA, teamB } = await ensureSandbox();

  const [mapsAllowedByRound, semanas] = await Promise.all([
    buildMapPool(),
    nextFreeWeek(tournament.id),
  ]);

  const match = await matchService.create({
    type: "ROUNDROBIN",
    bestOf,
    tournamentId: tournament.id,
    teamAId: teamA.id,
    teamBId: teamB.id,
    startDate: new Date(),
    semanas,
    mapsAllowedByRound,
  });

  // The synthetic operator the sandbox acts as. It is never a season player, so
  // resolveActingTeamId falls through to the manager branch and lets it play
  // either side.
  const draft = await draftController.createDraft(match.id, {
    id: 0,
    roles: ["ADMIN"],
  });

  return { match, draft, tournament, teamA, teamB };
};

/**
 * Remove one sandbox match and everything hanging off it. Refuses anything that
 * is not in the sandbox, so a wrong id cannot delete a real match.
 */
const deleteSandboxMatch = async (matchId) => {
  const match = await getSandboxMatch(matchId);
  if (!match) {
    throw new Error("That match is not part of the developer sandbox.");
  }

  return prisma.$transaction(async (tx) => {
    const draft = await tx.draftTable.findUnique({ where: { matchId: match.id } });
    if (draft) {
      await tx.draftAction.deleteMany({ where: { draftId: draft.id } });
      await tx.draftTable.delete({ where: { id: draft.id } });
    }
    await tx.playerStat.deleteMany({ where: { matchId: match.id } });
    await tx.match.delete({ where: { id: match.id } });
    return { deletedMatchId: match.id };
  });
};

module.exports = {
  SANDBOX_TOURNAMENT_NAME,
  SANDBOX_START_DATE,
  ensureSandbox,
  findSandboxTournament,
  isSandboxTournament,
  createSandboxMatch,
  listSandboxMatches,
  getSandboxMatch,
  deleteSandboxMatch,
  __testables: { buildMapPool, pickSome, ROUND_TYPES },
};
