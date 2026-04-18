const draftTableRepo = require("../repositories/draftTable");

const create = async (data) => {
  return await draftTableRepo.create(data);
};

const update = async (id, data) => {
  return await draftTableRepo.update(id, data);
};

const remove = async (id) => {
  return await draftTableRepo.remove(id);
};

const getAll = async () => {
  return await draftTableRepo.getAll();
};

const findByMatchId = async (matchId) => {
  return await draftTableRepo.findByMatchId(matchId);
};

module.exports = {
  create,
  update,
  remove,
  getAll,
  findByMatchId
};
