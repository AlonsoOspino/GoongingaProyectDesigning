const playerStatRepo = require("../repositories/playerStat");
const memberRepo = require("../repositories/member");
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
  gameDuration,
  damage,
  healing,
  mitigation,
  kills,
  assists,
  deaths,
}) => {
  const safeGameDuration = Math.max(0, Number(gameDuration) || 0);
  const effectiveDuration = Math.max(1, safeGameDuration);

  // Per-10 metric uses real duration (in seconds): stat / (duration / 600).
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

const normalizeName = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

const parseScoreNumber = (value) => {
  const parsed = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

const extractDurationFromScoreboard = (text) => {
  const content = String(text || "");
  const timeMatch = content.match(/TIME[^0-9]{0,12}(\d{1,2}:\d{2})/i);
  if (timeMatch) {
    return parseDurationToSeconds(timeMatch[1]);
  }

  const durations = [...content.matchAll(/\b(\d{1,2}:\d{2})\b/g)]
    .map((m) => m[1])
    .map((v) => ({ raw: v, seconds: parseDurationToSeconds(v) }))
    .filter((v) => v.seconds > 0);

  if (!durations.length) {
    throw new Error("Could not detect gameDuration from screenshot OCR.");
  }

  return durations.sort((a, b) => b.seconds - a.seconds)[0].seconds;
};

const extractStatTuple = (chunk) => {
  const numbers = [...String(chunk || "").matchAll(/\d[\d,]*/g)].map((m) => parseScoreNumber(m[0]));
  for (let i = 0; i + 5 < numbers.length; i += 1) {
    const e = numbers[i];
    const a = numbers[i + 1];
    const d = numbers[i + 2];
    const dmg = numbers[i + 3];
    const heal = numbers[i + 4];
    const mit = numbers[i + 5];
    if (e <= 120 && a <= 120 && d <= 120) {
      return { kills: e, assists: a, deaths: d, damage: dmg, healing: heal, mitigation: mit };
    }
  }
  return null;
};

const detectPlayerRowByNickname = (lines, nickname) => {
  const target = normalizeName(nickname);
  if (!target) return null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!normalizeName(line).includes(target)) continue;
    const window = [
      lines[i - 2] || "",
      lines[i - 1] || "",
      lines[i] || "",
      lines[i + 1] || "",
      lines[i + 2] || "",
      lines[i + 3] || "",
      lines[i + 4] || "",
      lines[i + 5] || "",
      lines[i + 6] || "",
      lines[i + 7] || "",
    ].join(" ");
    const tuple = extractStatTuple(window);
    if (tuple) {
      return tuple;
    }
  }

  return null;
};

const parseGenericRows = (text) => {
  const content = String(text || "");
  const pattern = /([A-Za-z0-9_]{3,20})[^\n\d]{0,30}(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s+([\d,]{1,8})\s+([\d,]{1,8})\s+([\d,]{1,8})/g;
  const rows = [];
  for (const m of content.matchAll(pattern)) {
    rows.push({
      nickname: m[1],
      kills: parseScoreNumber(m[2]),
      assists: parseScoreNumber(m[3]),
      deaths: parseScoreNumber(m[4]),
      damage: parseScoreNumber(m[5]),
      healing: parseScoreNumber(m[6]),
      mitigation: parseScoreNumber(m[7]),
    });
  }
  return rows;
};

const isMostlyUppercase = (value) => {
  const letters = String(value || "").replace(/[^A-Za-z]/g, "");
  if (!letters.length) return false;
  const upperLetters = letters.replace(/[^A-Z]/g, "");
  return upperLetters.length / letters.length >= 0.7;
};

const isScoreboardNoiseLine = (line) => {
  const normalized = normalizeName(line);
  if (!normalized) return true;

  const exactBlocked = [
    "E",
    "A",
    "D",
    "DMG",
    "H",
    "MIT",
    "VS",
    "INTERACT",
    "ROUND",
    "FPS",
    "TMP",
    "VRM",
  ];

  const prefixBlocked = [
    "CIRCUITROYAL",
    "TIME",
    "ATHENA",
  ];

  if (exactBlocked.includes(normalized)) return true;
  return prefixBlocked.some((token) => normalized.startsWith(token));
};

const extractNicknameCandidateFromLine = (line) => {
  const raw = String(line || "").trim();
  if (!raw) return "";
  if (isScoreboardNoiseLine(raw)) return "";
  if (!isMostlyUppercase(raw)) return "";

  const withoutLevel = raw.replace(/^\d{1,3}\)?\s+/, "").replace(/^\W+/, "").trim();
  if (!withoutLevel) return "";
  if (isScoreboardNoiseLine(withoutLevel)) return "";

  const normalized = normalizeName(withoutLevel);
  if (normalized.length < 3) return "";
  if (!/[A-Z]/.test(normalized)) return "";

  return withoutLevel;
};

