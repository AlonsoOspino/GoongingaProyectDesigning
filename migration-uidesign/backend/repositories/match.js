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
const remove = (id) => prisma.match.delete({ where: { id } });
const generateRoundRobin = async (tournamentId) => {
  const teams = await prisma.team.findMany({
    where: { tournamentId },
    orderBy: { id: "asc" },
  });

  if (teams.length < 2) {
    throw new Error("At least 2 teams are required for round robin generation.");
  }

  const maps = await prisma.map.findMany({ select: { id: true } });
  const rounds = teams.length - 1;

  const created = [];
  let pairIndex = 0;

  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      const week = (pairIndex % rounds) + 1;
      const startDate = new Date(Date.now() + week * 24 * 60 * 60 * 1000);

      const match = await prisma.match.create({
        data: {
          type: "ROUNDROBIN",
          title: `Week ${week}`,
          semanas: week,
          bestOf: 1,
          status: "SCHEDULED",
          startDate,
          tournamentId,
          teamAId: teams[i].id,
          teamBId: teams[j].id,
          allowedMaps: {
            connect: maps.map((m) => ({ id: m.id })),
          },
        },
      });

      created.push(match);
      pairIndex += 1;
    }
  }

  return created;
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

    const currentGame = Number.isInteger(match.gameNumber) && match.gameNumber > 0 ? match.gameNumber : 1;
    const requiredWins = Math.floor(match.bestOf / 2) + 1;

    const nextMapWinsA = hasWinner && winnerTeamId === match.teamAId ? match.mapWinsTeamA + 1 : match.mapWinsTeamA;
    const nextMapWinsB = hasWinner && winnerTeamId === match.teamBId ? match.mapWinsTeamB + 1 : match.mapWinsTeamB;
    const playedMapsAfter = currentGame;
    const isFinished =
      nextMapWinsA >= requiredWins ||
      nextMapWinsB >= requiredWins ||
      playedMapsAfter >= match.bestOf;

    const pickForCurrentGame = match.draft?.actions?.find(
      (a) => a.action === "PICK" && a.gameNumber === currentGame
    );
    const pickerTeamId = pickForCurrentGame?.teamId;
    const loserTeamId = hasWinner
      ? winnerTeamId === match.teamAId
        ? match.teamBId
        : match.teamAId
      : pickerTeamId
        ? (pickerTeamId === match.teamAId ? match.teamBId : match.teamAId)
        : match.teamAId;

    const mapResults = Array.isArray(match.mapResults) ? match.mapResults : [];
    const mapId = match.draft?.currentMapId || null;
    const nextMapResults = [
      ...mapResults,
      {
        gameNumber: currentGame,
        mapId,
        winnerTeamId: hasWinner ? winnerTeamId : null,
        isDraw: !hasWinner,
      },
    ];

    if (hasWinner) {
      const losingTeamId = winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
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
      nextMapWinsA > nextMapWinsB ? match.teamAId : nextMapWinsB > nextMapWinsA ? match.teamBId : null;

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
        gameNumber: currentGame + 1,
        teamAready: 0,
        teamBready: 0,
        mapResults: nextMapResults,
        status: isFinished ? "FINISHED" : "ACTIVE",
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
          currentTurnTeamId: isFinished ? null : loserTeamId,
        },
      });
    }

    return updatedMatch;
  });
};
const findSoonest = () => {
  return prisma.match.findFirst({
    orderBy: { startDate: "asc" },
    where: { status: "SCHEDULED" }
  });
}
module.exports = {
  findById,
  findAll,
  create,
  update,
  remove,
  generateRoundRobin,
  submitResult,
  findSoonest
};
