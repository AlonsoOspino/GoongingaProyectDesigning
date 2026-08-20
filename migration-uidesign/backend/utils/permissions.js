const prisma = require("../config/prisma");

function hasNetworkRole(user, ...roles) {
  return Array.isArray(user?.roles) && user.roles.some((role) => roles.includes(role));
}

function hasManagerAccess(user) {
  return Boolean(user && hasNetworkRole(user, "SOCIAL_MEDIA", "ADMIN"));
}

async function resolveSeasonPlayer(memberId, tournamentId, client = prisma) {
  const normalizedMemberId = Number(memberId);
  const normalizedTournamentId = Number(tournamentId);
  if (!Number.isInteger(normalizedMemberId) || !Number.isInteger(normalizedTournamentId)) return null;

  return client.seasonPlayer.findUnique({
    where: {
      memberId_tournamentId: {
        memberId: normalizedMemberId,
        tournamentId: normalizedTournamentId,
      },
    },
    select: { id: true, teamId: true, role: true },
  });
}

async function isCaptainOf(memberId, tournamentId, teamId, client = prisma) {
  const seasonPlayer = await resolveSeasonPlayer(memberId, tournamentId, client);
  return Boolean(
    seasonPlayer &&
    seasonPlayer.role === "CAPTAIN" &&
    seasonPlayer.teamId === Number(teamId),
  );
}

module.exports = { hasNetworkRole, hasManagerAccess, resolveSeasonPlayer, isCaptainOf };
