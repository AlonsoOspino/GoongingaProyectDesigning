const prisma = require("../config/prisma");
const mapService = require("./map");
const heroService = require("./hero");
const { normalizeOverlayFocus } = require("../utils/overlayFocus");
const {
  DEV_DRAFT_TOURNAMENT_NAME,
  DEV_DRAFT_MATCH_TITLE,
  DEV_DRAFT_START_DATE,
  isDevMatchReference,
} = require("../utils/devDraftApp");

const MATCH_INCLUDE = {
  teamA: true,
  teamB: true,
  draft: {
    include: {
      actions: { orderBy: { order: "asc" } },
    },
  },
};

const parsePositiveInt = (value, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
};

const normalizeTeamInput = (payload) => {
  const name = String(payload?.name || "").trim();
  const logo = String(payload?.logo || "").trim();
  if (!name) throw new Error("Team name is required.");
  if (name.length > 60) throw new Error("Team name must be 60 characters or fewer.");
  if (!logo) throw new Error("Team logo is required.");
  if (logo.length > 2048) throw new Error("Team logo URL is too long.");
  if (!/^https?:\/\//i.test(logo) && !logo.startsWith("/")) {
    throw new Error("Team logo must be an absolute URL or public path.");
  }
  return { name, logo };
};

const normalizeMapIds = (value) => {
  if (!Array.isArray(value)) throw new Error("mapIds must be an array.");
  const mapIds = [...new Set(value.map(Number))];
  if (!mapIds.length || mapIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error("Select at least one valid map.");
  }
  return mapIds;
};

const normalizeBanIds = (value, label) => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const ids = value
    .filter((id) => id !== null && id !== undefined && id !== "")
    .map((id) => parsePositiveInt(id, "heroId"));
  if (ids.length > 2) throw new Error(`${label} can contain at most two heroes.`);
  return ids;
};

const findTournament = (client = prisma) =>
  client.tournament.findFirst({ where: { name: DEV_DRAFT_TOURNAMENT_NAME } });

const ensureTournament = async (client = prisma) => {
  const existing = await findTournament(client);
  if (!existing) {
    return client.tournament.create({
      data: {
        name: DEV_DRAFT_TOURNAMENT_NAME,
        startDate: DEV_DRAFT_START_DATE,
        state: "FINISHED",
      },
    });
  }
  if (
    existing.state !== "FINISHED" ||
    existing.startDate.toISOString() !== DEV_DRAFT_START_DATE.toISOString()
  ) {
    return client.tournament.update({
      where: { id: existing.id },
      data: { state: "FINISHED", startDate: DEV_DRAFT_START_DATE },
    });
  }
  return existing;
};

const findMatch = async (client = prisma) => {
  const tournament = await findTournament(client);
  if (!tournament) return null;
  return client.match.findFirst({
    where: {
      tournamentId: tournament.id,
      title: DEV_DRAFT_MATCH_TITLE,
    },
    include: MATCH_INCLUDE,
    orderBy: { id: "desc" },
  });
};

const getMatch = async () => findMatch();

const resolveMatchReference = async (value) => {
  if (!isDevMatchReference(value)) return parsePositiveInt(value, "matchId");
  const match = await findMatch();
  if (!match) throw new Error("Developer match not found.");
  return match.id;
};

const getBans = (match) => {
  const result = { teamA: [], teamB: [] };
  if (!match?.draft) return result;
  const currentGame = (match.gameNumber || 0) + 1;
  for (const action of match.draft.actions || []) {
    if (action.action !== "BAN" || action.gameNumber !== currentGame || !action.value) continue;
    if (action.teamId === match.teamAId && result.teamA.length < 2) result.teamA.push(action.value);
    if (action.teamId === match.teamBId && result.teamB.length < 2) result.teamB.push(action.value);
  }
  return result;
};

const getState = async () => {
  const tournament = await ensureTournament();
  const [teams, maps, heroes, match] = await Promise.all([
    prisma.team.findMany({ where: { tournamentId: tournament.id }, orderBy: { id: "asc" } }),
    mapService.getAll(),
    heroService.getAll(),
    prisma.match.findFirst({
      where: { tournamentId: tournament.id, title: DEV_DRAFT_MATCH_TITLE },
      include: MATCH_INCLUDE,
      orderBy: { id: "desc" },
    }),
  ]);
  return { teams, maps, heroes, match, bans: getBans(match) };
};

const createTeam = async (payload) => {
  const tournament = await ensureTournament();
  const data = normalizeTeamInput(payload);
  const existing = await prisma.team.findFirst({
    where: {
      tournamentId: tournament.id,
      name: { equals: data.name, mode: "insensitive" },
    },
  });
  if (existing) throw new Error("A developer team with that name already exists.");
  await prisma.team.create({ data: { ...data, tournamentId: tournament.id } });
  return getState();
};

const deleteTeam = async (teamId) => {
  const id = parsePositiveInt(teamId, "teamId");
  const tournament = await findTournament();
  if (!tournament) throw new Error("Developer team not found.");
  const team = await prisma.team.findFirst({ where: { id, tournamentId: tournament.id } });
  if (!team) throw new Error("Developer team not found.");
  const references = await prisma.match.count({
    where: { tournamentId: tournament.id, OR: [{ teamAId: id }, { teamBId: id }] },
  });
  if (references > 0) throw new Error("Delete the developer match before deleting this team.");
  await prisma.team.delete({ where: { id } });
  return getState();
};

