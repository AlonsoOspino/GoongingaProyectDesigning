const matchRepo = require("../repositories/match");
const tournamentRepo = require("../repositories/tournament");

const parsePositiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return parsed;
};

const normalizeMatchType = (value) => String(value || "").trim().toUpperCase();

const ensureDistinctTeams = (teamAId, teamBId) => {
  const parsedTeamAId = parsePositiveInt(teamAId, "teamAId");
  const parsedTeamBId = parsePositiveInt(teamBId, "teamBId");

  if (parsedTeamAId === parsedTeamBId) {
    throw new Error("teamAId and teamBId must be different.");
  }

  return { parsedTeamAId, parsedTeamBId };
};

const ensureNoRoundRobinWeekConflict = async ({
  tournamentId,
  semanas,
  teamAId,
  teamBId,
  excludeMatchId,
}) => {
  const parsedTournamentId = parsePositiveInt(tournamentId, "tournamentId");
  const parsedWeek = parsePositiveInt(semanas, "semanas");
  const { parsedTeamAId, parsedTeamBId } = ensureDistinctTeams(teamAId, teamBId);

  const where = {
    tournamentId: parsedTournamentId,
    type: "ROUNDROBIN",
    semanas: parsedWeek,
    OR: [
      { teamAId: parsedTeamAId },
      { teamBId: parsedTeamAId },
      { teamAId: parsedTeamBId },
      { teamBId: parsedTeamBId },
    ],
  };

  if (excludeMatchId !== undefined && excludeMatchId !== null) {
    where.NOT = { id: Number(excludeMatchId) };
  }

  const conflicts = await matchRepo.findAll({
    where,
    select: { id: true, teamAId: true, teamBId: true },
    take: 1,
  });

  if (conflicts.length > 0) {
    throw new Error(
      `Round robin week conflict: one of these teams is already scheduled in week ${parsedWeek}.`
    );
  }
};

const validateRoundRobinWeekRules = async ({ type, tournamentId, semanas }) => {
  const normalizedTournamentId = parsePositiveInt(tournamentId, "tournamentId");
  const tournament = await tournamentRepo.findById(normalizedTournamentId);

  if (!tournament) {
    throw new Error("Tournament not found.");
  }

  const normalizedType = normalizeMatchType(type);
  const isRoundRobinType = normalizedType === "ROUNDROBIN";
  const isRoundRobinState = tournament.state === "ROUNDROBIN";

  if (isRoundRobinState && !isRoundRobinType) {
    throw new Error("When tournament state is ROUNDROBIN, match type must be ROUNDROBIN.");
  }

  if (isRoundRobinType) {
    return parsePositiveInt(semanas, "semanas");
  }

  return semanas === undefined ? undefined : parsePositiveInt(semanas, "semanas");
};

const getById = async (id) => {
  return await matchRepo.findById(id);
};

const getAll = async () => {
  return await matchRepo.findAll();
};
const create = async (data) => {
  const normalizedData = { ...data };
  normalizedData.semanas = await validateRoundRobinWeekRules({
    type: normalizedData.type,
    tournamentId: normalizedData.tournamentId,
    semanas: normalizedData.semanas,
  });

  if (normalizedData.semanas === undefined) {
    normalizedData.semanas = 1;
  }

  if (normalizeMatchType(normalizedData.type) === "ROUNDROBIN") {
    await ensureNoRoundRobinWeekConflict({
      tournamentId: normalizedData.tournamentId,
      semanas: normalizedData.semanas,
      teamAId: normalizedData.teamAId,
      teamBId: normalizedData.teamBId,
    });
  }

  return await matchRepo.create(normalizedData);
}   
const update = async (id, data) => {
  const existing = await matchRepo.findById(id);
  if (!existing) {
    throw new Error("Match not found.");
  }

  const normalizedData = { ...data };
  const nextType = normalizedData.type ?? existing.type;
  const nextTournamentId = normalizedData.tournamentId ?? existing.tournamentId;
  const nextSemanas = normalizedData.semanas ?? existing.semanas;
  const nextTeamAId = normalizedData.teamAId ?? existing.teamAId;
  const nextTeamBId = normalizedData.teamBId ?? existing.teamBId;

  const validatedWeek = await validateRoundRobinWeekRules({
    type: nextType,
    tournamentId: nextTournamentId,
    semanas: nextSemanas,
  });

  if (validatedWeek !== undefined) {
    normalizedData.semanas = validatedWeek;
  }

  if (normalizeMatchType(nextType) === "ROUNDROBIN") {
    await ensureNoRoundRobinWeekConflict({
      tournamentId: nextTournamentId,
      semanas: validatedWeek,
      teamAId: nextTeamAId,
      teamBId: nextTeamBId,
      excludeMatchId: id,
    });
  }

  return await matchRepo.update(id, normalizedData);
}
const remove = async (id) => {
  return await matchRepo.remove(id);
}
const generateRoundRobin = async ({ tournamentId, confirmationText }) => {
  const parsedTournamentId = Number(tournamentId);
  if (!Number.isInteger(parsedTournamentId) || parsedTournamentId <= 0) {
    throw new Error("tournamentId must be a positive integer.");
  }

  const tournament = await tournamentRepo.findById(parsedTournamentId);
  if (!tournament) {
    throw new Error("Tournament not found.");
  }
  if (tournament.state !== "ROUNDROBIN") {
    throw new Error("Round robin matches can only be generated when tournament state is ROUNDROBIN.");
  }

  if (String(confirmationText || "").trim() !== "CONFIRM ROUND ROBIN") {
    throw new Error("confirmationText must be exactly: CONFIRM ROUND ROBIN");
  }

  const existingRoundRobin = await matchRepo.findAll({
    where: {
      tournamentId: parsedTournamentId,
      type: "ROUNDROBIN",
    },
    select: { id: true },
    take: 1,
  });

  if (existingRoundRobin.length > 0) {
    throw new Error(
      "This tournament already has round robin matches. Delete existing round robin matches before generating again."
    );
  }

  return await matchRepo.generateRoundRobin(parsedTournamentId);
}
const submitResult = async (id, winnerTeamId) => {
  const normalizedWinnerTeamId =
    winnerTeamId === null || winnerTeamId === undefined ? null : Number(winnerTeamId);
  return await matchRepo.submitResult(id, normalizedWinnerTeamId);
}
const findSoonest = async () => {
  return await matchRepo.findSoonest();
}
const getActiveMatches = async () => {
  const now = new Date();
  return await matchRepo.findAll({
    where: {
      status: "ACTIVE",
    }
  });
} 

const finishPendingRegisters = async (id) => {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new Error("id must be a positive integer.");
  }
  return matchRepo.finishPendingRegisters(parsedId);
};

module.exports = {
  getById,
  getAll,
  remove,
  generateRoundRobin,
  submitResult,
  update,
  create,
  findSoonest,
  getActiveMatches,
  finishPendingRegisters
};
