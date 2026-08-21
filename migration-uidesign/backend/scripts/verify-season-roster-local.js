const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const API_BASE = process.env.VERIFICATION_API_BASE || "http://127.0.0.1:3100";

async function request(path, token, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

function tokenFor(memberId) {
  return jwt.sign(
    { id: memberId, accountType: "NETWORK_MEMBER" },
    process.env.NETWORK_JWT_SECRET || process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
}

async function main() {
  const database = await prisma.$queryRaw`SELECT current_database() AS name`;
  if (database[0]?.name !== "goonginga_dev") {
    throw new Error(`Refusing verification against ${database[0]?.name || "an unknown database"}.`);
  }
  const members = await prisma.networkMember.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, roles: true, role: true, teamId: true },
    take: 10,
    orderBy: { id: "asc" },
  });
  if (members.length < 10) throw new Error("Ten active members are required for roster verification.");
  const seasonEight = await prisma.tournament.findFirst({ orderBy: { id: "asc" } });
  const oldTeam = await prisma.team.findFirst({ where: { tournamentId: seasonEight.id }, orderBy: { id: "asc" } });
  if (!oldTeam) throw new Error("Season 8 needs at least one team for the cross-season checks.");

  const admin = members[0];
  const adminToken = tokenFor(admin.id);
  let tournamentId = null;
  let teamA = null;
  let teamB = null;
  let matchId = null;
  let draftId = null;
  let oldSeasonPlayerId = null;

  try {
    await prisma.networkMember.update({
      where: { id: admin.id },
      data: { roles: [...new Set([...admin.roles, "ADMIN"])] },
    });
    await prisma.networkMember.update({ where: { id: members[3].id }, data: { role: "ADMIN" } });
    const createdTournament = await request("/tournament/create", adminToken, {
      method: "POST",
      body: JSON.stringify({ name: `GGL Season 9 roster verification ${Date.now()}`, startDate: "2026-09-01T00:00:00.000Z" }),
    });
    if (createdTournament.status !== 201) throw new Error(`Could not create verification tournament: ${JSON.stringify(createdTournament)}`);
    tournamentId = createdTournament.body.id;

    const firstTeam = await request("/team/create", adminToken, {
      method: "POST",
      body: JSON.stringify({ name: `Roster Alpha ${tournamentId}`, tournamentId }),
    });
    const secondTeam = await request("/team/create", adminToken, {
      method: "POST",
      body: JSON.stringify({ name: `Roster Bravo ${tournamentId}`, tournamentId }),
    });
    teamA = firstTeam.body;
    teamB = secondTeam.body;
    await prisma.team.update({ where: { id: teamA.id }, data: { playoffSeed: 1 } });
    await prisma.team.update({ where: { id: teamB.id }, data: { playoffSeed: 2 } });

    const assignments = [];
    for (let index = 0; index < members.length; index += 1) {
      const team = index < 5 ? teamA : teamB;
      const role = index === 0 || index === 5 ? "CAPTAIN" : "PLAYER";
      assignments.push(await request(`/season-roster/${tournamentId}/members/${members[index].id}`, adminToken, {
        method: "PUT",
        body: JSON.stringify({ teamId: team.id, role }),
      }));
    }
    console.log("TEN_ASSIGNMENTS", JSON.stringify(assignments.map((entry) => ({
      status: entry.status,
      memberId: entry.body?.seasonPlayer?.memberId,
      teamId: entry.body?.seasonPlayer?.teamId,
      role: entry.body?.seasonPlayer?.role,
    }))));
    console.log("BRIDGE_ROLE_PRESERVATION", JSON.stringify({
      adminPlayer: await prisma.networkMember.findUnique({ where: { id: members[3].id }, select: { role: true } }),
    }));

    console.log("CROSS_SEASON_TEAM", JSON.stringify(await request(`/season-roster/${tournamentId}/members/${members[2].id}`, adminToken, {
      method: "PUT",
      body: JSON.stringify({ teamId: oldTeam.id, role: "PLAYER" }),
    })));
    console.log("CAPTAIN_WITHOUT_TEAM", JSON.stringify(await request(`/season-roster/${tournamentId}/members/${members[2].id}`, adminToken, {
      method: "PUT",
      body: JSON.stringify({ teamId: null, role: "CAPTAIN" }),
    })));

    const promotion = await request(`/season-roster/${tournamentId}/members/${members[2].id}`, adminToken, {
      method: "PUT",
      body: JSON.stringify({ teamId: teamA.id, role: "CAPTAIN" }),
    });
    console.log("CAPTAIN_REPLACEMENT", JSON.stringify(promotion));
    console.log("DEFAULT_PROMOTED_TO_CAPTAIN", JSON.stringify(
      await prisma.networkMember.findUnique({ where: { id: members[2].id }, select: { role: true } })
    ));
    const afterPromotion = await request(`/season-roster/${tournamentId}`, adminToken);
    console.log("TEAM_A_CAPTAINS", JSON.stringify(afterPromotion.body.assigned.filter(
      (player) => player.teamId === teamA.id && player.role === "CAPTAIN"
    ).map((player) => ({ memberId: player.memberId, username: player.member.username }))));

    const removedMember = members[4];
    console.log("REMOVE_MEMBER", JSON.stringify(await request(
      `/season-roster/${tournamentId}/members/${removedMember.id}`,
      adminToken,
      { method: "DELETE" }
    )));
    const afterRemoval = await request(`/season-roster/${tournamentId}`, adminToken);
    console.log("REMOVAL_CHECK", JSON.stringify({
      assigned: afterRemoval.body.assigned.some((player) => player.memberId === removedMember.id),
      unassigned: afterRemoval.body.unassigned.some((member) => member.id === removedMember.id),
    }));

    console.log("LEGACY_WRITE_REJECTED", JSON.stringify(await request(
      `/network-members/admin/players/${members[3].id}`,
      adminToken,
      { method: "PUT", body: JSON.stringify({ teamId: teamA.id }) }
    )));

    const bridgeBeforeOldSeason = await prisma.networkMember.findUnique({
      where: { id: members[2].id },
      select: { teamId: true, role: true },
    });
    const oldSeasonAssignment = await request(`/season-roster/${seasonEight.id}/members/${members[2].id}`, adminToken, {
      method: "PUT",
      body: JSON.stringify({ teamId: oldTeam.id, role: "CAPTAIN" }),
    });
    oldSeasonPlayerId = oldSeasonAssignment.body?.seasonPlayer?.id || null;
    const bridgeAfterOldSeason = await prisma.networkMember.findUnique({
      where: { id: members[2].id },
      select: { teamId: true, role: true },
    });
    console.log("BRIDGE_ACTIVE_AND_HISTORY", JSON.stringify({
      active: await prisma.networkMember.findUnique({ where: { id: members[2].id }, select: { teamId: true, role: true } }),
      beforeHistoricalAssignment: bridgeBeforeOldSeason,
      afterHistoricalAssignment: bridgeAfterOldSeason,
    }));

    const captain = members[2];
    const captainToken = tokenFor(captain.id);
    console.log("CAPABILITIES", JSON.stringify(await request("/network-members/me/capabilities", captainToken)));

    const controlMap = await prisma.map.findFirst({ where: { type: "CONTROL" }, orderBy: { id: "asc" } });
    if (!controlMap) throw new Error("A CONTROL map is required for captain draft verification.");
    const match = await prisma.match.create({
      data: {
        type: "PLAYOFFS",
        bestOf: 5,
        status: "SCHEDULED",
        tournamentId,
        teamAId: teamA.id,
        teamBId: teamB.id,
        playoffRound: 1,
        playoffSlot: 1,
      },
    });
    matchId = match.id;
    const createdDraft = await request(`/draft/${match.id}`, adminToken, { method: "POST", body: "{}" });
    draftId = createdDraft.body.id;
    await request(`/draft/${draftId}/start-map-picking`, adminToken, { method: "PATCH", body: "{}" });
    console.log("CAPTAIN_READY_200", JSON.stringify(await request(`/match/captain/update/${match.id}`, captainToken, {
      method: "PUT",
      body: JSON.stringify({ teamAready: 1 }),
    })));
    console.log("CAPTAIN_PICK_200", JSON.stringify(await request(`/draft/${draftId}/pick-map`, captainToken, {
      method: "POST",
      body: JSON.stringify({ mapId: controlMap.id }),
    })));

    console.log("DELETE_CAPTAIN", JSON.stringify(await request(
      `/season-roster/${tournamentId}/members/${captain.id}`,
      adminToken,
      { method: "DELETE" }
    )));
    console.log("CAPTAIN_READY_403", JSON.stringify(await request(`/match/captain/update/${match.id}`, captainToken, {
      method: "PUT",
      body: JSON.stringify({ teamAready: 0 }),
    })));
    console.log("CAPTAIN_PICK_403", JSON.stringify(await request(`/draft/${draftId}/pick-map`, captainToken, {
      method: "POST",
      body: JSON.stringify({ mapId: controlMap.id }),
    })));
  } finally {
    if (draftId) await prisma.draftAction.deleteMany({ where: { draftId } });
    if (draftId) await prisma.draftTable.deleteMany({ where: { id: draftId } });
    if (matchId) await prisma.match.deleteMany({ where: { id: matchId } });
    if (oldSeasonPlayerId) await prisma.seasonPlayer.deleteMany({ where: { id: oldSeasonPlayerId } });
    if (tournamentId) await prisma.seasonPlayer.deleteMany({ where: { tournamentId } });
    for (const member of members) {
      await prisma.networkMember.update({
        where: { id: member.id },
        data: { roles: member.roles, role: member.role, teamId: member.teamId },
      });
    }
    if (tournamentId) await prisma.team.deleteMany({ where: { tournamentId } });
    if (tournamentId) await prisma.tournament.deleteMany({ where: { id: tournamentId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