const isLikelyStatTokenLine = (line) => {
  const raw = String(line || "").trim();
  if (!raw) return false;
  if (!/^\d[\d,]*$/.test(raw)) return false;

  const value = parseScoreNumber(raw);
  if (!Number.isFinite(value)) return false;
  return value <= 120000;
};

const isLikelyStatTuple = (tuple) => {
  if (!tuple) return false;
  if (tuple.kills > 120 || tuple.assists > 120 || tuple.deaths > 120) return false;
  if (tuple.damage > 120000 || tuple.healing > 120000 || tuple.mitigation > 120000) return false;
  return true;
};

const parseRowsFromLineBlocks = (text) => {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (/^VS$/i.test(lines[i])) continue;

    let nickname = extractNicknameCandidateFromLine(lines[i]);
    let nicknameIndex = i;

    // Some OCR lines split level and nickname into two lines: "58" then "DECEMBER 10TH".
    if (!nickname && isLikelyStatTokenLine(lines[i]) && i + 1 < lines.length) {
      const nextNickname = extractNicknameCandidateFromLine(lines[i + 1]);
      if (nextNickname) {
        nickname = nextNickname;
        nicknameIndex = i + 1;
      }
    }

    if (!nickname) continue;

    const values = [];
    let j = nicknameIndex + 1;
    while (j < lines.length && j <= nicknameIndex + 16 && values.length < 6) {
      if (/^VS$/i.test(lines[j])) break;

      // Stop if another nickname candidate appears before finding a full tuple.
      if (extractNicknameCandidateFromLine(lines[j])) {
        break;
      }

      for (const m of lines[j].matchAll(/\d[\d,]*/g)) {
        values.push(parseScoreNumber(m[0]));
        if (values.length >= 6) break;
      }

      j += 1;
    }

    if (values.length < 6) continue;

    const tuple = {
      kills: values[0],
      assists: values[1],
      deaths: values[2],
      damage: values[3],
      healing: values[4],
      mitigation: values[5],
    };

    if (!isLikelyStatTuple(tuple)) continue;

    rows.push({ nickname, ...tuple });
    i = j - 1;
  }

  return rows;
};

const extractUppercaseNicknameCandidates = (text) => {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter(Boolean);

  const candidates = [];
  const seen = new Set();

  for (const raw of lines) {
    if (isScoreboardNoiseLine(raw)) continue;

    const withoutLevel = raw.replace(/^\d{1,3}\)?\s+/, "").replace(/^\W+/, "").trim();
    if (!withoutLevel) continue;
    if (isScoreboardNoiseLine(withoutLevel)) continue;

    // User constraint: in-game nicknames are uppercase and may contain digits/spaces.
    if (!/^[A-Z0-9 ]{3,24}$/.test(withoutLevel)) continue;
    if (!/[A-Z]/.test(withoutLevel)) continue;

    const key = normalizeName(withoutLevel);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    candidates.push(withoutLevel);
  }

  return candidates;
};

