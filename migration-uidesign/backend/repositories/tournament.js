const prisma = require("../config/prisma");

const create = (data) => prisma.tournament.create({ data });

const update = (id, data) =>
  prisma.tournament.update({ where: { id }, data });

const remove = (id) =>
  prisma.tournament.delete({ where: { id } });

const findByName = (name) =>
  prisma.tournament.findFirst({ where: { name } });

const findById = (id) =>
  prisma.tournament.findUnique({ where: { id } });

const findAll = () => prisma.tournament.findMany();

const findActive = () => prisma.tournament.findFirst({
  where: { state: { not: "FINISHED" } },
  orderBy: [{ startDate: "desc" }, { id: "desc" }],
});

const startPlayoffs = (id, seededTeamIds) =>
  prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({ where: { id } });
    if (!tournament) throw new Error("Tournament not found.");
    if (tournament.state !== "ROUNDROBIN") {
      throw new Error("Playoffs can only start from the ROUNDROBIN state.");
    }

    const unfinishedRoundRobin = await tx.match.count({
      where: {
        tournamentId: id,
        type: "ROUNDROBIN",
        status: { not: "FINISHED" },
      },
    });
    if (unfinishedRoundRobin > 0) {
      throw new Error("Finish every round robin match before starting playoffs.");
    }

    const existingPlayoffMatch = await tx.match.findFirst({
      where: { tournamentId: id, playoffRound: { not: null } },
      select: { id: true },
    });
    if (existingPlayoffMatch) {
      throw new Error("This tournament already has a playoff bracket.");
    }

    const maps = await tx.map.findMany({ select: { id: true } });

    await tx.team.updateMany({
      where: { tournamentId: id },
      data: { playoffSeed: null, state: "ELIMINATED" },
    });

    for (let index = 0; index < seededTeamIds.length; index += 1) {
      await tx.team.update({
        where: { id: seededTeamIds[index] },
        data: { playoffSeed: index + 1, state: "ACTIVE" },
      });
    }

    const pairings = [
      [seededTeamIds[0], seededTeamIds[7]],
      [seededTeamIds[1], seededTeamIds[6]],
      [seededTeamIds[2], seededTeamIds[5]],
      [seededTeamIds[3], seededTeamIds[4]],
    ];

    for (let slot = 0; slot < pairings.length; slot += 1) {
      await tx.match.create({
        data: {
          type: "PLAYOFFS",
          title: `Quarterfinal ${slot + 1}`,
          playoffRound: 1,
          playoffSlot: slot + 1,
          bestOf: 5,
          status: "SCHEDULED",
          tournamentId: id,
          teamAId: pairings[slot][0],
          teamBId: pairings[slot][1],
          allowedMaps: { connect: maps.map((map) => ({ id: map.id })) },
        },
      });
    }

    return tx.tournament.update({
      where: { id },
      data: { state: "PLAYOFFS" },
      include: {
        teams: { orderBy: { playoffSeed: "asc" } },
        matches: { where: { playoffRound: { not: null } }, orderBy: { playoffSlot: "asc" } },
      },
    });
  });

module.exports = {
  create,
  update,
  remove,
  findByName,
  findById,
  findAll,
  findActive,
  startPlayoffs,
};