const createMatch = async (payload) => {
  const teamAId = parsePositiveInt(payload?.teamAId, "teamAId");
  const teamBId = parsePositiveInt(payload?.teamBId, "teamBId");
  if (teamAId === teamBId) throw new Error("Choose two different teams.");
  const mapIds = normalizeMapIds(payload?.mapIds);
  const tournament = await ensureTournament();

  const existing = await findMatch();
  if (existing) throw new Error("A developer match already exists.");

  const [teams, maps] = await Promise.all([
    prisma.team.findMany({
      where: { id: { in: [teamAId, teamBId] }, tournamentId: tournament.id },
      select: { id: true },
    }),
    prisma.map.findMany({ where: { id: { in: mapIds } }, select: { id: true } }),
  ]);
  if (teams.length !== 2) throw new Error("Both teams must come from the developer pool.");
  if (maps.length !== mapIds.length) throw new Error("One or more selected maps do not exist.");

  const mapsAllowedByRound = Object.fromEntries(
    Array.from({ length: 5 }, (_, index) => [String(index + 1), mapIds])
  );

  await prisma.$transaction(async (tx) => {
    const match = await tx.match.create({
      data: {
        type: "PRACTICE",
        title: DEV_DRAFT_MATCH_TITLE,
        bestOf: 5,
        status: "SCHEDULED",
        tournamentId: tournament.id,
        teamAId,
        teamBId,
        semanas: 1,
        mapsAllowedByRound,
        allowedMaps: { connect: mapIds.map((id) => ({ id })) },
      },
    });
    await tx.draftTable.create({
      data: {
        matchId: match.id,
        currentTurnTeamId: teamAId,
        phase: "STARTING",
        phaseStartedAt: new Date(),
        bannedHeroes: [],
        pickedMaps: [],
        currentMapId: null,
        selectedMapType: null,
      },
    });
  });

  return getState();
};

const deleteMatch = async () => {
  const match = await findMatch();
  if (!match) throw new Error("Developer match not found.");
  await prisma.$transaction(async (tx) => {
    if (match.draft) {
      await tx.draftAction.deleteMany({ where: { draftId: match.draft.id } });
      await tx.draftTable.delete({ where: { id: match.draft.id } });
    }
    await tx.playerStat.deleteMany({ where: { matchId: match.id } });
    await tx.leaderboardOverlayAsset.deleteMany({ where: { matchId: match.id } });
    await tx.match.delete({ where: { id: match.id } });
  });
  return getState();
};

const setOverlayFocus = async (payload) => {
  const match = await findMatch();
  if (!match) throw new Error("Developer match not found.");
  const focus = normalizeOverlayFocus(payload);
  const poolIds = new Set(
    Object.values(match.mapsAllowedByRound || {})
      .flatMap((value) => (Array.isArray(value) ? value : []))
      .map(Number)
  );
  if (focus.overlayFocusMapId) {
    if (!poolIds.has(focus.overlayFocusMapId)) {
      throw new Error("Focused map is not part of the developer map pool.");
    }
    const map = await prisma.map.findUnique({ where: { id: focus.overlayFocusMapId } });
    if (!map || map.type !== focus.overlayFocusType) {
      throw new Error("Focused map and map type do not match.");
    }
  }
  await prisma.match.update({ where: { id: match.id }, data: focus });
  return getState();
};

const setBans = async (payload) => {
  const teamABans = normalizeBanIds(payload?.teamABans, "teamABans");
  const teamBBans = normalizeBanIds(payload?.teamBBans, "teamBBans");
  const allIds = [...teamABans, ...teamBBans];
  if (new Set(allIds).size !== allIds.length) {
    throw new Error("A hero can only be banned once.");
  }
  const match = await findMatch();
  if (!match?.draft) throw new Error("Developer draft not found.");
  const heroes = allIds.length
    ? await prisma.hero.findMany({ where: { id: { in: allIds } }, select: { id: true, role: true } })
    : [];
  if (heroes.length !== allIds.length) throw new Error("One or more selected heroes do not exist.");
  const roleCounts = heroes.reduce(
    (counts, hero) => ({ ...counts, [hero.role]: counts[hero.role] + 1 }),
    { TANK: 0, DPS: 0, SUPPORT: 0 }
  );
  if (Object.values(roleCounts).some((count) => count > 2)) {
    throw new Error("No more than two heroes from the same role can be banned.");
  }

  const currentGame = (match.gameNumber || 0) + 1;
  await prisma.$transaction(async (tx) => {
    await tx.draftAction.deleteMany({
      where: { draftId: match.draft.id, action: "BAN", gameNumber: currentGame },
    });
    const existingActions = await tx.draftAction.findMany({
      where: { draftId: match.draft.id },
      select: { order: true },
      orderBy: { order: "desc" },
      take: 1,
    });
    let order = (existingActions[0]?.order || 0) + 1;
    for (const [teamId, ids] of [
      [match.teamAId, teamABans],
      [match.teamBId, teamBBans],
    ]) {
      for (const heroId of ids) {
        await tx.draftAction.create({
          data: {
            draftId: match.draft.id,
            teamId,
            action: "BAN",
            value: heroId,
            gameNumber: currentGame,
            order,
          },
        });
        order += 1;
      }
    }
    await tx.draftTable.update({
      where: { id: match.draft.id },
      data: { bannedHeroes: allIds },
    });
  });
  return getState();
};

module.exports = {
  getState,
  getMatch,
  resolveMatchReference,
  createTeam,
  deleteTeam,
  createMatch,
  deleteMatch,
  setOverlayFocus,
  setBans,
  __testables: { normalizeTeamInput, normalizeMapIds, normalizeBanIds },
};
