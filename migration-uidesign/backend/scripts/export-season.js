const fs = require("fs");
const path = require("path");
const prisma = require("../config/prisma");
const teamRepository = require("../repositories/team");

const projectRoot = path.resolve(__dirname, "../..");
const historyRoot = path.join(projectRoot, "frontend", "src", "data", "history");

function parseArguments(argv = process.argv.slice(2)) {
  const options = { season: null, tournamentId: null, outputPath: null, purge: false, purgeOnly: false };
  for (const argument of argv) {
    if (argument.startsWith("--season=")) options.season = Number(argument.slice(9));
    if (argument.startsWith("--tournament=")) options.tournamentId = Number(argument.slice(13));
    if (argument.startsWith("--output=")) options.outputPath = path.resolve(argument.slice(9));
    if (argument === "--purge") options.purge = true;
    if (argument === "--purge-only") options.purgeOnly = true;
  }
  if (!Number.isInteger(options.season) || options.season < 1) {
    throw new Error("--season must be a positive integer.");
  }
  if (!Number.isInteger(options.tournamentId) || options.tournamentId < 1) {
    throw new Error("--tournament must be a positive integer.");
  }
  if (options.purge && options.purgeOnly) {
    throw new Error("Use either --purge or --purge-only, not both.");
  }
  options.outputPath ||= path.join(historyRoot, `season-${options.season}.json`);
  return options;
}

function uniqueSortedMemberIds(values) {
  return [...new Set(values.map(Number).filter(Number.isInteger))].sort((left, right) => left - right);
}

function exportedMemberIds(archive) {
  return uniqueSortedMemberIds(
    (archive?.teams || []).flatMap((team) => (team.players || []).map((player) => player.memberId))
  );
}

function reconcileMemberIds(archive, seasonPlayers) {
  const exported = exportedMemberIds(archive);
  const stored = uniqueSortedMemberIds(seasonPlayers.map((player) => player.memberId));
  const matches = exported.length === stored.length && exported.every((memberId, index) => memberId === stored[index]);
  return { matches, exported, stored };
}

