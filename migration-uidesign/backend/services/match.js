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

const ALLOWED_MATCH_TYPES_BY_STATE = {
  ROUNDROBIN: ["ROUNDROBIN"],
  PLAYOFFS: ["PLAYINS", "PLAYOFFS"],
  SEMIFINALS: ["SEMIFINALS"],
  FINALS: ["FINALS"],
};

const getAllowedMatchTypesForState = (state) =>
  ALLOWED_MATCH_TYPES_BY_STATE[String(state || "").trim().toUpperCase()] || null;

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

const validateMatchRules = async ({ type, tournamentId, semanas }) => {
  const normalizedTournamentId = parsePositiveInt(tournamentId, "tournamentId");
  const tournament = await tournamentRepo.findById(normalizedTournamentId);

  if (!tournament) {
    throw new Error("Tournament not found.");
  }

  const normalizedType = normalizeMatchType(type);
  const allowedTypes = getAllowedMatchTypesForState(tournament.state);
  if (allowedTypes && !allowedTypes.includes(normalizedType)) {
    throw new Error(
      `When tournament state is ${tournament.state}, match type must be one of: ${allowedTypes.join(", ")}.`
    );
  }

  if (normalizedType === "ROUNDROBIN") {
    return parsePositiveInt(semanas, "semanas");
  }

  // Non-round-robin matches are stage/bracket matches and do not belong to a week.
  return null;
};

const getById = async (id) => {
  return await matchRepo.findById(id);
};

const getAll = async (tournamentId, semanas) => {
  const where = {};
  if (tournamentId) where.tournamentId = tournamentId;
  if (semanas) where.semanas = semanas;
  return await matchRepo.findAll(Object.keys(where).length > 0 ? { where } : {});
};
const create = async (data) => {
  const normalizedData = { ...data };
  const normalizedType = normalizeMatchType(normalizedData.type);
  normalizedData.type = normalizedType;

  normalizedData.semanas = await validateMatchRules({
    type: normalizedType,
    tournamentId: normalizedData.tournamentId,
    semanas: normalizedData.semanas,
  });

  if (normalizedType === "ROUNDROBIN") {
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
  const nextType = normalizeMatchType(normalizedData.type ?? existing.type);
  const nextTournamentId = normalizedData.tournamentId ?? existing.tournamentId;
  const nextSemanas =
    Object.prototype.hasOwnProperty.call(normalizedData, "semanas")
      ? normalizedData.semanas
      : existing.semanas;
  const nextTeamAId = normalizedData.teamAId ?? existing.teamAId;
  const nextTeamBId = normalizedData.teamBId ?? existing.teamBId;

  const validatedWeek = await validateMatchRules({
    type: nextType,
    tournamentId: nextTournamentId,
    semanas: nextSemanas,
  });

  normalizedData.type = nextType;
  normalizedData.semanas = validatedWeek;

  if (nextType === "ROUNDROBIN") {
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
const undoLastResult = async (id) => {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new Error("id must be a positive integer.");
  }
  return await matchRepo.undoLastResult(parsedId);
};
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

const updateWeekMaps = async (tournamentId, semanas, mapsAllowedByRound) => {
  const parsedTournamentId = parsePositiveInt(tournamentId, "tournamentId");
  const parsedWeek = parsePositiveInt(semanas, "semanas");

  // Validate mapsAllowedByRound format
  if (mapsAllowedByRound && typeof mapsAllowedByRound !== "object") {
    throw new Error("mapsAllowedByRound must be an object.");
  }

  // Find all matches in this week
  const matchesToUpdate = await matchRepo.findAll({
    where: {
      tournamentId: parsedTournamentId,
      type: "ROUNDROBIN",
      semanas: parsedWeek,
    },
  });

  if (matchesToUpdate.length === 0) {
    throw new Error(`No matches found for week ${parsedWeek}.`);
  }

  // Update each match with the new maps configuration
  const updatedMatches = await Promise.all(
    matchesToUpdate.map((match) =>
      matchRepo.update(match.id, { mapsAllowedByRound })
    )
  );

  return updatedMatches;
};

const getWeekMapsConfig = async (tournamentId, semanas) => {
  const parsedTournamentId = parsePositiveInt(tournamentId, "tournamentId");
  const parsedWeek = parsePositiveInt(semanas, "semanas");

  // Get first match in this week to get current maps config
  const matches = await matchRepo.findAll({
    where: {
      tournamentId: parsedTournamentId,
      type: "ROUNDROBIN",
      semanas: parsedWeek,
    },
    take: 1,
  });

  if (matches.length === 0) {
    return null;
  }

  return matches[0].mapsAllowedByRound || null;
};

module.exports = {
  getById,
  getAll,
  remove,
  generateRoundRobin,
  submitResult,
  undoLastResult,
  update,
  create,
  findSoonest,
  getActiveMatches,
  finishPendingRegisters,
  updateWeekMaps,
  getWeekMapsConfig,
};