const tokenizeForMatch = (value) => normalizeName(value);

const normalizeForFuzzyNickname = (value) =>
  tokenizeForMatch(value)
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/5/g, "S")
    .replace(/8/g, "B")
    .replace(/2/g, "Z");

const levenshteinDistance = (a, b) => {
  const left = String(a || "");
  const right = String(b || "");
  if (!left) return right.length;
  if (!right) return left.length;

  const dp = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[left.length][right.length];
};

const nicknameMatchScore = (ocrToken, playerNickname) => {
  const a = normalizeForFuzzyNickname(ocrToken);
  const b = normalizeForFuzzyNickname(playerNickname);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if ((a.includes(b) || b.includes(a)) && Math.min(a.length, b.length) >= 4) return 0.9;
  if (a.slice(0, 5) === b.slice(0, 5) && Math.min(a.length, b.length) >= 5) return 0.75;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen >= 4) {
    const distance = levenshteinDistance(a, b);
    const similarity = 1 - distance / maxLen;
    if (similarity >= 0.85) return 0.84;
    if (similarity >= 0.72) return 0.72;
  }

  return 0;
};

const wordCenterX = (word) => (Number(word?.bbox?.x0 || 0) + Number(word?.bbox?.x1 || 0)) / 2;
const wordCenterY = (word) => (Number(word?.bbox?.y0 || 0) + Number(word?.bbox?.y1 || 0)) / 2;

const clusterRowsByY = (words, tolerance = 12) => {
  const sorted = [...words].sort((a, b) => wordCenterY(a) - wordCenterY(b));
  const rows = [];
  for (const word of sorted) {
    const y = wordCenterY(word);
    const existing = rows.find((row) => Math.abs(row.y - y) <= tolerance);
    if (existing) {
      existing.words.push(word);
      existing.y = (existing.y * (existing.words.length - 1) + y) / existing.words.length;
    } else {
      rows.push({ y, words: [word] });
    }
  }
  for (const row of rows) {
    row.words.sort((a, b) => wordCenterX(a) - wordCenterX(b));
  }
  return rows;
};

const looksNumericToken = (text) => /^\d[\d,]*$/.test(String(text || "").trim());

const headerAlias = {
  E: ["E", "ELIMS", "ELIMS", "ELIM"],
  A: ["A", "ASSISTS", "AST"],
  D: ["D", "DEATHS", "DEATH"],
  DMG: ["DMG", "DAMAGE"],
  H: ["H", "HEAL", "HEALING"],
  MIT: ["MIT", "MITIGATION"],
};

const classifyHeaderKey = (text) => {
  const token = tokenizeForMatch(text);
  if (!token) return null;
  for (const key of Object.keys(headerAlias)) {
    const aliases = headerAlias[key];
    if (aliases.some((alias) => token === alias || token.includes(alias))) {
      return key;
    }
  }
  return null;
};

const detectColumnCenters = (rows) => {
  let best = null;

  for (const row of rows) {
    const centers = {};
    for (const word of row.words) {
      const key = classifyHeaderKey(word.text);
      if (!key || centers[key] !== undefined) continue;
      centers[key] = wordCenterX(word);
    }

    const foundCount = Object.keys(centers).length;
    if (foundCount >= 4) {
      if (!best || foundCount > Object.keys(best.centers).length) {
        best = { y: row.y, centers };
      }
    }
  }

  return best?.centers || null;
};

