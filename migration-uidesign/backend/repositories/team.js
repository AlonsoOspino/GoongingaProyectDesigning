const prisma = require("../config/prisma");

const create = (data) => prisma.team.create({ data });
const update = (id, data) => prisma.team.update({ where: { id }, data });
const remove = (id) => prisma.team.delete({ where: { id } });
const findByName = (name) => prisma.team.findFirst({ where: { name } });
const findById = (id) => prisma.team.findUnique({ where: { id } });
const findAll = () => prisma.team.findMany();
const mapDiff = (team) => Number(team.mapWins || 0) - Number(team.mapLoses || 0);

const sortLeaderboard = (teams) =>
  [...teams].sort((a, b) => {
    const winsDiff = Number(b.victories || 0) - Number(a.victories || 0);
    if (winsDiff !== 0) return winsDiff;

    const lossesDiff = Number(a.defeats || 0) - Number(b.defeats || 0);
    if (lossesDiff !== 0) return lossesDiff;

    const differentialDiff = mapDiff(b) - mapDiff(a);
    if (differentialDiff !== 0) return differentialDiff;

    return Number(a.id || 0) - Number(b.id || 0);
  });

const findLeaderboard = async (tournamentId) => {
  const teams = await prisma.team.findMany({
    where: tournamentId ? { tournamentId } : undefined,
  });

  return sortLeaderboard(teams);
};

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
