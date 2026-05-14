const prisma = require("../config/prisma");

const findShared = async () =>
  prisma.leaderboardOverlayAsset.findFirst({
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });

const findByMatchId = async () => findShared();

const upsertByMatchId = async (matchId, data) => {
  const existing = await findShared();

  if (existing) {
    return prisma.leaderboardOverlayAsset.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.leaderboardOverlayAsset.create({
    data: {
      matchId,
      ...data,
    },
  });
};

module.exports = {
  findByMatchId,
  upsertByMatchId,
};
