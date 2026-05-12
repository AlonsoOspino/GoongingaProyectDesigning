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

const extractNicknameToken = (line) => {
  const raw = String(line || "").trim();
  if (!raw) return "";
  if (isScoreboardNoiseLine(raw)) return "";
  if (raw.includes(":")) return "";

  const hadLevelPrefix = /^\d{1,3}\)?\s+/.test(raw);
  const withoutLevel = raw.replace(/^\d{1,3}\)?\s+/, "").replace(/^\W+/, "").trim();
  if (!withoutLevel) return "";
  if (isScoreboardNoiseLine(withoutLevel)) return "";
  if (/^[\d,]/.test(withoutLevel)) return "";
  if (hadLevelPrefix && !/[a-z]/.test(withoutLevel)) return "";

  const leadingToken = withoutLevel.match(/^([A-Z][A-Z0-9_]{2,23})(?=\s|$)/);
  if (leadingToken) {
    const remainder = withoutLevel.slice(leadingToken[1].length).trim();
    if (remainder) {
      if (!/[a-z]/.test(remainder)) {
        return "";
      }
      if (isScoreboardNoiseLine(remainder)) {
        return "";
      }
    }
    return leadingToken[1];
  }

  if (!isMostlyUppercase(withoutLevel)) return "";

  const normalized = normalizeName(withoutLevel);
  if (normalized.length < 3) return "";
  if (!/[A-Z]/.test(normalized)) return "";

  return withoutLevel;
};

const extractNicknameCandidateFromLine = (line) => {
  return extractNicknameToken(line);
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

const collectNumbersFromLine = (line) =>
  [...String(line || "").matchAll(/\d[\d,]*/g)].map((m) => parseScoreNumber(m[0]));

const findNearestNicknameBeforeIndex = (lines, index) => {
  for (let i = index - 1; i >= 0 && i >= index - 8; i -= 1) {
    const nickname = extractNicknameCandidateFromLine(lines[i]);
    if (nickname) {
      return nickname;
    }
  }
  return "";
};

// ============================================================================
// STRATEGY 2: TEXT-BASED PARSING - Secondary strategies for fallback
// ============================================================================

const getNicknameTokenFromRow = (rowWords, firstNumericX) => {
  const candidates = rowWords
    .filter((w) => wordCenterX(w) < firstNumericX - 24)
    .map((w) => String(w.text || "").trim())
    .filter((t) => /[A-Za-z]/.test(t) && t.length >= 3);

  if (!candidates.length) return "";
  return candidates.sort((a, b) => b.length - a.length)[0];
};

const parseRowsFromLineBlocks = (text) => {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (/^VS$/i.test(lines[i])) continue;

    if (!isStandaloneNumberLine(lines[i])) continue;

    const blockValues = [];
    let endIndex = i;
    while (endIndex < lines.length && endIndex <= i + 16 && isStandaloneNumberLine(lines[endIndex])) {
      blockValues.push(parseScoreNumber(lines[endIndex]));
      endIndex += 1;
    }

    if (blockValues.length < 6) {
      i = endIndex - 1;
      continue;
    }

    const tuple = {
      kills: blockValues[0],
      assists: blockValues[1],
      deaths: blockValues[2],
      damage: blockValues[3],
      healing: blockValues[4],
      mitigation: blockValues[5],
    };

    if (!isLikelyStatTuple(tuple)) {
      i = endIndex - 1;
      continue;
    }

    const nickname = findNearestNicknameBeforeIndex(lines, i);
    if (!nickname) {
      i = endIndex - 1;
      continue;
    }

    rows.push({ nickname, confidence: 0.6, ...tuple });
    i = endIndex - 1;
  }

  const confidence = rows.length > 0 ? Math.min(0.75, rows.length / 10 * 0.7) : 0;
  return { rows, confidence, strategy: "line-blocks" };
};

