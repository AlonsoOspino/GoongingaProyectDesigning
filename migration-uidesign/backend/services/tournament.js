const tournamentRepo = require("../repositories/tournament");

const create = async (data) => {
  if (!data) throw new Error("Body is missing");
  const { name, startDate, state } = data;
  if (!name || !startDate) {
    throw new Error("name and startDate are required");
  }
  const existingTournaments = await tournamentRepo.findAll();
  if (existingTournaments.length > 0) {
    throw new Error("A tournament already exists");
  }
  const existing = await tournamentRepo.findByName(name);
  if (existing) throw new Error("Tournament already exists");
  return await tournamentRepo.create({
    name,
    startDate,
    state: state || "SCHEDULED",
  });
};


const update = async (id, data) => {
  if (!data) throw new Error("Body is missing");
  return await tournamentRepo.update(id, data);
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
};
