const teamRepo = require("../repositories/team");

const getAll = async () => {
  return await teamRepo.findAll();
};

const getById = async (id) => {
  return await teamRepo.findById(id);
};

const getLeaderboard = async (tournamentId) => {
  const parsedTournamentId = Number(tournamentId);
  const hasTournamentId = Number.isInteger(parsedTournamentId) && parsedTournamentId > 0;
  return await teamRepo.findLeaderboard(hasTournamentId ? parsedTournamentId : undefined);
};

const create = async (data) => {
  if (!data) throw new Error("Body is missing");
  if (!data.name) throw new Error("name is required");
  if (data.tournamentId === undefined || data.tournamentId === null) {
    throw new Error("tournamentId is required");
  }
  const existing = await teamRepo.findByName(data.name);
  if (existing) throw new Error("Team already exists");
  return await teamRepo.create(data);
};

const update = async (id, data) => {
  if (!data) throw new Error("Body is missing");
  return await teamRepo.update(id, data);
};

const remove = async (id) => {
  return await teamRepo.remove(id);
};

module.exports = {
  create,
  update,
  remove,
  getAll,
  getById,
  getLeaderboard,
};