const parseStatsFromRowWords = (rowWords, columnCenters) => {
  const minStatX = columnCenters?.E !== undefined ? columnCenters.E - 70 : 300;
  const numericWords = rowWords.filter((w) => looksNumericToken(w.text) && wordCenterX(w) >= minStatX);
  if (!numericWords.length) return null;

  if (columnCenters) {
    const valuesByKey = {};
    for (const word of numericWords) {
      const x = wordCenterX(word);
      let nearestKey = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const key of ["E", "A", "D", "DMG", "H", "MIT"]) {
        const cx = columnCenters[key];
        if (cx === undefined) continue;
        const distance = Math.abs(x - cx);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestKey = key;
        }
      }

      if (!nearestKey || nearestDistance > 90) continue;
      const parsed = parseScoreNumber(word.text);
      if (!Number.isFinite(parsed)) continue;
      if (valuesByKey[nearestKey] === undefined || parsed > valuesByKey[nearestKey]) {
        valuesByKey[nearestKey] = parsed;
      }
    }

    if (
      valuesByKey.E !== undefined &&
      valuesByKey.A !== undefined &&
      valuesByKey.D !== undefined &&
      valuesByKey.DMG !== undefined
    ) {
      return {
        kills: valuesByKey.E ?? 0,
        assists: valuesByKey.A ?? 0,
        deaths: valuesByKey.D ?? 0,
        damage: valuesByKey.DMG ?? 0,
        healing: valuesByKey.H ?? 0,
        mitigation: valuesByKey.MIT ?? 0,
      };
    }
  }

  // Fallback when headers are unreadable: use left-to-right numeric sequence heuristic.
  const numbers = numericWords
    .sort((a, b) => wordCenterX(a) - wordCenterX(b))
    .map((w) => parseScoreNumber(w.text));

  for (let i = 0; i + 5 < numbers.length; i += 1) {
    const e = numbers[i];
    const a = numbers[i + 1];
    const d = numbers[i + 2];
    const dmg = numbers[i + 3];
    const heal = numbers[i + 4];
    const mit = numbers[i + 5];
    if (e <= 120 && a <= 120 && d <= 120 && dmg >= 0) {
      return { kills: e, assists: a, deaths: d, damage: dmg, healing: heal, mitigation: mit };
    }
  }

  return null;
};

const detectStatsByWordGeometry = (ocrWords, players) => {
  if (!Array.isArray(ocrWords) || !ocrWords.length) {
    return new Map();
  }

  const rows = clusterRowsByY(ocrWords, 14);
  const columnCenters = detectColumnCenters(rows);
  const detected = new Map();

  for (const player of players) {
    let bestWord = null;
    let bestScore = 0;

    for (const word of ocrWords) {
      const score = nicknameMatchScore(word.text, player.nickname);
      if (score > bestScore) {
        bestScore = score;
        bestWord = word;
      }
    }

    if (!bestWord || bestScore < 0.7) continue;
    const targetY = wordCenterY(bestWord);
    let row = null;
    let nearest = Number.POSITIVE_INFINITY;
    for (const candidate of rows) {
      const distance = Math.abs(candidate.y - targetY);
      if (distance < nearest) {
        nearest = distance;
        row = candidate;
      }
    }

    if (!row || nearest > 20) continue;
    const stats = parseStatsFromRowWords(row.words, columnCenters);
    if (!stats) continue;
    detected.set(player.id, stats);
  }

  return detected;
};

const getNicknameTokenFromRow = (rowWords, firstNumericX) => {
  const candidates = rowWords
    .filter((w) => wordCenterX(w) < firstNumericX - 24)
    .map((w) => String(w.text || "").trim())
    .filter((t) => /[A-Za-z]/.test(t) && t.length >= 3);

  if (!candidates.length) return "";
  return candidates.sort((a, b) => b.length - a.length)[0];
};

const parseStatWindow = (numbers) => {
  for (let i = 0; i + 5 < numbers.length; i += 1) {
    const e = numbers[i];
    const a = numbers[i + 1];
    const d = numbers[i + 2];
    const dmg = numbers[i + 3];
    const heal = numbers[i + 4];
    const mit = numbers[i + 5];

    const validCore = e <= 120 && a <= 120 && d <= 120;
    const validLarge = dmg <= 100000 && heal <= 100000 && mit <= 100000;
    if (validCore && validLarge) {
      return { kills: e, assists: a, deaths: d, damage: dmg, healing: heal, mitigation: mit };
    }
  }
  return null;
};

