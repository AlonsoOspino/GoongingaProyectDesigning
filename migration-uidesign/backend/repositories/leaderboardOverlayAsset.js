const prisma = require("../config/prisma");

const findByMatchId = (matchId) =>
  prisma.leaderboardOverlayAsset.findUnique({
    where: { matchId },
  });

const upsertByMatchId = (matchId, data) =>
  prisma.leaderboardOverlayAsset.upsert({
    where: { matchId },
    update: data,
    create: {
      matchId,
      ...data,
    },
  });

module.exports = {
  findByMatchId,
  upsertByMatchId,
};
