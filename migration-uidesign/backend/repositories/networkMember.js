const prisma = require("../config/prisma");

const discordMemberSelect = {
  id: true,
  username: true,
  avatarUrl: true,
  roles: true,
};

const NETWORK_MEMBER_ROLES = [
  "MEMBER",
  "ADMIN",
  "CASTER",
  "DEVELOPER",
  "SEASON_PLAYER",
  "MODERATOR",
  "COMMUNITY_MANAGER",
  "CONTENT_CREATOR",
  "SOCIAL_MEDIA",
];

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

function findForAdmin(search = "") {
  return prisma.networkMember.findMany({
    where: search ? { username: { contains: search, mode: "insensitive" } } : {},
    select: {
      ...discordMemberSelect,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
  });
}

function findById(id) {
  return prisma.networkMember.findUnique({
    where: { id },
    select: {
      ...discordMemberSelect,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

function updateRoles(id, roles) {
  return prisma.networkMember.update({
    where: { id },
    data: { roles },
    select: {
      ...discordMemberSelect,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

module.exports = {
  findRecent,
  upsertFromDiscord,
  findForAdmin,
  findById,
  updateRoles,
  NETWORK_MEMBER_ROLES,
};
