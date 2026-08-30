const prisma = require("../config/prisma");

const discordMemberSelect = {
  id: true,
  username: true,
  avatarUrl: true,
  roles: true,
  nickname: true,
  profilePic: true,
  role: true,
  rank: true,
  teamId: true,
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
      nickname: username,
      profilePic: avatarUrl,
      discordJoinedGglAt: joinedAt,
      discordLastVerifiedAt: verifiedAt,
    },
    update: {
      username,
      avatarUrl,
      nickname: username,
      profilePic: avatarUrl,
      status: "ACTIVE",
      discordJoinedGglAt: joinedAt,
      discordLastVerifiedAt: verifiedAt,
    },
    select: discordMemberSelect,
  });
}

/*
 * Stand-in players created to test Family Feud are real NetworkMember rows,
 * so without this they show up as brand new community members — usually with
 * no avatar, which is where the odd icons in the landing rail came from. They
 * are identified by the prefix the Feud controller stamps on discordUserId.
 */
const FEUD_GUEST_PREFIX = "FEUD_GUEST:";

function findRecent(limit = 5) {
  return prisma.networkMember.findMany({
    where: {
      status: "ACTIVE",
      NOT: { discordUserId: { startsWith: FEUD_GUEST_PREFIX } },
    },
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

function findLeagueMembers() {
  return prisma.networkMember.findMany({
    where: { status: "ACTIVE" },
    select: discordMemberSelect,
    orderBy: [{ teamId: "asc" }, { username: "asc" }],
  });
}

function findCompetitiveProfile(id) {
  return prisma.networkMember.findUnique({ where: { id }, });
}

function updateCompetitiveProfile(id, data) {
  return prisma.networkMember.update({ where: { id }, data });
}

module.exports = {
  findRecent,
  upsertFromDiscord,
  findForAdmin,
  findById,
  updateRoles,
  findLeagueMembers,
  findCompetitiveProfile,
  updateCompetitiveProfile,
  NETWORK_MEMBER_ROLES,
};
