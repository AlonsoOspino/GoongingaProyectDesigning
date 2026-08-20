const prisma = require("../config/prisma");

const create = (data) => prisma.team.create({ data });
const update = (id, data) => prisma.team.update({ where: { id }, data });
const remove = (id) => prisma.team.delete({ where: { id } });
const findByName = (name) => prisma.team.findFirst({ where: { name } });
const findById = (id) => prisma.team.findUnique({ where: { id } });
const findAll = () => prisma.team.findMany();
const mapDiff = (team) => Number(team.mapWins || 0) - Number(team.mapLoses || 0);

const pairingKey = (teamAId, teamBId) =>
  teamAId < teamBId ? `${teamAId}-${teamBId}` : `${teamBId}-${teamAId}`;

const sortLeaderboard = (teams, headToHeadWinners = new Map()) =>
  [...teams].sort((a, b) => {
    const seedA = Number.isInteger(a.playoffSeed) ? a.playoffSeed : null;
    const seedB = Number.isInteger(b.playoffSeed) ? b.playoffSeed : null;
    if (seedA !== null || seedB !== null) {
      if (seedA === null) return 1;
      if (seedB === null) return -1;
      return seedA - seedB;
    }

    const winsDiff = Number(b.victories || 0) - Number(a.victories || 0);
    if (winsDiff !== 0) return winsDiff;

    const lossesDiff = Number(a.defeats || 0) - Number(b.defeats || 0);
    if (lossesDiff !== 0) return lossesDiff;

    const differentialDiff = mapDiff(b) - mapDiff(a);
    if (differentialDiff !== 0) return differentialDiff;

    const headToHeadWinner = headToHeadWinners.get(pairingKey(a.id, b.id));
    if (headToHeadWinner === a.id) return -1;
    if (headToHeadWinner === b.id) return 1;

    return Number(a.id || 0) - Number(b.id || 0);
  });

const findLeaderboard = async (tournamentId) => {
  const [teams, decidedRoundRobinMatches] = await Promise.all([
    prisma.team.findMany({
      where: tournamentId ? { tournamentId } : undefined,
    }),
    prisma.match.findMany({
      where: {
        ...(tournamentId ? { tournamentId } : {}),
        type: "ROUNDROBIN",
        status: "FINISHED",
      },
      select: {
        teamAId: true,
        teamBId: true,
        mapWinsTeamA: true,
        mapWinsTeamB: true,
      },
    }),
  ]);

  const headToHeadWinners = new Map();
  for (const match of decidedRoundRobinMatches) {
    const winnerTeamId =
      match.mapWinsTeamA > match.mapWinsTeamB
        ? match.teamAId
        : match.mapWinsTeamB > match.mapWinsTeamA
        ? match.teamBId
        : null;
    if (winnerTeamId) {
      headToHeadWinners.set(pairingKey(match.teamAId, match.teamBId), winnerTeamId);
    }
  }

  return sortLeaderboard(teams, headToHeadWinners);
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
