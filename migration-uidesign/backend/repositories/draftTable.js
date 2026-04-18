const prisma = require("../config/prisma");

const create = (data) => prisma.draftTable.create({ data });
const update = (id, data) => prisma.draftTable.update({ where: { id }, data });
const remove = (id) => prisma.draftTable.delete({ where: { id } });
const getAll = () => prisma.draftTable.findMany();
const findByMatchId = async (matchId) => {
  return await prisma.draftTable.findUnique({ where: { matchId } });
};

module.exports = {
  create,
  update,
  remove,
  getAll,
  findByMatchId
};