const parseGenericRows = (text) => {
  const content = String(text || "");
  const pattern = /([A-Za-z0-9_]{3,20})[^\n\d]{0,30}(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s+([\d,]{1,8})\s+([\d,]{1,8})\s+([\d,]{1,8})/g;
  const rows = [];
  for (const m of content.matchAll(pattern)) {
    rows.push({
      nickname: m[1],
      confidence: 0.55,
      kills: parseScoreNumber(m[2]),
      assists: parseScoreNumber(m[3]),
      deaths: parseScoreNumber(m[4]),
      damage: parseScoreNumber(m[5]),
      healing: parseScoreNumber(m[6]),
      mitigation: parseScoreNumber(m[7]),
    });
  }

  const confidence = rows.length > 0 ? Math.min(0.65, rows.length / 10 * 0.6) : 0;
  return { rows, confidence, strategy: "generic-regex" };
};

const parseRowsFromLineBlocks = (text) => {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (/^VS$/i.test(lines[i])) continue;

    if (!isStandaloneNumberLine(lines[i])) continue;

    const blockValues = [];
    let endIndex = i;
    while (endIndex < lines.length && endIndex <= i + 16 && isStandaloneNumberLine(lines[endIndex])) {
      blockValues.push(parseScoreNumber(lines[endIndex]));
      endIndex += 1;
    }

    if (blockValues.length < 6) {
      i = endIndex - 1;
      continue;
    }

    const tuple = {
      kills: blockValues[0],
      assists: blockValues[1],
      deaths: blockValues[2],
      damage: blockValues[3],
      healing: blockValues[4],
      mitigation: blockValues[5],
    };

    if (!isLikelyStatTuple(tuple)) {
      i = endIndex - 1;
      continue;
    }

    const nickname = findNearestNicknameBeforeIndex(lines, i);
    if (!nickname) {
      i = endIndex - 1;
      continue;
    }

    rows.push({ nickname, ...tuple });
    i = endIndex - 1;
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
    const withoutLevel = extractNicknameToken(raw);
    if (!withoutLevel) continue;

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

// ============================================================================
// GEOMETRY HELPERS - Robust bounding box operations without hardcodes
// ============================================================================

const wordCenterX = (word) => (Number(word?.bbox?.x0 || 0) + Number(word?.bbox?.x1 || 0)) / 2;
const wordCenterY = (word) => (Number(word?.bbox?.y0 || 0) + Number(word?.bbox?.y1 || 0)) / 2;
const wordWidth = (word) => (Number(word?.bbox?.x1 || 0) - Number(word?.bbox?.x0 || 0));
const wordHeight = (word) => (Number(word?.bbox?.y1 || 0) - Number(word?.bbox?.y0 || 0));

const getWordBounds = (words) => {
  if (!words.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const xs = words.map(wordCenterX);
  const ys = words.map(wordCenterY);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};

const calculateYDensity = (ys) => {
  if (ys.length < 2) return 0;
  const sorted = [...ys].sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i] - sorted[i - 1]);
  }
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const stdDev = Math.sqrt(gaps.reduce((sum, g) => sum + Math.pow(g - avgGap, 2), 0) / gaps.length);
  return { avgGap, stdDev, gaps };
};

const detectRowTolerance = (words) => {
  const ys = words.map(wordCenterY);
  if (ys.length < 3) return 14;
  const { stdDev } = calculateYDensity(ys);
  return Math.max(8, Math.min(20, stdDev * 0.6));
};

const identifyOutlierYs = (ys, tolerance) => {
  const sorted = [...ys].sort((a, b) => a - b);
  const outliers = new Set();
  for (let i = 0; i < sorted.length; i++) {
    const neighbors = sorted.filter((y) => Math.abs(y - sorted[i]) <= tolerance * 2);
    if (neighbors.length < 2) {
      outliers.add(sorted[i]);
    }
  }
  return outliers;
};

