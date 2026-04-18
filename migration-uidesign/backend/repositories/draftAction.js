const prisma = require("../config/prisma");

const create = (data) => prisma.draftAction.create({ data });
const update = (id, data) => prisma.draftAction.update({ where: { id }, data });
const remove = (id) => prisma.draftAction.delete({ where: { id } });
const getAll = () => prisma.draftAction.findMany();

module.exports = {
  create,
  update,
  remove,
  getAll
};