const parseRowsFromNumericGrid = (ocrWords) => {
  if (!Array.isArray(ocrWords) || !ocrWords.length) return [];

  const rows = clusterRowsByY(ocrWords, 14);
  const parsedRows = [];

  for (const row of rows) {
    const numericWords = row.words
      .filter((w) => looksNumericToken(w.text))
      .filter((w) => wordCenterX(w) > 300)
      .sort((a, b) => wordCenterX(a) - wordCenterX(b));

    if (numericWords.length < 6) continue;
    const values = numericWords.map((w) => parseScoreNumber(w.text));
    const tuple = parseStatWindow(values);
    if (!tuple) continue;

    const nickname = getNicknameTokenFromRow(row.words, wordCenterX(numericWords[0]));
    parsedRows.push({
      y: row.y,
      nickname,
      ...tuple,
    });
  }

  return parsedRows.sort((a, b) => a.y - b.y);
};

const popBestRowForNickname = (rows, nickname) => {
  if (!rows.length) return null;

  let bestIndex = -1;
  let bestScore = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const score = nicknameMatchScore(rows[i].nickname, nickname);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0 && bestScore >= 0.7) {
    const [row] = rows.splice(bestIndex, 1);
    return row;
  }

  return null;
};

const popBestPlayerForNickname = (players, nickname) => {
  if (!players.length) return null;

  let bestIndex = -1;
  let bestScore = 0;
  for (let i = 0; i < players.length; i += 1) {
    const score = nicknameMatchScore(nickname, players[i].nickname);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0 && bestScore >= 0.7) {
    const [player] = players.splice(bestIndex, 1);
    return player;
  }

  return null;
};

const getMatchPlayers = async (matchId) => {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { include: { members: true } },
      teamB: { include: { members: true } },
    },
  });

  if (!match) {
    throw new Error("Match not found.");
  }

  const players = [...(match.teamA?.members || []), ...(match.teamB?.members || [])].map((m) => ({
    id: m.id,
    nickname: m.nickname,
    user: m.user,
    teamId: m.teamId,
  }));

  return { match, players };
};

const ensureUserInMatch = async (matchId, userId) => {
  const { players } = await getMatchPlayers(matchId);
  if (!players.some((player) => player.id === userId)) {
    throw new Error("User does not belong to this match teams.");
  }
};