const clusterRowsByY = (words, manualTolerance = null) => {
  if (!Array.isArray(words) || !words.length) return [];

  const sorted = [...words].sort((a, b) => wordCenterY(a) - wordCenterY(b));
  const tolerance = manualTolerance ?? detectRowTolerance(sorted);
  const outlierYs = identifyOutlierYs(
    sorted.map(wordCenterY),
    tolerance
  );

  const rows = [];
  for (const word of sorted) {
    const y = wordCenterY(word);
    if (outlierYs.has(y)) continue;

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

// ============================================================================
// COLUMN DETECTION - Dynamic, no hardcodes
// ============================================================================

const headerAlias = {
  E: ["E", "ELIMS", "ELIM"],
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

const analyzeColumnStructure = (rows) => {
  const columnProposals = [];

  for (const row of rows) {
    const centers = {};
    const headerCandidates = [];

    for (const word of row.words) {
      const key = classifyHeaderKey(word.text);
      if (!key) continue;
      if (centers[key] !== undefined) continue;
      centers[key] = wordCenterX(word);
      headerCandidates.push({ key, x: wordCenterX(word), text: word.text });
    }

    if (Object.keys(centers).length >= 4) {
      columnProposals.push({
        y: row.y,
        centers,
        numHeaders: Object.keys(centers).length,
        headerCandidates,
      });
    }
  }

  return columnProposals.sort((a, b) => b.numHeaders - a.numHeaders);
};

const mergeColumnCenters = (proposals) => {
  if (!proposals.length) return null;

  const best = proposals[0];
  const merged = { ...best.centers };

  for (const proposal of proposals.slice(1, 5)) {
    for (const [key, x] of Object.entries(proposal.centers)) {
      if (merged[key] === undefined) {
        merged[key] = x;
      } else {
        merged[key] = (merged[key] + x) / 2;
      }
    }
  }

  return Object.keys(merged).length >= 4 ? merged : null;
};

const detectColumnCenters = (rows) => {
  const proposals = analyzeColumnStructure(rows);
  if (!proposals.length) return null;
  return mergeColumnCenters(proposals);
};

const estimateColumnMinX = (columnCenters) => {
  if (!columnCenters || !Object.keys(columnCenters).length) return 300;
  const minColX = Math.min(...Object.values(columnCenters));
  return Math.max(50, minColX - 150);
};

// ============================================================================
// STAT PARSING - Robust column-based and fallback heuristics
// ============================================================================

const looksNumericToken = (text) => /^\d[\d,]*$/.test(String(text || "").trim());

const assignStatValueToColumn = (x, columnCenters) => {
  let bestKey = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const key of ["E", "A", "D", "DMG", "H", "MIT"]) {
    const cx = columnCenters[key];
    if (cx === undefined) continue;
    const distance = Math.abs(x - cx);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestKey = key;
    }
  }

  const avgColSpacing = Object.values(columnCenters).length > 1
    ? (Math.max(...Object.values(columnCenters)) - Math.min(...Object.values(columnCenters))) /
      (Object.values(columnCenters).length - 1)
    : 100;

  const maxMatchDistance = avgColSpacing * 0.35;

  if (bestKey && bestDistance <= maxMatchDistance) {
    return { key: bestKey, distance: bestDistance };
  }

  return null;
};

const parseStatsFromRowWords = (rowWords, columnCenters) => {
  if (!columnCenters) return null;

  const minStatX = estimateColumnMinX(columnCenters);
  const numericWords = rowWords
    .filter((w) => looksNumericToken(w.text) && wordCenterX(w) >= minStatX)
    .sort((a, b) => wordCenterX(a) - wordCenterX(b));

  if (!numericWords.length) return null;

  const valuesByKey = {};
  for (const word of numericWords) {
    const x = wordCenterX(word);
    const assignment = assignStatValueToColumn(x, columnCenters);
    if (!assignment) continue;

    const parsed = parseScoreNumber(word.text);
    if (!Number.isFinite(parsed)) continue;

    if (valuesByKey[assignment.key] === undefined || parsed > valuesByKey[assignment.key]) {
      valuesByKey[assignment.key] = parsed;
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

  const numbers = numericWords
    .map((w) => parseScoreNumber(w.text))
    .filter((n) => Number.isFinite(n));

  for (let i = 0; i + 5 < numbers.length; i += 1) {
    const e = numbers[i];
    const a = numbers[i + 1];
    const d = numbers[i + 2];
    const dmg = numbers[i + 3];
    const heal = numbers[i + 4];
    const mit = numbers[i + 5];
    if (e <= 120 && a <= 120 && d <= 120 && dmg >= 0 && dmg <= 100000) {
      return { kills: e, assists: a, deaths: d, damage: dmg, healing: heal, mitigation: mit };
    }
  }

  return null;
};

// ============================================================================
// STRATEGY 1: GEOMETRY-FIRST PARSING - Primary strategy, most reliable
// ============================================================================

const detectStatsByWordGeometry = (ocrWords, players) => {
  if (!Array.isArray(ocrWords) || !ocrWords.length) {
    return { detected: new Map(), rowCount: 0, confidence: 0 };
  }

  const rows = clusterRowsByY(ocrWords);
  if (!rows.length) {
    return { detected: new Map(), rowCount: 0, confidence: 0 };
  }

  const columnCenters = detectColumnCenters(rows);
  if (!columnCenters) {
    return { detected: new Map(), rowCount: 0, confidence: 0 };
  }

  const detected = new Map();
  let successCount = 0;

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

    if (!bestWord || bestScore < 0.65) continue;

    const targetY = wordCenterY(bestWord);
    let row = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of rows) {
      const distance = Math.abs(candidate.y - targetY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        row = candidate;
      }
    }

    if (!row) continue;

    const avgRowHeight = rows.reduce((sum, r) => sum + r.words.length, 0) / rows.length;
    const maxYDistance = Math.max(15, avgRowHeight * 2);
    if (nearestDistance > maxYDistance) continue;

    const stats = parseStatsFromRowWords(row.words, columnCenters);
    if (!stats) continue;

    detected.set(player.id, stats);
    successCount += 1;
  }

  const confidence = players.length > 0 ? successCount / players.length : 0;

  return {
    detected,
    rowCount: successCount,
    confidence: Math.min(1, confidence + (columnCenters ? 0.15 : 0)),
    strategy: "geometry",
  };
};

const parseRowsFromNumericGrid = (ocrWords) => {
  if (!Array.isArray(ocrWords) || !ocrWords.length) {
    return { rows: [], confidence: 0 };
  }

  const rows = clusterRowsByY(ocrWords);
  if (!rows.length) {
    return { rows: [], confidence: 0 };
  }

  const columnCenters = detectColumnCenters(rows);
  const parsedRows = [];

  for (const row of rows) {
    const minStatX = estimateColumnMinX(columnCenters || {});
    const numericWords = row.words
      .filter((w) => looksNumericToken(w.text) && wordCenterX(w) >= minStatX)
      .sort((a, b) => wordCenterX(a) - wordCenterX(b));

    if (numericWords.length < 6) continue;

    const stats = parseStatsFromRowWords(row.words, columnCenters);
    if (!stats) continue;

    const nickname = getNicknameTokenFromRow(row.words, wordCenterX(numericWords[0]));
    parsedRows.push({
      y: row.y,
      nickname,
      confidence: columnCenters ? 0.85 : 0.65,
      ...stats,
    });
  }

  const confidence = parsedRows.length > 0 ? Math.min(1, parsedRows.length / 10 * 0.9) : 0;

  return {
    rows: parsedRows.sort((a, b) => a.y - b.y),
    confidence,
    strategy: "numeric-grid",
  };
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

// ============================================================================
// PIPELINE ORCHESTRATOR - Selects best strategy based on confidence
// ============================================================================

const executeParsingPipeline = async (text, ocrWords, players) => {
  const strategies = [];

  if (Array.isArray(ocrWords) && ocrWords.length > 0) {
    const geometryResult = detectStatsByWordGeometry(ocrWords, players);
    if (geometryResult.rowCount > 0) {
      strategies.push({
        name: "geometry-player-matched",
        confidence: geometryResult.confidence,
        detected: geometryResult.detected,
        rowCount: geometryResult.rowCount,
      });
    }

    const gridResult = parseRowsFromNumericGrid(ocrWords);
    if (gridResult.rows.length > 0) {
      strategies.push({
        name: "numeric-grid",
        confidence: gridResult.confidence,
        rows: gridResult.rows,
        rowCount: gridResult.rows.length,
      });
    }
  }

  const linesResult = parseRowsFromLineBlocks(text);
  if (linesResult.rows.length > 0) {
    strategies.push({
      name: "line-blocks",
      confidence: linesResult.confidence,
      rows: linesResult.rows,
      rowCount: linesResult.rows.length,
    });
  }

  const genericResult = parseGenericRows(text);
  if (genericResult.rows.length > 0) {
    strategies.push({
      name: "generic-regex",
      confidence: genericResult.confidence,
      rows: genericResult.rows,
      rowCount: genericResult.rows.length,
    });
  }

  strategies.sort((a, b) => b.confidence - a.confidence);

  return {
    primary: strategies[0] || null,
    strategies,
  };
};

const matchRowsToPlayers = (rows, players) => {
  const matched = [];
  const usedPlayers = new Set();

  for (const row of rows) {
    let bestPlayer = null;
    let bestScore = 0;

    for (const player of players) {
      if (usedPlayers.has(player.id)) continue;
      const score = nicknameMatchScore(row.nickname, player.nickname);
      if (score > bestScore) {
        bestScore = score;
        bestPlayer = player;
      }
    }

    if (bestPlayer && bestScore >= 0.7) {
      usedPlayers.add(bestPlayer.id);
      matched.push({
        player: bestPlayer,
        row,
        matchScore: bestScore,
      });
    }
  }

  return { matched, usedPlayers };
};

const buildFinalRowsList = (primaryMatches, allPlayers) => {
  const rows = [];
  const coveredPlayerIds = new Set();

  for (const match of primaryMatches) {
    coveredPlayerIds.add(match.player.id);
    rows.push({
      nickname: match.player.nickname,
      userId: match.player.id,
      role: "DPS",
      kills: match.row.kills ?? 0,
      assists: match.row.assists ?? 0,
      deaths: match.row.deaths ?? 0,
      damage: match.row.damage ?? 0,
      healing: match.row.healing ?? 0,
      mitigation: match.row.mitigation ?? 0,
      userFound: true,
      matchScore: match.matchScore,
      rowSource: match.row.strategy || "unknown",
    });
  }

  for (const player of allPlayers.slice(0, 10)) {
    if (rows.length >= 10) break;
    if (coveredPlayerIds.has(player.id)) continue;

    rows.push({
      nickname: player.nickname,
      userId: player.id,
      role: "DPS",
      kills: 0,
      assists: 0,
      deaths: 0,
      damage: 0,
      healing: 0,
      mitigation: 0,
      userFound: true,
      matchScore: 0,
      rowSource: "missing",
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
      matchScore: 0,
      rowSource: "empty",
    });
  }

  return rows.slice(0, 10);
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

  const normalizedMapType = mapType
    ? parseEnum(mapType, MAP_TYPES, "mapType")
    : detectMapType(text);

  const pipelineResult = await executeParsingPipeline(text, ocrWords, players);

  let primaryRows = [];
  let pipelineConfidence = 0;
  let selectedStrategy = "none";

  if (pipelineResult.primary) {
    const primary = pipelineResult.primary;
    selectedStrategy = primary.name;
    pipelineConfidence = primary.confidence;

    if (primary.detected instanceof Map) {
      for (const [playerId, stats] of primary.detected.entries()) {
        const player = players.find((p) => p.id === playerId);
        if (player) {
          primaryRows.push({
            nickname: player.nickname,
            userId: player.id,
            ...stats,
            strategy: selectedStrategy,
          });
        }
      }
    } else if (Array.isArray(primary.rows)) {
      primaryRows = primary.rows.slice(0, 10);
    }
  }

  const { matched: playerMatches } = matchRowsToPlayers(primaryRows, players);
  const finalRows = buildFinalRowsList(playerMatches, players);

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
    rows: finalRows,
    players,
    ocrPreview: String(text || "").slice(0, 2000),
    parsingStats: {
      confidence: pipelineConfidence,
      strategy: selectedStrategy,
      availableStrategies: pipelineResult.strategies.map((s) => ({
        name: s.name,
        confidence: s.confidence,
        rowCount: s.rowCount,
      })),
    },
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
