const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const prisma = require("../config/prisma");

const verificationRoot = path.resolve(__dirname, "../../.local-dev/run-a2-export");

function runExport(arguments_) {
  const result = spawnSync(process.execPath, ["-r", "dotenv/config", "scripts/export-season.js", ...arguments_], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

async function main() {
  const database = await prisma.$queryRaw`SELECT current_database() AS name`;
  if (database[0]?.name !== "goonginga_dev") {
    throw new Error(`Refusing verification against ${database[0]?.name || "an unknown database"}.`);
  }
  const members = await prisma.networkMember.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
    take: 4,
    orderBy: { id: "asc" },
  });
  if (members.length < 4) throw new Error("Four active members are required for export verification.");

  fs.mkdirSync(verificationRoot, { recursive: true });
  const validPath = path.join(verificationRoot, "season-99.json");
  const missingPath = path.join(verificationRoot, "missing.json");
  const wrongTournamentPath = path.join(verificationRoot, "wrong-tournament.json");
  const missingParticipantPath = path.join(verificationRoot, "missing-participant.json");
  for (const filePath of [validPath, missingPath, wrongTournamentPath, missingParticipantPath]) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  const tournament = await prisma.tournament.create({
    data: { name: `Disposable export verification ${Date.now()}`, startDate: new Date(), state: "FINISHED" },
  });
  try {
    const [teamA, teamB] = await Promise.all([
      prisma.team.create({ data: { name: `Disposable A ${tournament.id}`, tournamentId: tournament.id } }),
      prisma.team.create({ data: { name: `Disposable B ${tournament.id}`, tournamentId: tournament.id } }),
    ]);
    await prisma.match.create({
      data: {
        type: "FINALS",
        bestOf: 7,
        status: "FINISHED",
        tournamentId: tournament.id,
        teamAId: teamA.id,
        teamBId: teamB.id,
        mapWinsTeamA: 4,
        mapWinsTeamB: 2,
        playoffRound: 3,
        playoffSlot: 1,
      },
    });
    await prisma.seasonPlayer.createMany({
      data: [
        { tournamentId: tournament.id, teamId: teamA.id, memberId: members[0].id, role: "CAPTAIN" },
        { tournamentId: tournament.id, teamId: teamA.id, memberId: members[1].id, role: "PLAYER" },
        { tournamentId: tournament.id, teamId: teamB.id, memberId: members[2].id, role: "CAPTAIN" },
        { tournamentId: tournament.id, teamId: null, memberId: members[3].id, role: "PLAYER" },
      ],
    });

    const baseArguments = ["--season=99", `--tournament=${tournament.id}`];
    const exported = runExport([...baseArguments, `--output=${validPath}`]);
    console.log("EXPORT", JSON.stringify(exported));
    const archive = JSON.parse(fs.readFileSync(validPath, "utf8"));
    console.log("EXPORT_SHAPE", JSON.stringify({
      schemaVersion: archive.schemaVersion,
      wrappedPresent: Object.hasOwn(archive, "wrapped"),
      tournamentId: archive.tournament.id,
      participants: archive.teams.flatMap((team) => team.players).length,
      unassignedParticipants: archive.unassignedParticipants.map((player) => player.memberId),
    }));

    await prisma.tournament.update({ where: { id: tournament.id }, data: { state: "SCHEDULED" } });
    console.log("GATE_NOT_FINISHED", JSON.stringify(runExport([...baseArguments, `--output=${validPath}`, "--purge-only"])));
    await prisma.tournament.update({ where: { id: tournament.id }, data: { state: "FINISHED" } });

    console.log("GATE_MISSING", JSON.stringify(runExport([...baseArguments, `--output=${missingPath}`, "--purge-only"])));

    fs.writeFileSync(wrongTournamentPath, JSON.stringify({ ...archive, tournament: { ...archive.tournament, id: tournament.id + 1000 } }));
    console.log("GATE_TOURNAMENT", JSON.stringify(runExport([...baseArguments, `--output=${wrongTournamentPath}`, "--purge-only"])));

    const incomplete = JSON.parse(JSON.stringify(archive));
    const teamWithPlayers = incomplete.teams.find((team) => team.players.length > 0);
    teamWithPlayers.players.pop();
    fs.writeFileSync(missingParticipantPath, JSON.stringify(incomplete));
    console.log("GATE_PARTICIPANTS", JSON.stringify(runExport([...baseArguments, `--output=${missingParticipantPath}`, "--purge-only"])));

    const purged = runExport([...baseArguments, `--output=${validPath}`, "--purge-only"]);
    console.log("TRUSTED_EXPORT_THEN_PURGE", JSON.stringify(purged));
    const counts = {
      seasonPlayers: await prisma.seasonPlayer.count({ where: { tournamentId: tournament.id } }),
      tournaments: await prisma.tournament.count({ where: { id: tournament.id } }),
      teams: await prisma.team.count({ where: { tournamentId: tournament.id } }),
      matches: await prisma.match.count({ where: { tournamentId: tournament.id } }),
    };
    console.log("POST_PURGE_COUNTS", JSON.stringify(counts));
  } finally {
    await prisma.match.deleteMany({ where: { tournamentId: tournament.id } });
    await prisma.team.deleteMany({ where: { tournamentId: tournament.id } });
    await prisma.tournament.delete({ where: { id: tournament.id } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