const previewMatchStatsFromOcrText = async ({
  text,
  ocrWords,
  templateDuration,
  matchId,
  mapType,
}) => {
  const parsedMatchId = Number(matchId);
  if (!Number.isInteger(parsedMatchId) || parsedMatchId <= 0) {
    throw new Error("matchId must be a positive integer.");
  }

  const { players } = await getMatchPlayers(parsedMatchId);
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const normalizedMapType = mapType ? parseEnum(mapType, MAP_TYPES, "mapType") : detectMapType(text);
  const lineBlockRows = parseRowsFromLineBlocks(text);
  const uppercaseCandidates = extractUppercaseNicknameCandidates(text);
  const candidateRows = uppercaseCandidates
    .map((nickname) => ({ nickname, ...(detectPlayerRowByNickname(lines, nickname) || {}) }))
    .filter((row) => isLikelyStatTuple(row));
  const mergedLineRows = [];
  const seenLineRows = new Set();
  for (const row of [...lineBlockRows, ...candidateRows]) {
    const key = normalizeName(row.nickname);
    if (!key || seenLineRows.has(key)) continue;
    seenLineRows.add(key);
    mergedLineRows.push(row);
  }
  const fallbackRows = parseGenericRows(text);
  const fallbackByName = new Map(
    [...mergedLineRows, ...fallbackRows]
      .filter((row) => normalizeName(row.nickname).length > 0)
      .map((row) => [normalizeName(row.nickname), row])
  );
  const geometryByPlayerId = detectStatsByWordGeometry(ocrWords, players);
  const numericGridRows = parseRowsFromNumericGrid(ocrWords);
  const baseRows = mergedLineRows.length ? mergedLineRows : numericGridRows.length ? numericGridRows : fallbackRows;
  const remainingPlayers = [...players.slice(0, 10)];
  const remainingGridRows = mergedLineRows.length ? [] : [...numericGridRows];
  const rows = [];

  for (const parsedRow of baseRows.slice(0, 10)) {
    const matchedPlayer = popBestPlayerForNickname(remainingPlayers, parsedRow.nickname);
    const fallbackByMatchedNickname = matchedPlayer
      ? detectPlayerRowByNickname(lines, matchedPlayer.nickname) || fallbackByName.get(normalizeName(matchedPlayer.nickname))
      : null;

    const detected = {
      kills: parsedRow.kills ?? fallbackByMatchedNickname?.kills ?? 0,
      assists: parsedRow.assists ?? fallbackByMatchedNickname?.assists ?? 0,
      deaths: parsedRow.deaths ?? fallbackByMatchedNickname?.deaths ?? 0,
      damage: parsedRow.damage ?? fallbackByMatchedNickname?.damage ?? 0,
      healing: parsedRow.healing ?? fallbackByMatchedNickname?.healing ?? 0,
      mitigation: parsedRow.mitigation ?? fallbackByMatchedNickname?.mitigation ?? 0,
    };

    rows.push({
      nickname: parsedRow.nickname || matchedPlayer?.nickname || "",
      userId: matchedPlayer?.id ?? null,
      role: "DPS",
      kills: detected.kills,
      assists: detected.assists,
      deaths: detected.deaths,
      damage: detected.damage,
      healing: detected.healing,
      mitigation: detected.mitigation,
      userFound: Boolean(matchedPlayer),
    });
  }

  for (const player of remainingPlayers) {
    if (rows.length >= 10) break;

    const gridByNickname = popBestRowForNickname(remainingGridRows, player.nickname);
    const detected =
      gridByNickname ||
      geometryByPlayerId.get(player.id) ||
      detectPlayerRowByNickname(lines, player.nickname) ||
      fallbackByName.get(normalizeName(player.nickname)) ||
      null;

    rows.push({
      nickname: player.nickname,
      userId: player.id,
      role: "DPS",
      kills: detected?.kills ?? 0,
      assists: detected?.assists ?? 0,
      deaths: detected?.deaths ?? 0,
      damage: detected?.damage ?? 0,
      healing: detected?.healing ?? 0,
      mitigation: detected?.mitigation ?? 0,
      userFound: true,
    });
  }

  while (rows.length < 10) {
    rows.push({
      nickname: "",
      userId: null,
      role: "DPS",
      kills: 0,
      assists: 0,
      deaths: 0,
      damage: 0,
      healing: 0,
      mitigation: 0,
      userFound: false,
    });
  }

  let gameDuration = 0;
  if (Number.isInteger(templateDuration) && templateDuration > 0) {
    gameDuration = templateDuration;
  } else {
    try {
      gameDuration = extractDurationFromScoreboard(text);
    } catch (_err) {
      gameDuration = 0;
    }
  }

  return {
    mapType: normalizedMapType,
    gameDuration,
    rows,
    players,
    ocrPreview: String(text || "").slice(0, 2000),
  };
};

