const prisma = require("../config/prisma");

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function positiveId(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw httpError(400, `${label} must be a positive integer.`);
  return id;
}

function normalizeAssignment(payload) {
  const role = payload?.role;
  if (!(["CAPTAIN", "PLAYER"].includes(role))) {
    throw httpError(400, "role must be CAPTAIN or PLAYER.");
  }
  const teamId = payload?.teamId === null ? null : Number(payload?.teamId);
  if (teamId !== null && (!Number.isInteger(teamId) || teamId < 1)) {
    throw httpError(400, "teamId must be a positive integer or null.");
  }
  if (role === "CAPTAIN" && teamId === null) {
    throw httpError(400, "A captain must be assigned to a team.");
  }
  return { teamId, role };
}

async function getTournaments(client = prisma) {
  return client.tournament.findMany({
    select: { id: true, name: true, startDate: true, state: true },
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
  });
}

async function getRoster(tournamentValue, client = prisma) {
  const tournamentId = positiveId(tournamentValue, "Tournament id");
  const tournament = await client.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, name: true, startDate: true, state: true },
  });
  if (!tournament) throw httpError(404, "Tournament not found.");

  const [teams, assigned, unassigned] = await Promise.all([
    client.team.findMany({
      where: { tournamentId },
      select: { id: true, name: true, playoffSeed: true },
      orderBy: [{ playoffSeed: "asc" }, { name: "asc" }],
    }),
    client.seasonPlayer.findMany({
      where: { tournamentId },
      select: {
        id: true,
        memberId: true,
        teamId: true,
        role: true,
        joinedAt: true,
        member: { select: { id: true, username: true, nickname: true, avatarUrl: true } },
      },
      orderBy: [{ teamId: "asc" }, { member: { username: "asc" } }],
    }),
    client.networkMember.findMany({
      where: { status: "ACTIVE", seasonPlayers: { none: { tournamentId } } },
      select: { id: true, username: true, nickname: true, avatarUrl: true },
      orderBy: { username: "asc" },
    }),
  ]);
  return { tournament, teams, assigned, unassigned };
}

async function upsertMember(tournamentValue, memberValue, payload, client = prisma) {
  const tournamentId = positiveId(tournamentValue, "Tournament id");
  const memberId = positiveId(memberValue, "Member id");
  const assignment = normalizeAssignment(payload);

  return client.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, state: true },
    });
    if (!tournament) throw httpError(404, "Tournament not found. Create the season before assigning players.");

    const member = await tx.networkMember.findUnique({
      where: { id: memberId },
      select: { id: true, username: true, status: true },
    });
    if (!member || member.status !== "ACTIVE") {
      throw httpError(400, "The selected Network Member does not exist or is not active.");
    }

    if (assignment.teamId !== null) {
      const team = await tx.team.findUnique({
        where: { id: assignment.teamId },
        select: { id: true, tournamentId: true },
      });
      if (!team || team.tournamentId !== tournamentId) {
        throw httpError(400, "The selected team does not belong to this season.");
      }
    }

    let demoted = null;
    if (assignment.role === "CAPTAIN") {
      const incumbent = await tx.seasonPlayer.findFirst({
        where: { tournamentId, teamId: assignment.teamId, role: "CAPTAIN", memberId: { not: memberId } },
        select: { id: true, memberId: true, member: { select: { username: true } } },
      });
      if (incumbent) {
        await tx.seasonPlayer.update({ where: { id: incumbent.id }, data: { role: "PLAYER" } });
        demoted = { memberId: incumbent.memberId, username: incumbent.member.username };
        if (tournament.state !== "FINISHED") {
          await tx.networkMember.update({ where: { id: incumbent.memberId }, data: { role: "DEFAULT" } });
        }
      }
    }

    const seasonPlayer = await tx.seasonPlayer.upsert({
      where: { memberId_tournamentId: { memberId, tournamentId } },
      create: { memberId, tournamentId, ...assignment },
      update: assignment,
      select: {
        id: true,
        memberId: true,
        teamId: true,
        role: true,
        joinedAt: true,
        member: { select: { id: true, username: true, nickname: true, avatarUrl: true } },
      },
    });

    // Temporary legacy bridge: public roster readers still use NetworkMember.teamId and role.
    // Mirror only the active season; delete this once every reader resolves through SeasonPlayer.
    if (tournament.state !== "FINISHED") {
      await tx.networkMember.update({
        where: { id: memberId },
        data: { teamId: assignment.teamId, role: assignment.role === "CAPTAIN" ? "CAPTAIN" : "DEFAULT" },
      });
    }
    return { seasonPlayer, demoted };
  }, { isolationLevel: "Serializable" });
}

async function removeMember(tournamentValue, memberValue, client = prisma) {
  const tournamentId = positiveId(tournamentValue, "Tournament id");
  const memberId = positiveId(memberValue, "Member id");
  return client.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, state: true },
    });
    if (!tournament) throw httpError(404, "Tournament not found.");
    const existing = await tx.seasonPlayer.findUnique({
      where: { memberId_tournamentId: { memberId, tournamentId } },
      select: { id: true },
    });
    if (!existing) throw httpError(404, "This member is not assigned to the season.");
    await tx.seasonPlayer.delete({ where: { id: existing.id } });
    if (tournament.state !== "FINISHED") {
      await tx.networkMember.update({ where: { id: memberId }, data: { teamId: null, role: "DEFAULT" } });
    }
    return { memberId };
  }, { isolationLevel: "Serializable" });
}

module.exports = {
  getTournaments,
  getRoster,
  upsertMember,
  removeMember,
  __testables: { normalizeAssignment },
};
