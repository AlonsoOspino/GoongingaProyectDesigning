const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const prisma = require("../config/prisma");
const teamRepository = require("../repositories/team");

const projectRoot = path.resolve(__dirname, "../..");
const frontendRoot = path.join(projectRoot, "frontend");
const historyDataRoot = path.join(frontendRoot, "src", "data", "history");
const historyPublicRoot = path.join(frontendRoot, "public", "history");

function parseArguments() {
  const options = { season: 8, tournamentId: null, downloadMedia: true };
  for (const argument of process.argv.slice(2)) {
    if (argument.startsWith("--season=")) options.season = Number(argument.slice(9));
    if (argument.startsWith("--tournament=")) options.tournamentId = Number(argument.slice(13));
    if (argument === "--skip-media") options.downloadMedia = false;
  }

  if (!Number.isInteger(options.season) || options.season < 1) {
    throw new Error("--season must be a positive integer.");
  }
  if (options.tournamentId !== null && (!Number.isInteger(options.tournamentId) || options.tournamentId < 1)) {
    throw new Error("--tournament must be a positive integer.");
  }
  return options;
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function buildPlayerLeaderboard(stats) {
  const byPlayer = new Map();
  const metrics = [
    "damagePer10",
    "mitigationPer10",
    "healingPer10",
    "assistsPer10",
    "deathsPer10",
    "killsPer10",
  ];

  for (const stat of stats) {
    const current = byPlayer.get(stat.userId) || {
      legacyUserId: stat.userId,
      player: stat.user?.nickname || `Player ${stat.userId}`,
      profileImage: stat.user?.profilePic || null,
      team: stat.user?.team?.name || null,
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

function extensionFromContentType(contentType) {
  const normalized = String(contentType || "").split(";")[0].trim().toLowerCase();
  return {
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
  }[normalized] || "";
}

function safeExtension(sourceUrl, contentType) {
  try {
    const fromUrl = path.extname(new URL(sourceUrl, "http://local").pathname).toLowerCase();
    if (/^\.[a-z0-9]{2,5}$/.test(fromUrl)) return fromUrl;
  } catch {
    // Fall through to the response content type.
  }
  return extensionFromContentType(contentType) || ".bin";
}

function cleanSegment(value) {
  return String(value || "asset")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "asset";
}

function readFrontendEnvironment() {
  const envPath = path.join(frontendRoot, ".env.local");
  if (!fs.existsSync(envPath)) return { apiBase: "", blobToken: "" };
  const values = Object.fromEntries(
    fs.readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .filter((entry) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(entry))
      .map((entry) => {
        const separator = entry.indexOf("=");
        return [entry.slice(0, separator), entry.slice(separator + 1).trim()];
      })
  );
  return {
    apiBase: String(values.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, ""),
    blobToken: String(values.BLOB_READ_WRITE_TOKEN || ""),
  };
}

async function persistAsset(sourceUrl, category, name, seasonRoot, frontendEnvironment, downloadMedia) {
  if (typeof sourceUrl !== "string" || !sourceUrl.trim()) return null;
  const source = sourceUrl.trim();
  if (!downloadMedia) return source;

  let resolvedSource = source;
  if (source.startsWith("/uploads/") && frontendEnvironment.apiBase) {
    resolvedSource = `${frontendEnvironment.apiBase}${source}`;
  }

  try {
    let buffer;
    let contentType = "";
    if (/^https?:\/\//i.test(resolvedSource)) {
      const isVercelBlob = new URL(resolvedSource).hostname.endsWith("blob.vercel-storage.com");
      const response = await fetch(resolvedSource, {
        headers: isVercelBlob && frontendEnvironment.blobToken
          ? { Authorization: `Bearer ${frontendEnvironment.blobToken}` }
          : undefined,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
      contentType = response.headers.get("content-type") || "";
    } else {
      const candidates = [
        path.join(projectRoot, "media", source.replace(/^\/uploads\//, "")),
        path.join(projectRoot, "backend", "uploads", source.replace(/^\/uploads\//, "")),
        path.join(frontendRoot, "public", source.replace(/^\//, "")),
      ];
      const localPath = candidates.find((candidate) => fs.existsSync(candidate));
      if (!localPath) throw new Error("local file not found");
      buffer = fs.readFileSync(localPath);
    }

    const digest = crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 8);
    const extension = safeExtension(resolvedSource, contentType);
    const relativeDirectory = path.join(category);
    const fileName = `${cleanSegment(name)}-${digest}${extension}`;
    const outputDirectory = path.join(seasonRoot, relativeDirectory);
    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(path.join(outputDirectory, fileName), buffer);
    return `/history/${path.basename(seasonRoot)}/${relativeDirectory.replace(/\\/g, "/")}/${fileName}`;
  } catch (error) {
    console.warn(`[archive-season] Keeping remote reference for ${category}/${name}: ${error.message}`);
    return source;
  }
}

async function localizeWrappedAssets(assets, seasonRoot, frontendEnvironment, downloadMedia) {
  const source = assets && typeof assets === "object" ? assets : {};
  const localized = JSON.parse(JSON.stringify(source));

  for (const [key, value] of Object.entries(source.images || {})) {
    localized.images[key] = await persistAsset(value, "wrapped/images", key, seasonRoot, frontendEnvironment, downloadMedia);
  }
  for (const [key, value] of Object.entries(source.videos || {})) {
    localized.videos[key] = await persistAsset(value, "wrapped/videos", key, seasonRoot, frontendEnvironment, downloadMedia);
  }
  for (const [key, values] of Object.entries(source.storyAudios || {})) {
    localized.storyAudios[key] = [];
    for (let index = 0; index < values.length; index += 1) {
      localized.storyAudios[key].push(
        await persistAsset(values[index], "wrapped/story-audio", `${key}-${index + 1}`, seasonRoot, frontendEnvironment, downloadMedia)
      );
    }
  }
  for (const [key, track] of Object.entries(source.soundtrack || {})) {
    if (!track?.url) continue;
    localized.soundtrack[key] = {
      ...track,
      url: await persistAsset(track.url, "wrapped/soundtrack", key, seasonRoot, frontendEnvironment, downloadMedia),
    };
  }
  return localized;
}

async function main() {
  const options = parseArguments();
  const tournament = options.tournamentId
    ? await prisma.tournament.findUnique({ where: { id: options.tournamentId } })
    : await prisma.tournament.findFirst({ orderBy: { id: "desc" } });
  if (!tournament) throw new Error("No tournament was found to archive.");

  const [wrappedRecord, standings, teams, stats, playoffMatches] = await Promise.all([
    prisma.wrapped.findUnique({ where: { tournamentId: tournament.id } }),
    teamRepository.findLeaderboard(tournament.id),
    prisma.team.findMany({
      where: { tournamentId: tournament.id },
      include: {
        members: {
          select: { id: true, nickname: true, profilePic: true, role: true },
          orderBy: { nickname: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.playerStat.findMany({
      where: { match: { tournamentId: tournament.id, status: "FINISHED" } },
      select: {
        userId: true,
        matchId: true,
        gameNumber: true,
        role: true,
        damagePer10: true,
        mitigationPer10: true,
        healingPer10: true,
        assistsPer10: true,
        deathsPer10: true,
        killsPer10: true,
        user: {
          select: {
            nickname: true,
            profilePic: true,
            team: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.match.findMany({
      where: {
        tournamentId: tournament.id,
        OR: [
          { playoffRound: { not: null } },
          { type: { in: ["PLAYINS", "PLAYOFFS", "SEMIFINALS", "FINALS"] } },
        ],
      },
      include: {
        teamA: { select: { id: true, name: true, logo: true } },
        teamB: { select: { id: true, name: true, logo: true } },
      },
      orderBy: [{ playoffRound: "asc" }, { playoffSlot: "asc" }, { startDate: "asc" }],
    }),
  ]);

  const seasonSlug = `season-${options.season}`;
  const seasonPublicRoot = path.join(historyPublicRoot, seasonSlug);
  fs.mkdirSync(historyDataRoot, { recursive: true });
  fs.mkdirSync(seasonPublicRoot, { recursive: true });
  const frontendEnvironment = readFrontendEnvironment();

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const archivedTeams = [];
  for (const team of teams) {
    archivedTeams.push({
      id: team.id,
      name: team.name,
      logo: await persistAsset(team.logo, "teams/logos", team.name, seasonPublicRoot, frontendEnvironment, options.downloadMedia),
      rosterImage: await persistAsset(team.roster, "teams/rosters", team.name, seasonPublicRoot, frontendEnvironment, options.downloadMedia),
      record: { wins: team.victories, losses: team.defeats, mapWins: team.mapWins, mapLosses: team.mapLoses },
      playoffSeed: team.playoffSeed,
      players: await Promise.all(team.members.map(async (member) => ({
        legacyUserId: member.id,
        name: member.nickname,
        role: member.role,
        profileImage: await persistAsset(
          member.profilePic,
          "players",
          `${team.name}-${member.nickname}`,
          seasonPublicRoot,
          frontendEnvironment,
          options.downloadMedia
        ),
      }))),
    });
  }

  const playerLeaderboard = buildPlayerLeaderboard(stats);
  for (const row of playerLeaderboard) {
    row.profileImage = await persistAsset(
      row.profileImage,
      "players",
      row.player,
      seasonPublicRoot,
      frontendEnvironment,
      options.downloadMedia
    );
  }

  if (!wrappedRecord) throw new Error("This pre-migration database does not contain a Wrapped snapshot.");
  const wrappedSnapshot = wrappedRecord.snapshot;
  const wrappedAssets = await localizeWrappedAssets(
    wrappedRecord?.assets || {},
    seasonPublicRoot,
    frontendEnvironment,
    options.downloadMedia
  );

  const archive = {
    schemaVersion: 1,
    season: options.season,
    slug: seasonSlug,
    title: `Goonginga Season ${options.season}`,
    status: "complete",
    archivedAt: new Date().toISOString(),
    tournament: {
      legacyId: tournament.id,
      name: tournament.name,
      startDate: tournament.startDate.toISOString(),
      finalState: tournament.state,
    },
    standings: standings.map((team, index) => ({
      rank: index + 1,
      teamId: team.id,
      team: team.name,
      logo: archivedTeams.find((entry) => entry.id === team.id)?.logo || team.logo,
      wins: team.victories,
      losses: team.defeats,
      mapWins: team.mapWins,
      mapLosses: team.mapLoses,
      mapDifferential: Number(team.mapWins || 0) - Number(team.mapLoses || 0),
    })),
    teams: archivedTeams,
    playerLeaderboard,
    playoffs: playoffMatches.map((match) => ({
      legacyId: match.id,
      round: match.playoffRound,
      slot: match.playoffSlot,
      type: match.type,
      title: match.title,
      status: match.status,
      startDate: match.startDate?.toISOString() || null,
      bestOf: match.bestOf,
      score: { teamA: match.mapWinsTeamA, teamB: match.mapWinsTeamB },
      teamA: {
        id: match.teamA.id,
        name: match.teamA.name,
        logo: archivedTeams.find((entry) => entry.id === match.teamA.id)?.logo || match.teamA.logo,
      },
      teamB: {
        id: match.teamB.id,
        name: match.teamB.name,
        logo: archivedTeams.find((entry) => entry.id === match.teamB.id)?.logo || match.teamB.logo,
      },
    })),
    wrapped: {
      legacyId: wrappedRecord?.id || null,
      generatedAt: wrappedRecord?.generatedAt?.toISOString() || wrappedSnapshot.generatedAt,
      snapshot: wrappedSnapshot,
      assets: wrappedAssets,
    },
  };

  for (const team of archive.teams) {
    const original = teamById.get(team.id);
    if (!original) continue;
    delete original.members;
  }

  const outputPath = path.join(historyDataRoot, `${seasonSlug}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(archive, null, 2)}\n`);
  console.log(JSON.stringify({
    outputPath,
    mediaPath: seasonPublicRoot,
    teams: archive.teams.length,
    players: archive.playerLeaderboard.length,
    playoffMatches: archive.playoffs.length,
    wrappedMedia: {
      images: Object.keys(wrappedAssets.images || {}).length,
      videos: Object.keys(wrappedAssets.videos || {}).length,
      storyAudioGroups: Object.keys(wrappedAssets.storyAudios || {}).length,
      soundtrackTracks: Object.keys(wrappedAssets.soundtrack || {}).length,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