const createBatchFromPreview = async ({ matchId, mapType, gameNumber, gameDuration, rows }) => {
  const parsedMatchId = Number(matchId);
  if (!Number.isInteger(parsedMatchId) || parsedMatchId <= 0) {
    throw new Error("matchId must be a positive integer.");
  }

  const parsedGameNumber = parseIntStat(gameNumber, "gameNumber");
  if (parsedGameNumber < 1) {
    throw new Error("gameNumber must be >= 1.");
  }

  const { players } = await getMatchPlayers(parsedMatchId);
  const allowedUserIds = new Set(players.map((p) => p.id));

  const normalizedMapType = parseEnum(mapType, MAP_TYPES, "mapType");
  const normalizedDuration = parseDurationToSeconds(gameDuration);

  if (!Array.isArray(rows) || rows.length !== 10) {
    throw new Error("rows must include exactly 10 players.");
  }

  const sanitizedRows = rows.slice(0, 10);

  const created = [];
  for (const row of sanitizedRows) {
    const userId = await validateUser(row.userId);
    if (!allowedUserIds.has(userId)) {
      throw new Error(`User ${userId} does not belong to this match teams.`);
    }
    const payload = {
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

    const computed = buildPer10Stats(payload);
    const createdStat = await playerStatRepo.create({ ...payload, ...computed });
    created.push(createdStat);
  }

  return created;
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

const extractFirstNumberOrFallback = (text, patterns, fieldLabel, fallbackValue) => {
  try {
    return extractFirstNumber(text, patterns, fieldLabel);
  } catch (_err) {
    if (fallbackValue !== undefined && fallbackValue !== null && fallbackValue !== "") {
      return parseIntStat(fallbackValue, fieldLabel);
    }
    throw new Error(
      `Could not detect ${fieldLabel} from OCR text. Provide ${fieldLabel} manually in the request body.`
    );
  }
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

const extractDurationOrFallback = (text, fallbackValue) => {
  try {
    return extractDuration(text);
  } catch (_err) {
    if (fallbackValue !== undefined && fallbackValue !== null && fallbackValue !== "") {
      return parseDurationToSeconds(fallbackValue);
    }
    throw new Error(
      "Could not detect gameDuration from OCR text. Provide gameDuration manually in the request body."
    );
  }
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
  const matchId = parsePositiveInt(payload.matchId, "matchId");
  const gameNumber = parsePositiveInt(payload.gameNumber, "gameNumber");
  await ensureUserInMatch(matchId, userId);

  const data = {
    userId,
    matchId,
    gameNumber,
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

  const computed = buildPer10Stats(data);

  return playerStatRepo.create({ ...data, ...computed });
};

const createFromOcrText = async ({
  text,
  userId,
  matchId,
  gameNumber,
  role,
  mapType,
  gameDuration,
  damage,
  healing,
  mitigation,
  kills,
  assists,
  deaths,
}) => {
  const parsedUserId = await validateUser(userId);
  const parsedMatchId = parsePositiveInt(matchId, "matchId");
  const parsedGameNumber = parsePositiveInt(gameNumber, "gameNumber");
  await ensureUserInMatch(parsedMatchId, parsedUserId);

  const payload = {
    userId: parsedUserId,
    matchId: parsedMatchId,
    gameNumber: parsedGameNumber,
    damage: extractFirstNumberOrFallback(text, ["damage", "dmg"], "damage", damage),
    healing: extractFirstNumberOrFallback(text, ["healing", "heal"], "healing", healing),
    mitigation: extractFirstNumberOrFallback(text, ["mitigation", "mitigated"], "mitigation", mitigation),
    kills: extractFirstNumberOrFallback(text, ["kills", "elims", "eliminations"], "kills", kills),
    assists: extractFirstNumberOrFallback(text, ["assists"], "assists", assists),
    deaths: extractFirstNumberOrFallback(text, ["deaths"], "deaths", deaths),
    gameDuration: extractDurationOrFallback(text, gameDuration),
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

const getAllPublic = async () => playerStatRepo.findAllPublic();

const getPublicByUserId = async (userId) => {
  const parsed = Number(userId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("userId must be a positive integer.");
  }
  return playerStatRepo.findByUserIdPublic(parsed);
};

module.exports = {
  create,
  createFromOcrText,
  previewMatchStatsFromOcrText,
  createBatchFromPreview,
  getAll,
  getByUserId,
  getAllPublic,
  getPublicByUserId,
};
