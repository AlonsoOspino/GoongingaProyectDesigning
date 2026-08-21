const tournamentRepo = require("../repositories/tournament");
const teamRepo = require("../repositories/team");

const normalizeCreateData = (data, activeTournament = null) => {
  if (!data) throw new Error("Body is missing");
  const { name, startDate } = data;
  if (!name || !startDate) {
    throw new Error("name and startDate are required");
  }
  const parsedStartDate = new Date(startDate);
  if (Number.isNaN(parsedStartDate.getTime())) {
    throw new Error("startDate must be a valid date");
  }
  if (activeTournament) {
    throw new Error(`Finish ${activeTournament.name} before creating another season`);
  }
  return { name, startDate: parsedStartDate, state: "SCHEDULED" };
};

const create = async (data) => {
  const activeTournament = await tournamentRepo.findActive();
  const normalized = normalizeCreateData(data, activeTournament);
  const existing = await tournamentRepo.findByName(normalized.name);
  if (existing) throw new Error("Tournament already exists");
  return await tournamentRepo.create(normalized);
};


const update = async (id, data) => {
  if (!data) throw new Error("Body is missing");
  if (String(data.state || "").toUpperCase() === "PLAYOFFS") {
    const existing = await tournamentRepo.findById(id);
    if (existing && existing.state !== "PLAYOFFS") {
      throw new Error("Use the playoff team selection flow to start playoffs.");
    }
  }
  return await tournamentRepo.update(id, data);
};

const startPlayoffs = async (id, data) => {
  const tournamentId = Number(id);
  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    throw new Error("Tournament id must be a positive integer.");
  }

  const selectedTeamIds = Array.isArray(data?.teamIds)
    ? [...new Set(data.teamIds.map(Number))]
    : [];
  if (selectedTeamIds.length !== 8 || selectedTeamIds.some((teamId) => !Number.isInteger(teamId) || teamId <= 0)) {
    throw new Error("Select exactly 8 valid teams for playoffs.");
  }

  const leaderboard = await teamRepo.findLeaderboard(tournamentId);
  const selectedSet = new Set(selectedTeamIds);
  const seededTeams = leaderboard.filter((team) => selectedSet.has(team.id));
  if (seededTeams.length !== 8) {
    throw new Error("Every selected team must belong to this tournament.");
  }

  return tournamentRepo.startPlayoffs(tournamentId, seededTeams.map((team) => team.id));
};

const remove = async (id) => {
  return await tournamentRepo.remove(id);
};

const getAll = async () => {
  return await tournamentRepo.findAll();
};

const getCurrent = async () => {
  const tournaments = await tournamentRepo.findAll();
  return tournaments[0] || null;
};

module.exports = {
  create,
  update,
  remove,
  getAll,
  getCurrent,
  startPlayoffs,
  __testables: { normalizeCreateData },
};
