const playerStatRepo = require("../repositories/playerStat");
const networkMemberRepo = require("../repositories/networkMember");
const prisma = require("../config/prisma");

const MAP_TYPES = ["CONTROL", "HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"];
const HERO_ROLES = ["TANK", "DPS", "SUPPORT"];

const parseIntStat = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }
  return parsed;
};

const parsePositiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return parsed;
};

const parseEnum = (value, allowed, fieldName) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!allowed.includes(normalized)) {
    throw new Error(`${fieldName} must be one of: ${allowed.join(", ")}.`);
  }
  return normalized;
};

const parseDurationToSeconds = (value) => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  const raw = String(value || "").trim();
  const mmss = raw.match(/^(\d{1,3}):(\d{2})$/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const hhmmss = raw.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (hhmmss) return Number(hhmmss[1]) * 3600 + Number(hhmmss[2]) * 60 + Number(hhmmss[3]);
  throw new Error("gameDuration must be positive seconds or use mm:ss / hh:mm:ss.");
};

const roundFloat = (value) => Math.round(value * 100) / 100;

const buildPer10Stats = ({ gameDuration, damage, healing, mitigation, kills, assists, deaths }) => {
  const effectiveDuration = Math.max(1, Number(gameDuration) || 0);
  const convert = (stat) => roundFloat((Number(stat) / effectiveDuration) * 600);
  return {
    damagePer10: convert(damage),
    healingPer10: convert(healing),
    mitigationPer10: convert(mitigation),
    killsPer10: convert(kills),
    assistsPer10: convert(assists),
    deathsPer10: convert(deaths),
  };
};

const getMatchPlayers = async (matchId) => {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { include: { members: true } },
      teamB: { include: { members: true } },
    },
  });
  if (!match) throw new Error("Match not found.");
  const players = [...(match.teamA?.members || []), ...(match.teamB?.members || [])].map((member) => ({
    id: member.id,
    nickname: member.nickname,
    user: member.user,
    teamId: member.teamId,
  }));
  return { match, players };
};

const ensureUserInMatch = async (matchId, userId) => {
  const { players } = await getMatchPlayers(matchId);
  if (!players.some((player) => player.id === userId)) {
    throw new Error("User does not belong to this match teams.");
  }
};

const validateUser = async (userId) => {
  const parsedUserId = parsePositiveInt(userId, "userId");
  const member = await networkMemberRepo.findById(parsedUserId);
  if (!member) throw new Error("User not found.");
  return parsedUserId;
};

const normalizePayload = async (payload) => {
  if (!payload || typeof payload !== "object") throw new Error("Body is required.");
  const userId = await validateUser(payload.userId);
  const matchId = parsePositiveInt(payload.matchId, "matchId");
  await ensureUserInMatch(matchId, userId);
  const data = {
    userId,
    matchId,
    gameNumber: parsePositiveInt(payload.gameNumber, "gameNumber"),
    damage: parseIntStat(payload.damage, "damage"),
    healing: parseIntStat(payload.healing, "healing"),
    mitigation: parseIntStat(payload.mitigation, "mitigation"),
    kills: parseIntStat(payload.kills, "kills"),
    assists: parseIntStat(payload.assists, "assists"),
    deaths: parseIntStat(payload.deaths, "deaths"),
    gameDuration: parseDurationToSeconds(payload.gameDuration),
    mapType: parseEnum(payload.mapType, MAP_TYPES, "mapType"),
    role: parseEnum(payload.role, HERO_ROLES, "role"),
  };
  return { ...data, ...buildPer10Stats(data) };
};

const create = async (payload) => playerStatRepo.create(await normalizePayload(payload));

const createBatch = async ({ matchId, games }) => {
  const parsedMatchId = parsePositiveInt(matchId, "matchId");
  const { players } = await getMatchPlayers(parsedMatchId);
  const allowedUserIds = new Set(players.map((player) => player.id));
  if (!Array.isArray(games) || games.length < 1 || games.length > 20) throw new Error("games must include between 1 and 20 entries.");

  const normalized = [];
  for (const game of games) {
    const parsedGameNumber = parsePositiveInt(game.gameNumber, "gameNumber");
    if (!Array.isArray(game.rows) || game.rows.length < 1 || game.rows.length > 10) throw new Error(`Game ${parsedGameNumber} must include between 1 and 10 players.`);
    const normalizedMapType = parseEnum(game.mapType, MAP_TYPES, "mapType");
    const normalizedDuration = parseDurationToSeconds(game.gameDuration);
    const submittedIds = new Set();
    for (const row of game.rows) {
      if (row.userId === undefined || row.userId === null || row.userId === "") continue;
      const userId = await validateUser(row.userId);
      if (!allowedUserIds.has(userId)) throw new Error(`User ${userId} does not belong to this match teams.`);
      if (submittedIds.has(userId)) throw new Error(`User ${userId} appears more than once in game ${parsedGameNumber}.`);
      submittedIds.add(userId);
      const data = {
        userId,
        matchId: parsedMatchId,
        gameNumber: parsedGameNumber,
        damage: parseIntStat(row.damage, "damage"),
        healing: parseIntStat(row.healing, "healing"),
        mitigation: parseIntStat(row.mitigation, "mitigation"),
        kills: parseIntStat(row.kills, "kills"),
        assists: parseIntStat(row.assists, "assists"),
        deaths: parseIntStat(row.deaths, "deaths"),
        gameDuration: normalizedDuration,
        mapType: normalizedMapType,
        role: parseEnum(row.role, HERO_ROLES, "role"),
      };
      normalized.push({ ...data, ...buildPer10Stats(data) });
    }
  }
  if (!normalized.length) throw new Error("Select at least one match player before saving stats.");

  return prisma.$transaction(async (tx) => {
    const gameNumbers = [...new Set(normalized.map((data) => data.gameNumber))];
    await tx.playerStat.deleteMany({ where: { matchId: parsedMatchId, gameNumber: { in: gameNumbers } } });
    const created = [];
    for (const data of normalized) created.push(await tx.playerStat.create({ data }));
    return created;
  }, { isolationLevel: "Serializable" });
};

const getAll = async () => playerStatRepo.findAll();
const getByUserId = async (userId) => playerStatRepo.findByUserId(parsePositiveInt(userId, "userId"));
const getAllPublic = async () => playerStatRepo.findAllPublic();
const getPublicByUserId = async (userId) => playerStatRepo.findByUserIdPublic(parsePositiveInt(userId, "userId"));

module.exports = { create, createBatch, getAll, getByUserId, getAllPublic, getPublicByUserId };
