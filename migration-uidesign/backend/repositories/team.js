const prisma = require("../config/prisma");

const create = (data) => prisma.team.create({ data });
const update = (id, data) => prisma.team.update({ where: { id }, data });
const remove = (id) => prisma.team.delete({ where: { id } });
const findByName = (name) => prisma.team.findFirst({ where: { name } });
const findById = (id) => prisma.team.findUnique({ where: { id } });
const findAll = () => prisma.team.findMany();
const findLeaderboard = (tournamentId) =>
  prisma.team.findMany({
    where: tournamentId ? { tournamentId } : undefined,
    orderBy: [
      { victories: "desc" },
      { mapWins: "desc" },
      { mapLoses: "asc" },
      { id: "asc" },
    ],
  });

module.exports = {
  create,
  update,
  remove,
  findByName,
  findById,
  findAll,
  findLeaderboard,
};

// Bulk create teams (skipDuplicates to avoid unique constraint errors)
const createMany = (data) => prisma.team.createMany({ data, skipDuplicates: true });

module.exports.createMany = createMany;
