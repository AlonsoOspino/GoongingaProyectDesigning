const playerStatRepo = require("../repositories/playerStat");
const memberRepo = require("../repositories/member");

const MAP_TYPES = ["CONTROL", "HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"];
const HERO_ROLES = ["TANK", "DPS", "SUPPORT"];

const parseIntStat = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
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
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  const raw = String(value || "").trim();

  // mm:ss
  const mmss = raw.match(/^(\d{1,3}):(\d{2})$/);
  if (mmss) {
    const m = Number(mmss[1]);
    const s = Number(mmss[2]);
    return m * 60 + s;
  }

  // hh:mm:ss
  const hhmmss = raw.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (hhmmss) {
    const h = Number(hhmmss[1]);
    const m = Number(hhmmss[2]);
    const s = Number(hhmmss[3]);
    return h * 3600 + m * 60 + s;
  }

  throw new Error("gameDuration must be seconds or time format mm:ss / hh:mm:ss.");
};

const roundFloat = (value) => Math.round(value * 100) / 100;

const buildPer10Stats = ({
  mapType,
  gameDuration,
  waitTime,
  initialTime,
  extraRounds,
  damage,
  healing,
  mitigation,
  kills,
  assists,
  deaths,
}) => {
  const safeGameDuration = Math.max(0, Number(gameDuration) || 0);
  const safeWait = Math.max(0, Number(waitTime) || 0);
  const safeInitial = Math.max(0, Number(initialTime) || 0);
  const safeExtra = Math.max(0, Number(extraRounds) || 0);

  let effectiveDuration = 1;
  let multiplier = 10;

  if (mapType === "CONTROL") {
    const mapsPlayed = Math.max(1, 1 + safeExtra);
    effectiveDuration = Math.max(1, safeGameDuration - safeWait);
    multiplier = mapsPlayed * 10;
  } else if (mapType === "HYBRID") {
    effectiveDuration = Math.max(1, safeGameDuration - safeInitial - safeWait);
    multiplier = (2 + safeExtra) * 10;
  } else if (mapType === "PAYLOAD") {
    effectiveDuration = Math.max(1, safeGameDuration - safeWait + safeExtra);
    multiplier = 10;
  } else {
    effectiveDuration = Math.max(1, safeGameDuration - safeInitial);
    multiplier = 10;
  }

  const convert = (stat) => roundFloat((Number(stat) / effectiveDuration) * multiplier);

  return {
    effectiveDuration,
    damagePer10: convert(damage),
    healingPer10: convert(healing),
    mitigationPer10: convert(mitigation),
    killsPer10: convert(kills),
    assistsPer10: convert(assists),
    deathsPer10: convert(deaths),
  };
};

const extractFirstNumber = (text, patterns, fieldLabel) => {
  const content = String(text || "");
  for (const p of patterns) {
    const regex = new RegExp(`${p}[^0-9]{0,12}(\\d+)`, "i");
    const m = content.match(regex);
    if (m) return Number(m[1]);
  }
  throw new Error(`Could not detect ${fieldLabel} from OCR text.`);
};

const extractDuration = (text) => {
  const content = String(text || "");

  const labelRegex = /(duration|time|game\s*time)[^0-9]{0,20}(\d{1,2}:\d{2}(?::\d{2})?)/i;
  const labeled = content.match(labelRegex);
  if (labeled) return parseDurationToSeconds(labeled[2]);

  const generic = content.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/);
  if (generic) return parseDurationToSeconds(generic[0]);

  throw new Error("Could not detect gameDuration from OCR text.");
};

const detectMapType = (text) => {
  const content = String(text || "").toUpperCase();
  for (const type of MAP_TYPES) {
    if (content.includes(type)) return type;
  }
  throw new Error("Could not detect mapType from OCR text.");
};

const detectRole = (text) => {
  const content = String(text || "").toUpperCase();
  for (const role of HERO_ROLES) {
    if (content.includes(role)) return role;
  }
  throw new Error("Could not detect role from OCR text.");
};

const validateUser = async (userId) => {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    throw new Error("userId must be a positive integer.");
  }

  const member = await memberRepo.findById(parsedUserId);
  if (!member) {
    throw new Error("User not found.");
  }

  return parsedUserId;
};

const create = async (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Body is required.");
  }

  const userId = await validateUser(payload.userId);

  const data = {
    userId,
    damage: parseIntStat(payload.damage, "damage"),
    healing: parseIntStat(payload.healing, "healing"),
    mitigation: parseIntStat(payload.mitigation, "mitigation"),
    kills: parseIntStat(payload.kills, "kills"),
    assists: parseIntStat(payload.assists, "assists"),
    deaths: parseIntStat(payload.deaths, "deaths"),
    gameDuration: parseDurationToSeconds(payload.gameDuration),
    waitTime: parseIntStat(payload.waitTime ?? 0, "waitTime"),
    initialTime: parseIntStat(payload.initialTime ?? 0, "initialTime"),
    extraRounds: parseIntStat(payload.extraRounds ?? 0, "extraRounds"),
    mapType: parseEnum(payload.mapType, MAP_TYPES, "mapType"),
    role: parseEnum(payload.role, HERO_ROLES, "role"),
  };

  const computed = buildPer10Stats(data);

  return playerStatRepo.create({ ...data, ...computed });
};

const createFromOcrText = async ({ text, userId, role, mapType, waitTime, initialTime, extraRounds }) => {
  const parsedUserId = await validateUser(userId);

  const payload = {
    userId: parsedUserId,
    damage: extractFirstNumber(text, ["damage", "dmg"], "damage"),
    healing: extractFirstNumber(text, ["healing", "heal"], "healing"),
    mitigation: extractFirstNumber(text, ["mitigation", "mitigated"], "mitigation"),
    kills: extractFirstNumber(text, ["kills", "elims", "eliminations"], "kills"),
    assists: extractFirstNumber(text, ["assists"], "assists"),
    deaths: extractFirstNumber(text, ["deaths"], "deaths"),
    gameDuration: extractDuration(text),
    waitTime: parseIntStat(waitTime ?? 0, "waitTime"),
    initialTime: parseIntStat(initialTime ?? 0, "initialTime"),
    extraRounds: parseIntStat(extraRounds ?? 0, "extraRounds"),
    mapType: mapType ? parseEnum(mapType, MAP_TYPES, "mapType") : detectMapType(text),
    role: role ? parseEnum(role, HERO_ROLES, "role") : detectRole(text),
  };

  const computed = buildPer10Stats(payload);

  return playerStatRepo.create({ ...payload, ...computed });
};

const getAll = async () => playerStatRepo.findAll();

const getByUserId = async (userId) => {
  const parsed = Number(userId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("userId must be a positive integer.");
  }
  return playerStatRepo.findByUserId(parsed);
};

module.exports = {
  create,
  createFromOcrText,
  getAll,
  getByUserId,
};
