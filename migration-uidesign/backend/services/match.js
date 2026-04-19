const matchRepo = require("../repositories/match");
const tournamentRepo = require("../repositories/tournament");

const parsePositiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return parsed;
};

const validateRoundRobinWeekRules = async ({ type, tournamentId, semanas }) => {
  const normalizedTournamentId = parsePositiveInt(tournamentId, "tournamentId");
  const tournament = await tournamentRepo.findById(normalizedTournamentId);

  if (!tournament) {
    throw new Error("Tournament not found.");
  }

  const normalizedType = String(type || "").trim().toUpperCase();
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

  const validatedWeek = await validateRoundRobinWeekRules({
    type: nextType,
    tournamentId: nextTournamentId,
    semanas: nextSemanas,
  });

  if (validatedWeek !== undefined) {
    normalizedData.semanas = validatedWeek;
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
