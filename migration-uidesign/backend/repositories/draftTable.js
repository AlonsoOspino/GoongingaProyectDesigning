const prisma = require("../config/prisma");
const { DEV_DRAFT_TOURNAMENT_NAME } = require("../utils/devDraftApp");

const create = (data) => prisma.draftTable.create({ data });
const update = (id, data) => prisma.draftTable.update({ where: { id }, data });
const remove = (id) => prisma.draftTable.delete({ where: { id } });
const getAll = () =>
  prisma.draftTable.findMany({
    where: {
      match: { tournament: { name: { not: DEV_DRAFT_TOURNAMENT_NAME } } },
    },
  });
const findByMatchId = async (matchId) => {
  return await prisma.draftTable.findUnique({
    where: { matchId },
    include: {
      match: {
        include: {
          teamA: true,
          teamB: true
        }
      },
      actions: true
    }
  });
};

module.exports = {
  create,
  update,
  remove,
  getAll,
  findByMatchId
};