function readArchive(outputPath) {
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Refusing to purge: export is missing at ${outputPath}.`);
  }
  try {
    return JSON.parse(fs.readFileSync(outputPath, "utf8"));
  } catch (error) {
    throw new Error(`Refusing to purge: export is unreadable (${error.message}).`);
  }
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function buildPlayerLeaderboard(stats, seasonPlayerByMemberId, teamById) {
  const metrics = ["damagePer10", "mitigationPer10", "healingPer10", "assistsPer10", "deathsPer10", "killsPer10"];
  const byPlayer = new Map();
  for (const stat of stats) {
    const seasonPlayer = seasonPlayerByMemberId.get(stat.userId);
    if (!seasonPlayer) continue;
    const current = byPlayer.get(stat.userId) || {
      memberId: stat.userId,
      player: seasonPlayer.member.nickname || seasonPlayer.member.username,
      profileImage: seasonPlayer.member.avatarUrl || seasonPlayer.member.profilePic || null,
      team: teamById.get(seasonPlayer.teamId)?.name || null,
      games: 0,
      mapKeys: new Set(),
      roleCounts: { TANK: 0, DPS: 0, SUPPORT: 0 },
      ...Object.fromEntries(metrics.map((metric) => [metric, 0])),
    };
    const previousGames = current.games;
    current.games += 1;
    current.mapKeys.add(`${stat.matchId}:${stat.gameNumber}`);
    current.roleCounts[stat.role] = (current.roleCounts[stat.role] || 0) + 1;
    for (const metric of metrics) {
      current[metric] = (current[metric] * previousGames + Number(stat[metric] || 0)) / current.games;
    }
    byPlayer.set(stat.userId, current);
  }
  return [...byPlayer.values()]
    .map(({ mapKeys, roleCounts, ...player }) => ({
      ...player,
      mapsPlayed: mapKeys.size,
      role: Object.entries(roleCounts).sort((left, right) => right[1] - left[1])[0]?.[0] || "DPS",
      ...Object.fromEntries(metrics.map((metric) => [metric, round2(player[metric])])),
    }))
    .sort((left, right) => right.killsPer10 - left.killsPer10 || left.player.localeCompare(right.player));
}

function matchArchive(match) {
  return {
    id: match.id,
    round: match.playoffRound,
    slot: match.playoffSlot,
    type: match.type,
    title: match.title,
    status: match.status,
    startDate: match.startDate?.toISOString() || null,
    bestOf: match.bestOf,
    score: { teamA: match.mapWinsTeamA, teamB: match.mapWinsTeamB },
    teamA: { id: match.teamA.id, name: match.teamA.name, logo: match.teamA.logo },
    teamB: { id: match.teamB.id, name: match.teamB.name, logo: match.teamB.logo },
  };
}

function grandFinalArchive(match) {
  if (!match || match.status !== "FINISHED" || match.mapWinsTeamA === match.mapWinsTeamB) return null;
  const teamAWon = match.mapWinsTeamA > match.mapWinsTeamB;
  const champion = teamAWon ? match.teamA : match.teamB;
  const runnerUp = teamAWon ? match.teamB : match.teamA;
  return {
    matchId: match.id,
    playedAt: match.startDate?.toISOString() || null,
    bestOf: match.bestOf,
    champion: {
      id: champion.id,
      name: champion.name,
      logo: champion.logo,
      score: teamAWon ? match.mapWinsTeamA : match.mapWinsTeamB,
    },
    runnerUp: {
      id: runnerUp.id,
      name: runnerUp.name,
      logo: runnerUp.logo,
      score: teamAWon ? match.mapWinsTeamB : match.mapWinsTeamA,
    },
    mvp: null,
  };
}

async function buildArchive(options) {
  const tournament = await prisma.tournament.findUnique({ where: { id: options.tournamentId } });
  if (!tournament) throw new Error(`Tournament ${options.tournamentId} was not found.`);

  const [standings, teams, seasonPlayers, stats, playoffMatches] = await Promise.all([
    teamRepository.findLeaderboard(tournament.id),
    prisma.team.findMany({ where: { tournamentId: tournament.id }, orderBy: { name: "asc" } }),
    prisma.seasonPlayer.findMany({
      where: { tournamentId: tournament.id },
      include: { member: { select: { id: true, username: true, nickname: true, avatarUrl: true, profilePic: true } } },
      orderBy: [{ teamId: "asc" }, { memberId: "asc" }],
    }),
    prisma.playerStat.findMany({
      where: { match: { tournamentId: tournament.id, status: "FINISHED" } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.match.findMany({
      where: {
        tournamentId: tournament.id,
        OR: [{ playoffRound: { not: null } }, { type: { in: ["PLAYINS", "PLAYOFFS", "SEMIFINALS", "FINALS"] } }],
      },
      include: {
        teamA: { select: { id: true, name: true, logo: true } },
        teamB: { select: { id: true, name: true, logo: true } },
      },
      orderBy: [{ playoffRound: "asc" }, { playoffSlot: "asc" }, { startDate: "asc" }],
    }),
  ]);

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const seasonPlayerByMemberId = new Map(seasonPlayers.map((player) => [player.memberId, player]));
  const archivedTeams = teams.map((team) => ({
    id: team.id,
    name: team.name,
    logo: team.logo,
    rosterImage: team.roster,
    record: { wins: team.victories, losses: team.defeats, mapWins: team.mapWins, mapLosses: team.mapLoses },
    playoffSeed: team.playoffSeed,
    players: seasonPlayers
      .filter((player) => player.teamId === team.id)
      .map((player) => ({
        memberId: player.memberId,
        name: player.member.nickname || player.member.username,
        role: player.role,
        profileImage: player.member.avatarUrl || player.member.profilePic || null,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  }));
  const finalMatch = [...playoffMatches].reverse().find((match) => match.type === "FINALS") || null;

  return {
    schemaVersion: 2,
    season: options.season,
    slug: `season-${options.season}`,
    title: tournament.name,
    status: tournament.state === "FINISHED" ? "complete" : "in-progress",
    archivedAt: new Date().toISOString(),
    tournament: { id: tournament.id, name: tournament.name, startDate: tournament.startDate.toISOString(), finalState: tournament.state },
    standings: standings.map((team, index) => ({
      rank: index + 1,
      teamId: team.id,
      team: team.name,
      logo: team.logo,
      wins: team.victories,
      losses: team.defeats,
      mapWins: team.mapWins,
      mapLosses: team.mapLoses,
      mapDifferential: Number(team.mapWins || 0) - Number(team.mapLoses || 0),
    })),
    teams: archivedTeams,
    playerLeaderboard: buildPlayerLeaderboard(stats, seasonPlayerByMemberId, teamById),
    playoffs: playoffMatches.map(matchArchive),
    grandFinal: grandFinalArchive(finalMatch),
  };
}

async function purgeSeasonPlayers(options) {
  const tournament = await prisma.tournament.findUnique({ where: { id: options.tournamentId } });
  if (!tournament) throw new Error(`Refusing to purge: tournament ${options.tournamentId} was not found.`);
  if (tournament.state !== "FINISHED") {
    throw new Error(`Refusing to purge: ${tournament.name} is not FINISHED.`);
  }
  const archive = readArchive(options.outputPath);
  if (archive?.tournament?.id !== tournament.id) {
    throw new Error(`Refusing to purge: export tournament ${archive?.tournament?.id ?? "is missing"}; expected ${tournament.id}.`);
  }
  const seasonPlayers = await prisma.seasonPlayer.findMany({
    where: { tournamentId: tournament.id },
    select: { memberId: true },
  });
  const reconciliation = reconcileMemberIds(archive, seasonPlayers);
  console.log(`PARTICIPANT_RECONCILIATION export=${reconciliation.exported.length} database=${reconciliation.stored.length}`);
  if (!reconciliation.matches) {
    throw new Error(
      `Refusing to purge: participant mismatch (export=${reconciliation.exported.length}, database=${reconciliation.stored.length}).`
    );
  }

  // PlayerStat.seasonPlayerId uses ON DELETE SET NULL. Purging these temporary rows is safe only
  // because this verified season JSON is the durable historical record.
  return prisma.seasonPlayer.deleteMany({ where: { tournamentId: tournament.id } });
}

async function main() {
  const options = parseArguments();
  if (!options.purgeOnly) {
    const archive = await buildArchive(options);
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, `${JSON.stringify(archive, null, 2)}\n`);
    console.log(JSON.stringify({ outputPath: options.outputPath, participants: exportedMemberIds(archive).length }, null, 2));
  }
  if (options.purge || options.purgeOnly) {
    const result = await purgeSeasonPlayers(options);
    console.log(JSON.stringify({ purgedSeasonPlayers: result.count }, null, 2));
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { __testables: { parseArguments, exportedMemberIds, reconcileMemberIds } };
