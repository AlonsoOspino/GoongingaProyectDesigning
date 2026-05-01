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

const createMany = async ({ count, tournamentId, namePrefix = "Team" }) => {
  if (!Number.isInteger(count) || count <= 0) throw new Error("count must be a positive integer");
  if (tournamentId === undefined || tournamentId === null) throw new Error("tournamentId is required");

  // load existing team names to avoid collisions
  const existing = await teamRepo.findAll();
  const existingNames = new Set(existing.map((t) => t.name));

  const toCreate = [];
  let idx = 1;
  while (toCreate.length < count) {
    let name = `${namePrefix} ${idx}`;
    if (existingNames.has(name)) {
      idx++;
      continue;
    }
    toCreate.push({ name, tournamentId });
    existingNames.add(name);
    idx++;
  }

  const result = await teamRepo.createMany(toCreate);
  return { created: result.count || toCreate.length, names: toCreate.map((t) => t.name) };
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
  createMany,
  update,
  remove,
  getAll,
  getById,
  getLeaderboard,
};
