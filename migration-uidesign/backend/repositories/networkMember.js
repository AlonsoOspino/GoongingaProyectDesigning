const prisma = require("../config/prisma");

const discordMemberSelect = {
  id: true,
  username: true,
  avatarUrl: true,
  roles: true,
};

async function upsertFromDiscord({ discordUserId, username, avatarUrl, joinedAt }) {
  const verifiedAt = new Date();

  return prisma.networkMember.upsert({
    where: { discordUserId },
    create: {
      discordUserId,
      username,
      avatarUrl,
      discordJoinedGglAt: joinedAt,
      discordLastVerifiedAt: verifiedAt,
    },
    update: {
      username,
      avatarUrl,
      status: "ACTIVE",
      discordJoinedGglAt: joinedAt,
      discordLastVerifiedAt: verifiedAt,
    },
    select: discordMemberSelect,
  });
}

function findRecent(limit = 5) {
  return prisma.networkMember.findMany({
    where: { status: "ACTIVE" },
    select: {
      ...discordMemberSelect,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

module.exports = {
  findRecent,
  upsertFromDiscord,
};
