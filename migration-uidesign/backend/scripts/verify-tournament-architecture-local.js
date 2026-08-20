const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const matchRepo = require("../repositories/match");
const teamRepo = require("../repositories/team");

function summarizeTeams(teams) {
  return teams.map(({ id, name, victories, defeats, mapWins, mapLoses, state }) => ({
    id,
    name,
    victories,
    defeats,
    mapWins,
    mapLoses,
    state,
  }));
}

async function main() {
  if (!String(process.env.DATABASE_URL).includes("goonginga_dev")) {
    throw new Error("Refusing to run outside goonginga_dev.");
  }

  const member = await prisma.networkMember.findUnique({ where: { id: 1 } });
  if (!member) throw new Error("Verification member 1 does not exist.");
  const originalRoles = member.roles;
  const tournamentIds = [];

  try {
    const playoffTournament = await prisma.tournament.create({
      data: { name: `Architecture verification ${Date.now()}`, startDate: new Date(), state: "PLAYOFFS" },
    });
    tournamentIds.push(playoffTournament.id);
    const playoffTeams = [];
    for (let seed = 1; seed <= 8; seed += 1) {
      playoffTeams.push(await prisma.team.create({
        data: {
          name: `Verification playoff ${playoffTournament.id}-${seed}`,
          tournamentId: playoffTournament.id,
          playoffSeed: seed,
        },
      }));
    }

    await prisma.networkMember.update({
      where: { id: member.id },
      data: { roles: [...new Set([...originalRoles, "ADMIN"])] },
    });
    await prisma.seasonPlayer.create({
      data: {
        memberId: member.id,
        tournamentId: playoffTournament.id,
        teamId: playoffTeams[0].id,
        role: "CAPTAIN",
      },
    });

    const secret = process.env.NETWORK_JWT_SECRET || process.env.JWT_SECRET;
    const token = jwt.sign({ id: member.id, accountType: "NETWORK_MEMBER" }, secret, { expiresIn: "15m" });
    const capabilityResponse = await fetch("http://127.0.0.1:3100/network-members/me/capabilities", {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log("\nCAPABILITIES: admin and captain\n" +
      `HTTP ${capabilityResponse.status}\n${JSON.stringify(await capabilityResponse.json(), null, 2)}`);

    const pairings = [[0, 7], [1, 6], [2, 5], [3, 4]];
    const quarterfinals = [];
    for (let slot = 0; slot < pairings.length; slot += 1) {
      const [teamAIndex, teamBIndex] = pairings[slot];
      quarterfinals.push(await prisma.match.create({
        data: {
          type: "PLAYOFFS",
          bestOf: 5,
          tournamentId: playoffTournament.id,
          teamAId: playoffTeams[teamAIndex].id,
          teamBId: playoffTeams[teamBIndex].id,
          playoffRound: 1,
          playoffSlot: slot + 1,
          title: `Verification quarterfinal ${slot + 1}`,
        },
      }));
    }

    const primary = quarterfinals[0];
    const primaryStates = [(await prisma.match.findUnique({ where: { id: primary.id } })).status];
    primaryStates.push((await matchRepo.submitResult(primary.id, primary.teamAId)).status);
    primaryStates.push((await matchRepo.submitResult(primary.id, primary.teamAId)).status);
    primaryStates.push((await matchRepo.submitResult(primary.id, primary.teamAId)).status);
    console.log(`\nPLAYOFF MATCH STATUS SEQUENCE\n${JSON.stringify(primaryStates)}`);

    for (const match of quarterfinals.slice(1)) {
      await matchRepo.submitResult(match.id, match.teamAId);
      await matchRepo.submitResult(match.id, match.teamAId);
      await matchRepo.submitResult(match.id, match.teamAId);
    }
    const semifinals = await prisma.match.findMany({
      where: { tournamentId: playoffTournament.id, playoffRound: 2 },
      orderBy: { playoffSlot: "asc" },
      select: { id: true, status: true, teamAId: true, teamBId: true, playoffRound: true, playoffSlot: true },
    });
    console.log(`\nPLAYOFF ADVANCEMENT\n${JSON.stringify({ count: semifinals.length, semifinals }, null, 2)}`);

    const resetSource = quarterfinals[3];
    const resetResult = await matchRepo.resetMatchToSchedule(resetSource.id);
    const semifinalsAfterReset = await prisma.match.count({
      where: { tournamentId: playoffTournament.id, playoffRound: 2 },
    });
    const resetLoser = await prisma.team.findUnique({ where: { id: resetSource.teamBId } });
    console.log(`\nPLAYOFF RESET\n${JSON.stringify({
      matchId: resetResult.id,
      status: resetResult.status,
      mapWinsTeamA: resetResult.mapWinsTeamA,
      mapWinsTeamB: resetResult.mapWinsTeamB,
      resetLoserState: resetLoser.state,
      semifinalsAfterReset,
    }, null, 2)}`);

    const roundRobinTournament = await prisma.tournament.create({
      data: { name: `Standings verification ${Date.now()}`, startDate: new Date(), state: "ROUNDROBIN" },
    });
    tournamentIds.push(roundRobinTournament.id);
    const roundRobinTeams = await Promise.all(["Alpha", "Beta"].map((suffix) => prisma.team.create({
      data: { name: `Verification ${suffix} ${roundRobinTournament.id}`, tournamentId: roundRobinTournament.id },
    })));
    const roundRobinMatch = await prisma.match.create({
      data: {
        type: "ROUNDROBIN",
        bestOf: 3,
        semanas: 1,
        tournamentId: roundRobinTournament.id,
        teamAId: roundRobinTeams[0].id,
        teamBId: roundRobinTeams[1].id,
      },
    });
    const standingsBefore = summarizeTeams(await teamRepo.findLeaderboard(roundRobinTournament.id));
    await matchRepo.submitResult(roundRobinMatch.id, roundRobinMatch.teamAId);
    const roundRobinFinished = await matchRepo.submitResult(roundRobinMatch.id, roundRobinMatch.teamAId);
    const standingsAfter = summarizeTeams(await teamRepo.findLeaderboard(roundRobinTournament.id));
    const roundRobinReset = await matchRepo.resetMatchToSchedule(roundRobinMatch.id);
    const standingsAfterReset = summarizeTeams(await teamRepo.findLeaderboard(roundRobinTournament.id));
    console.log(`\nSTANDINGS AND RESET\n${JSON.stringify({
      standingsBefore,
      finishedStatus: roundRobinFinished.status,
      standingsAfter,
      resetStatus: roundRobinReset.status,
      standingsAfterReset,
    }, null, 2)}`);
  } finally {
    await prisma.networkMember.update({ where: { id: member.id }, data: { roles: originalRoles } });
    if (tournamentIds.length) {
      await prisma.match.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
      await prisma.seasonPlayer.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
      await prisma.team.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
      await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
