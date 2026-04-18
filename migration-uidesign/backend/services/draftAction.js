const draftActionRepo = require("../repositories/draftAction");

const create = async (data) => {
  return await draftActionRepo.create(data);
};

const update = async (id, data) => {
  return await draftActionRepo.update(id, data);
};

const remove = async (id) => {
  return await draftActionRepo.remove(id);
};

const getAll = async () => {
  return await draftActionRepo.getAll();
};

module.exports = {
  create,
  update,
  remove,
  getAll
};
