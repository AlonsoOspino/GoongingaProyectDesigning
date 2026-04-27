const prisma = require("../config/prisma");

const findById = (id) =>
  prisma.match.findUnique({
    where: { id },
    include: {
      draft: {
        include: {
          actions: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });
const findAll = (args) => prisma.match.findMany(args);
const create = (data) => prisma.match.create({ data });
const update = (id, data) => prisma.match.update({ where: { id }, data });
const remove = async (id) => {
  const draftTable = await prisma.draftTable.findUnique({ where: { matchId: id } });
  if (draftTable) {
    await prisma.draftAction.deleteMany({ where: { draftId: draftTable.id } });
    await prisma.draftTable.delete({ where: { id: draftTable.id } });
  }
  try {
    await prisma.playerStat.deleteMany({ where: { matchId: id } });
  } catch (e) {
    // Ignore if PlayerStat does not have matchId
  }
  return prisma.match.delete({ where: { id } });
};

/**
 * Round robin generation using the "circle method" (polygon rotation algorithm).
 * This guarantees that NO team plays more than ONCE per round/week.
 *
 * With N teams (N even):  N-1 rounds, each round has N/2 matches.
 * With N teams (N odd):   N rounds, each round has floor(N/2) matches (one team has a bye each round).
 */
const generateRoundRobin = async (tournamentId) => {
  const teams = await prisma.team.findMany({
    where: { tournamentId },
    orderBy: { id: "asc" },
  });

  if (teams.length < 2) {
    throw new Error("At least 2 teams are required for round robin generation.");
  }

  return prisma.$transaction(async (tx) => {
    const existingRoundRobin = await tx.match.findFirst({
      where: {
        tournamentId,
        type: "ROUNDROBIN",
      },
      select: { id: true },
    });

    if (existingRoundRobin) {
      throw new Error(
        "This tournament already has round robin matches. Delete existing round robin matches before generating again."
      );
    }

    const maps = await tx.map.findMany({ select: { id: true } });

    const participants = [...teams];
    if (participants.length % 2 !== 0) {
      participants.push(null); // null = bye
    }

    const totalParticipants = participants.length;
    const totalRounds = totalParticipants - 1;
    const matchesPerRound = totalParticipants / 2;
    const expectedPairings = (teams.length * (teams.length - 1)) / 2;

    let rotation = [...participants];
    const created = [];
    const pairingKeys = new Set();

    for (let round = 0; round < totalRounds; round++) {
      const week = round + 1;
      const teamsScheduledThisWeek = new Set();

      for (let i = 0; i < matchesPerRound; i++) {
        let home = rotation[i];
        let away = rotation[totalParticipants - 1 - i];

        // Skip bye pairings for odd team counts.
        if (home === null || away === null) {
          continue;
        }

        // Small home/away balance tweak for the fixed slot.
        if (i === 0 && round % 2 === 1) {
          [home, away] = [away, home];
        }

        if (teamsScheduledThisWeek.has(home.id) || teamsScheduledThisWeek.has(away.id)) {
          throw new Error(`Round robin generation error: team repeated in week ${week}.`);
        }

        teamsScheduledThisWeek.add(home.id);
        teamsScheduledThisWeek.add(away.id);

        const pairKey = home.id < away.id ? `${home.id}-${away.id}` : `${away.id}-${home.id}`;
        if (pairingKeys.has(pairKey)) {
          throw new Error("Round robin generation error: duplicate team pairing detected.");
        }
        pairingKeys.add(pairKey);

        const createdMatch = await tx.match.create({
          data: {
            type: "ROUNDROBIN",
            title: `Week ${week}`,
            semanas: week,
            bestOf: 5,
            status: "SCHEDULED",
            tournamentId,
            teamAId: home.id,
            teamBId: away.id,
            allowedMaps: {
              connect: maps.map((m) => ({ id: m.id })),
            },
          },
        });
        created.push(createdMatch);
      }

      const fixed = rotation[0];
      const moving = rotation.slice(1);
      moving.unshift(moving.pop());
      rotation = [fixed, ...moving];
    }

    if (pairingKeys.size !== expectedPairings) {
      throw new Error(
        `Round robin generation error: expected ${expectedPairings} unique pairings, generated ${pairingKeys.size}.`
      );
    }

    return created;
  });
};

const submitResult = async (id, winnerTeamId) => {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({
      where: { id },
      include: {
        draft: {
          include: {
            actions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!match) {
      throw new Error("Match not found.");
    }

    const hasWinner = winnerTeamId !== null && winnerTeamId !== undefined;

    if (hasWinner && winnerTeamId !== match.teamAId && winnerTeamId !== match.teamBId) {
      throw new Error("winnerTeamId must be one of the match teams.");
    }

    // gameNumber starts at 0, increments AFTER each game. So current game being played is gameNumber+1.
    // But after createDraft, gameNumber is 0, meaning game 1 is about to start.
    // After submitResult for game 1, gameNumber becomes 1.
    // The "current game being reported" is match.gameNumber + 1 (1-indexed).
    const currentGameBeingReported = match.gameNumber + 1;
    const requiredWins = Math.ceil(match.bestOf / 2);

    const nextMapWinsA =
      hasWinner && winnerTeamId === match.teamAId
        ? match.mapWinsTeamA + 1
        : match.mapWinsTeamA;
    const nextMapWinsB =
      hasWinner && winnerTeamId === match.teamBId
        ? match.mapWinsTeamB + 1
        : match.mapWinsTeamB;

    // Match is finished when someone reaches required wins OR we've played all bestOf games
    const isFinished =
      nextMapWinsA >= requiredWins ||
      nextMapWinsB >= requiredWins;

    // For next turn: loser picks next map. On draw, alternate.
    const pickForCurrentGame = match.draft?.actions?.find(
      (a) => a.action === "PICK" && a.gameNumber === currentGameBeingReported
    );
    const pickerTeamId = pickForCurrentGame?.teamId;

    let nextTurnTeamId;
    if (hasWinner) {
      nextTurnTeamId = winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
    } else {
      // Draw: team that didn't pick this map picks next
      nextTurnTeamId =
        pickerTeamId === match.teamAId ? match.teamBId : match.teamAId;
    }

    const mapResults = Array.isArray(match.mapResults) ? match.mapResults : [];
    const mapId = match.draft?.currentMapId || null;
    const nextMapResults = [
      ...mapResults,
      {
        gameNumber: currentGameBeingReported,
        mapId,
        winnerTeamId: hasWinner ? winnerTeamId : null,
        isDraw: !hasWinner,
      },
    ];

    if (hasWinner) {
      const losingTeamId =
        winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
      await tx.team.update({
        where: { id: winnerTeamId },
        data: { mapWins: { increment: 1 } },
      });
      await tx.team.update({
        where: { id: losingTeamId },
        data: { mapLoses: { increment: 1 } },
      });
    }

    const matchWinnerTeamId =
      nextMapWinsA > nextMapWinsB
        ? match.teamAId
        : nextMapWinsB > nextMapWinsA
        ? match.teamBId
        : null;

    if (isFinished && matchWinnerTeamId) {
      await tx.team.update({
        where: { id: matchWinnerTeamId },
        data: { victories: { increment: 1 } },
      });
    }

    const updatedMatch = await tx.match.update({
      where: { id: match.id },
      data: {
        mapWinsTeamA: nextMapWinsA,
        mapWinsTeamB: nextMapWinsB,
        gameNumber: currentGameBeingReported, // store the game just played
        teamAready: 0,
        teamBready: 0,
        mapResults: nextMapResults,
        status: isFinished ? "PENDINGREGISTERS" : "ACTIVE",
      },
      include: {
        draft: {
          include: {
            actions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (match.draft) {
      await tx.draftTable.update({
        where: { id: match.draft.id },
        data: {
          phase: isFinished ? "FINISHED" : "STARTING",
          currentMapId: null,
          currentTurnTeamId: isFinished ? null : nextTurnTeamId,
        },
      });
    }

    return updatedMatch;
  });
};

const undoLastResult = async (id) => {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({
      where: { id },
      include: {
        draft: {
          include: {
            actions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!match) {
      throw new Error("Match not found.");
    }

    if (match.status === "FINISHED") {
      throw new Error("Cannot undo results for a finished match.");
    }

    const mapResults = Array.isArray(match.mapResults) ? match.mapResults : [];
    if (mapResults.length === 0) {
      throw new Error("No results to undo.");
    }

    if (!match.draft) {
      throw new Error("Draft table not found for this match.");
    }

    if (!["STARTING", "FINISHED"].includes(match.draft.phase)) {
      throw new Error("Can only undo before map picking starts.");
    }

    const lastResult = mapResults[mapResults.length - 1];
    const nextMapResults = mapResults.slice(0, -1);
    const hasWinner = !!lastResult.winnerTeamId;

    const winsNeeded = Math.ceil(match.bestOf / 2);
    const matchWinnerTeamId =
      match.mapWinsTeamA > match.mapWinsTeamB
        ? match.teamAId
        : match.mapWinsTeamB > match.mapWinsTeamA
        ? match.teamBId
        : null;

    if (match.status === "PENDINGREGISTERS" && matchWinnerTeamId) {
      await tx.team.update({
        where: { id: matchWinnerTeamId },
        data: { victories: { decrement: 1 } },
      });
    }

    let nextMapWinsA = match.mapWinsTeamA;
    let nextMapWinsB = match.mapWinsTeamB;

    if (hasWinner) {
      if (lastResult.winnerTeamId === match.teamAId) {
        nextMapWinsA = Math.max(0, nextMapWinsA - 1);
      } else if (lastResult.winnerTeamId === match.teamBId) {
        nextMapWinsB = Math.max(0, nextMapWinsB - 1);
      }

      const losingTeamId =
        lastResult.winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;

      await tx.team.update({
        where: { id: lastResult.winnerTeamId },
        data: { mapWins: { decrement: 1 } },
      });
      await tx.team.update({
        where: { id: losingTeamId },
        data: { mapLoses: { decrement: 1 } },
      });
    }

    const nextGameNumber = Math.max(0, (match.gameNumber || 0) - 1);

    const updatedMatch = await tx.match.update({
      where: { id: match.id },
      data: {
        mapWinsTeamA: nextMapWinsA,
        mapWinsTeamB: nextMapWinsB,
        gameNumber: nextGameNumber,
        teamAready: 0,
        teamBready: 0,
        mapResults: nextMapResults,
        status: "ACTIVE",
      },
      include: {
        draft: {
          include: {
            actions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    await tx.draftTable.update({
      where: { id: match.draft.id },
      data: {
        phase: "ENDMAP",
        phaseStartedAt: new Date(),
        currentMapId: lastResult.mapId,
        currentTurnTeamId: null,
      },
    });

    return updatedMatch;
  });
};

const findSoonest = () => {
  return prisma.match.findFirst({
    orderBy: { startDate: "asc" },
    where: { status: "SCHEDULED", startDate: { not: null } },
  });
};

const finishPendingRegisters = async (id) => {
  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) {
    throw new Error("Match not found.");
  }
  if (match.status !== "PENDINGREGISTERS") {
    throw new Error("Only matches in PENDINGREGISTERS can be marked as FINISHED.");
  }

  return prisma.match.update({
    where: { id },
    data: { status: "FINISHED" },
  });
};

const bulkCreateUsers = async (usersData) => {
  // usersData: Array<{ nickname, user, passwordHash, teamId }>
  const created = [];
  for (const userData of usersData) {
    const member = await prisma.member.create({ data: userData });
    created.push(member);
  }
  return created;
};

module.exports = {
  findById,
  findAll,
  create,
  update,
  remove,
  generateRoundRobin,
  submitResult,
  undoLastResult,
  findSoonest,
  finishPendingRegisters,
  bulkCreateUsers,
};
