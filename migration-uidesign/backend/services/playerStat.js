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
  const raw = String(value || "").trim();
  if (!raw) return 0;

  const compact = raw.replace(/\s+/g, "");
  const looksGroupedThousands = /^\d{1,3}(?:[.,]\d{3})+$/.test(compact);
  const normalized = looksGroupedThousands ? compact.replace(/[.,]/g, "") : compact.replace(/,/g, "");

  const parsed = Number(normalized);
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
  const numbers = [...String(chunk || "").matchAll(/\d[\d,.]*/g)].map((m) => parseScoreNumber(m[0]));
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
  if (!/^\d[\d,.]*$/.test(raw)) return false;

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
  [...String(line || "").matchAll(/\d[\d,.]*/g)].map((m) => parseScoreNumber(m[0]));

const findNearestNicknameBeforeIndex = (lines, index) => {
  for (let i = index - 1; i >= 0 && i >= index - 8; i -= 1) {
    const nickname = extractNicknameCandidateFromLine(lines[i]);
    if (nickname) {
      return nickname;
    }
  }
  return "";
};

const collectCandidateNicknameTokensFromLine = (line) => {
  const tokens = String(line || "")
    .split(/\s+/)
    .map((t) => String(t || "").trim())
    .filter(Boolean);

  const candidates = [];
  for (const token of tokens) {
    const normalized = normalizeName(token);
    if (!normalized) continue;
    if (normalized.length < 3 || normalized.length > 24) continue;
    if (!/[A-Z]/.test(normalized)) continue;
    if (isScoreboardNoiseLine(normalized)) continue;
    candidates.push(normalized);
  }

  return candidates;
};

const extractBestStatTupleFromNumbers = (numbers) => {
  if (!Array.isArray(numbers) || numbers.length < 6) return null;

  let best = null;
  for (let i = 0; i + 5 < numbers.length; i += 1) {
    const candidate = {
      kills: numbers[i],
      assists: numbers[i + 1],
      deaths: numbers[i + 2],
      damage: numbers[i + 3],
      healing: numbers[i + 4],
      mitigation: numbers[i + 5],
    };

    if (!isLikelyStatTuple(candidate)) continue;

    // Bias toward real stat tuples and away from level/% noise fragments.
    if (candidate.damage < 500) continue;

    const score =
      candidate.damage +
      candidate.healing +
      candidate.mitigation +
      (candidate.kills + candidate.assists + candidate.deaths) * 25;

    if (!best || score > best.score) {
      best = { ...candidate, score };
    }
  }

  return best
    ? {
        kills: best.kills,
        assists: best.assists,
        deaths: best.deaths,
        damage: best.damage,
        healing: best.healing,
        mitigation: best.mitigation,
      }
    : null;
};

const extractStatTupleNearLineIndex = (lines, index) => {
  const from = Math.max(0, index - 2);
  const to = Math.min(lines.length - 1, index + 16);
  const numbers = [];
  for (let i = from; i <= to; i += 1) {
    const line = String(lines[i] || "");
    if (!line || /^VS$/i.test(line.trim())) continue;
    for (const match of line.matchAll(/\d[\d,.]*/g)) {
      numbers.push(parseScoreNumber(match[0]));
    }
  }
  return extractBestStatTupleFromNumbers(numbers);
};

const detectPlayerRowByNicknameFuzzy = (lines, nickname) => {
  const candidates = [];

  for (let i = 0; i < lines.length; i += 1) {
    const raw = String(lines[i] || "").trim();
    if (!raw) continue;
    if (isScoreboardNoiseLine(raw)) continue;

    const extracted = extractNicknameCandidateFromLine(raw);
    const lineCandidates = new Set();
    if (extracted) lineCandidates.add(normalizeName(extracted));
    for (const token of collectCandidateNicknameTokensFromLine(raw)) {
      lineCandidates.add(token);
    }

    let localBest = 0;
    for (const candidate of lineCandidates) {
      const score = nicknameMatchScore(candidate, nickname);
      if (score > localBest) localBest = score;
    }

    if (localBest < 0.62) continue;
    const tuple = extractStatTupleNearLineIndex(lines, i);
    if (!tuple) continue;
    candidates.push({ tuple, matchScore: localBest, lineIndex: i });
  }

  return candidates;
};

const tupleLooksLikeScoreboardStats = (tuple) => {
  if (!tuple || !isLikelyStatTuple(tuple)) return false;

  const maxBigStat = Math.max(tuple.damage, tuple.healing, tuple.mitigation);
  if (maxBigStat < 1000) return false;

  // Real scoreboard rows almost always have at least one of these clearly above noise.
  if (tuple.healing < 200 && tuple.mitigation < 200) return false;

  const kadTotal = Number(tuple.kills || 0) + Number(tuple.assists || 0) + Number(tuple.deaths || 0);
  if (kadTotal > 150) return false;

  if (tuple.damage < 300 && tuple.healing < 300 && tuple.mitigation < 300) return false;
  return true;
};

const detectRowsFromTextByPlayers = (text, players) => {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter(Boolean);

  if (!lines.length || !Array.isArray(players) || !players.length) return [];

  const candidates = [];
  for (const player of players) {
    const fuzzyCandidates = detectPlayerRowByNicknameFuzzy(lines, player.nickname);
    for (const candidate of fuzzyCandidates) {
      if (!tupleLooksLikeScoreboardStats(candidate.tuple)) continue;

      const tupleQuality = statMagnitude(candidate.tuple);
      const normalizedTupleQuality = Math.min(1, tupleQuality / 45000);
      const combinedScore = candidate.matchScore * 0.7 + normalizedTupleQuality * 0.3;

      candidates.push({
        player,
        tuple: candidate.tuple,
        lineIndex: candidate.lineIndex,
        matchScore: candidate.matchScore,
        tupleQuality,
        combinedScore,
      });
    }
  }

  const usedPlayers = new Set();
  const usedTupleKeys = new Set();
  const selected = [];

  candidates
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .forEach((candidate) => {
      if (usedPlayers.has(candidate.player.id)) return;
      const tupleKey = [
        candidate.tuple.kills,
        candidate.tuple.assists,
        candidate.tuple.deaths,
        candidate.tuple.damage,
        candidate.tuple.healing,
        candidate.tuple.mitigation,
      ].join("|");
      if (usedTupleKeys.has(tupleKey)) return;

      usedPlayers.add(candidate.player.id);
      usedTupleKeys.add(tupleKey);
      selected.push({
        player: candidate.player,
        row: {
          nickname: candidate.player.nickname,
          ...candidate.tuple,
          strategy: "text-nickname-fuzzy",
          nicknameConfidence: Math.max(0.62, Math.min(0.9, candidate.matchScore)),
        },
        matchScore: Math.max(0.62, Math.min(0.9, candidate.matchScore)),
      });
    });

  return selected;
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

// ============================================================================
// ROW RECONSTRUCTION - Pure spatial, no text order dependency
// ============================================================================

const mergeNumericFragments = (numericWords, columnCenters, columnTolerance) => {
  if (!numericWords.length) return { values: {}, assignedWords: [] };

  const valuesByKey = {};
  const assignedWords = {};

  const validRanges = {
    E: { min: 0, max: 150 },
    A: { min: 0, max: 150 },
    D: { min: 0, max: 150 },
    DMG: { min: 0, max: 200000 },
    H: { min: 0, max: 200000 },
    MIT: { min: 0, max: 200000 },
  };

  numericWords.forEach((word) => {
    const x = wordCenterX(word);
    const assignment = assignStatValueToColumn(x, columnCenters);
    if (!assignment) return;

    const parsed = parseScoreNumber(word.text);
    if (!Number.isFinite(parsed) || parsed < 0) return;

    const range = validRanges[assignment.key];
    if (parsed > range.max) return;

    if (valuesByKey[assignment.key] === undefined) {
      valuesByKey[assignment.key] = parsed;
      assignedWords[assignment.key] = word;
    } else {
      const current = valuesByKey[assignment.key];
      const currentDist = Math.abs(wordCenterX(assignedWords[assignment.key]) - (columnCenters[assignment.key] || 0));
      const newDist = Math.abs(x - (columnCenters[assignment.key] || 0));
      
      if (newDist < currentDist || parsed > current) {
        valuesByKey[assignment.key] = parsed;
        assignedWords[assignment.key] = word;
      }
    }
  });

  return { values: valuesByKey, assignedWords };
};

const reconstructRowFromCluster = (rowCluster, columnCenters, minStatX) => {
  if (!rowCluster || !rowCluster.words.length) return null;

  const numericWords = rowCluster.words
    .filter((w) => looksNumericToken(w.text) && wordCenterX(w) >= minStatX)
    .sort((a, b) => wordCenterX(a) - wordCenterX(b));

  if (numericWords.length < 6) return null;

  const { values: statValues, assignedWords } = mergeNumericFragments(
    numericWords,
    columnCenters,
    calculateDynamicColumnTolerance(columnCenters)
  );

  if (
    statValues.E === undefined ||
    statValues.A === undefined ||
    statValues.D === undefined ||
    statValues.DMG === undefined
  ) {
    return null;
  }

  const reconstructionScore = calculateRowReconstructionScore(
    statValues,
    assignedWords,
    columnCenters,
    rowCluster
  );

  return {
    kills: statValues.E ?? 0,
    assists: statValues.A ?? 0,
    deaths: statValues.D ?? 0,
    damage: statValues.DMG ?? 0,
    healing: statValues.H ?? 0,
    mitigation: statValues.MIT ?? 0,
    reconstructionScore: reconstructionScore.score,
    reconstructionDetail: reconstructionScore.detail,
    method: "spatial-reconstruction",
    assignedWords,
  };
};

const calculateRowReconstructionScore = (statValues, assignedWords, columnCenters, rowCluster) => {
  let score = 0.78;
  const details = {};

  if (Object.keys(statValues).length >= 6) {
    details.completeStats = true;
    score += 0.15;
  } else if (Object.keys(statValues).length >= 4) {
    details.partialStats = true;
    score += 0.08;
  }

  const validStats = Object.entries(statValues).every(([key, val]) => {
    if (key === "E") return val <= 120;
    if (key === "A") return val <= 120;
    if (key === "D") return val <= 120;
    if (["DMG", "H", "MIT"].includes(key)) return val >= 0 && val <= 120000;
    return false;
  });

  if (validStats) {
    details.validRanges = true;
    score += 0.12;
  }

  const columnQuality = Object.entries(assignedWords).reduce((sum, [key, word]) => {
    const x = wordCenterX(word);
    const cx = columnCenters[key];
    const distance = Math.abs(x - cx);
    const tolerance = calculateDynamicColumnTolerance(columnCenters);
    return sum + (1 - Math.min(1, distance / (tolerance * 2)));
  }, 0) / Math.max(1, Object.keys(assignedWords).length);

  score += columnQuality * 0.06;
  details.columnQuality = columnQuality;

  const yVariance = rowCluster.words.map(wordCenterY);
  if (yVariance.length > 1) {
    const yMean = yVariance.reduce((a, b) => a + b) / yVariance.length;
    const yStdDev = Math.sqrt(yVariance.reduce((sum, y) => sum + Math.pow(y - yMean, 2)) / yVariance.length);
    const yAlignment = Math.max(0, 1 - yStdDev / 20);
    score += yAlignment * 0.04;
    details.yAlignment = yAlignment;
  }

  return {
    score: Math.min(1, score),
    detail: details,
  };
};

const extractNicknameFromRowGeometry = (rowCluster, minStatX) => {
  const nicknameWords = rowCluster.words.filter(
    (w) => wordCenterX(w) < minStatX - 20 && /[A-Za-z]/.test(w.text)
  );

  if (!nicknameWords.length) return null;

  const aggressiveMerge = mergeAdjacentNicknameWords(nicknameWords, 35);

  const candidates = aggressiveMerge
    .filter((group) => {
      const text = group.text;
      if (text.length < 3 || text.length > 35) return false;
      if (!/[A-Za-z]/.test(text)) return false;
      if (isRankTitle({ text })) return false;
      const hasUppercase = /[A-Z]/.test(text);
      const hasLowercase = /[a-z]/.test(text);
      if (hasLowercase && !hasUppercase) return false;
      return true;
    })
    .map((group) => {
      const mergeBonus = (group.words.length - 1) * 0.1;
      const bboxWidth = group.bbox.x1 - group.bbox.x0;
      const densityScore = Math.max(0, 1 - bboxWidth / 300);

      return {
        text: group.text,
        wordCount: group.words.length,
        confidence: Math.min(1, 0.65 + group.words.length * 0.12 + densityScore * 0.05),
        bbox: group.bbox,
      };
    });

  if (!candidates.length) return null;

  const best = candidates.sort((a, b) => {
    if (b.wordCount !== a.wordCount) return b.wordCount - a.wordCount;
    return b.confidence - a.confidence;
  })[0];

  return {
    text: best.text,
    confidence: best.confidence,
  };
};


const deduplicateReconstructedRows = (rows) => {
  if (rows.length <= 1) return rows;

  const minQualityThreshold = 0.50;
  const filtered = rows.filter((r) => {
    const qualityScore = (r.reconstructionScore || 0) + (r.nicknameConfidence || 0);
    const qualityMean = qualityScore / 2;
    return qualityMean >= minQualityThreshold;
  });

  if (!filtered.length) return [];

  const deduped = [];
  const usedIndices = new Set();

  filtered.forEach((row, idx) => {
    if (usedIndices.has(idx)) return;

    let best = row;
    let bestIdx = idx;
    const duplicates = [idx];

    for (let j = idx + 1; j < filtered.length; j++) {
      if (usedIndices.has(j)) continue;

      const other = filtered[j];
      const nicknameScore = nicknameMatchScore(row.nickname, other.nickname);
      const yProximity = Math.abs(row.y - other.y);

      const nicknameSimilar = nicknameScore >= 0.62;
      const geometricallyClose = yProximity <= 65;
      const botherReasonableQuality =
        (other.reconstructionScore || 0) >= 0.48 && (other.nicknameConfidence || 0) >= 0.38;

      if (nicknameSimilar && geometricallyClose && botherReasonableQuality) {
        duplicates.push(j);

        const bestQuality = (best.reconstructionScore || 0) + (best.nicknameConfidence || 0);
        const otherQuality = (other.reconstructionScore || 0) + (other.nicknameConfidence || 0);

        if (
          otherQuality > bestQuality ||
          (Math.abs(otherQuality - bestQuality) < 0.01 && other.kills > best.kills)
        ) {
          best = other;
          bestIdx = j;
        }
      }
    }

    deduped.push(best);
    duplicates.forEach((di) => usedIndices.add(di));
  });

  return deduped.sort((a, b) => a.y - b.y);
};


const reconstructScoreboardRows = (ocrWords, columnCenters) => {
  if (!Array.isArray(ocrWords) || !ocrWords.length) {
    return { rows: [], score: 0 };
  }

  const rows = clusterRowsByY(ocrWords);
  if (!rows.length) {
    return { rows: [], score: 0 };
  }

  if (!columnCenters) {
    return { rows: [], score: 0 };
  }

  const minStatX = estimateColumnMinX(columnCenters);
  const reconstructed = [];
  let validRowCount = 0;

  for (const rowCluster of rows) {
    const stats = reconstructRowFromCluster(rowCluster, columnCenters, minStatX);
    if (!stats) continue;

    const nickname = extractNicknameFromRowGeometry(rowCluster, minStatX);
    if (!nickname) continue;

    reconstructed.push({
      nickname: nickname.text,
      nicknameConfidence: nickname.confidence,
      ...stats,
      y: rowCluster.y,
    });

    validRowCount += 1;
  }

  const dedupedRows = deduplicateReconstructedRows(
    reconstructed.sort((a, b) => a.y - b.y)
  );

  const overallScore = dedupedRows.length > 0 ? Math.min(1, dedupedRows.length / 10) : 0;

  return {
    rows: dedupedRows,
    score: overallScore,
    validRowCount: dedupedRows.length,
  };
};

const parseGenericRows = (text) => {
  const content = String(text || "");
  const pattern = /([A-Za-z0-9_]{3,20})[^\n\d]{0,30}(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s+([\d,.]{1,10})\s+([\d,.]{1,10})\s+([\d,.]{1,10})/g;
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
  if (a.slice(0, 5) === b.slice(0, 5) && Math.min(a.length, b.length) >= 5) return 0.78;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen >= 4) {
    const distance = levenshteinDistance(a, b);
    const similarity = 1 - distance / maxLen;
    
    const lastCharMatch = a[a.length - 1] === b[b.length - 1] ? 0.05 : 0;
    
    if (similarity >= 0.8) return Math.min(1, 0.82 + lastCharMatch);
    if (similarity >= 0.72) return Math.min(1, 0.73 + lastCharMatch * 0.5);
    if (similarity >= 0.65) return 0.65;
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
  if (ys.length < 3) return 12;
  const { stdDev } = calculateYDensity(ys);
  return Math.max(10, Math.min(22, stdDev * 0.5));
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

// ============================================================================
// OCR FILTERING & GARBAGE DETECTION - Clean OCR before parsing
// ============================================================================

const isGarbageWord = (word) => {
  const text = String(word?.text || "").trim();
  if (!text) return true;

  if (text.length === 1) {
    const token = tokenizeForMatch(text);
    const allowSingles = new Set(["E", "A", "D", "H", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    if (!allowSingles.has(token)) return true;
  }

  if (/%/.test(text)) return true;
  if (/^[\d,]+%$/.test(text)) return true;

  if (text.match(/^[^a-zA-Z0-9]{1,3}$/)) return true;

  const width = wordWidth(word);
  const height = wordHeight(word);
  if (width < 2 || height < 2) return true;

  if (width > 1000 || height > 1000) return true;

  if (!isLooksLikeScoreboardContent(text)) {
    if (!/^[A-Za-z0-9_,]+$/.test(text)) return true;
  }

  return false;
};

const isLooksLikeScoreboardContent = (text) => {
  if (/^[A-Za-z0-9_]{2,35}$/.test(text)) return true;
  if (/^[\d,]+$/.test(text)) return true;
  return false;
};


const isUIWord = (word) => {
  const token = tokenizeForMatch(word?.text || "");
  if (!token) return false;

  const uiKeywords = [
    "FPS",
    "TMP",
    "VRM",
    "PING",
    "TIME",
    "INTERACT",
    "VS",
    "ROUND",
    "PHASE",
    "ATHENA",
    "CIRCUITROYAL",
  ];

  return uiKeywords.some((kw) => token === kw || token.startsWith(kw));
};

const rankTitlePatterns = [
  /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/,
  /^[A-Z][a-z']+(?:\s+[A-Z][a-z']+)*$/,
  /^\w+[']\w+$/,
  /^(?:The\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:'s)?(?:\s+[A-Z][a-z]+)*$/,
];

const isRankTitle = (word) => {
  const text = String(word?.text || "").trim();
  if (text.length < 4 || text.length > 35) return false;
  if (!/[a-z]/.test(text)) return false;

  if (rankTitlePatterns.some((pat) => pat.test(text))) {
    return true;
  }

  const hasApostropheAndMixedCase = /'/.test(text) && /[A-Z]/.test(text) && /[a-z]/.test(text);
  if (hasApostropheAndMixedCase) {
    return true;
  }

  return false;
};

const isReliableWord = (word) => {
  return !isGarbageWord(word) && !isUIWord(word) && !isRankTitle(word);
};

// ============================================================================
// ADAPTIVE ROW HEIGHT & OVERLAP DETECTION
// ============================================================================

const estimateRowHeight = (words) => {
  if (!words.length) return 20;
  const heights = words
    .map(wordHeight)
    .filter((h) => h > 0 && h < 100)
    .sort((a, b) => a - b);

  if (!heights.length) return 20;
  const median = heights[Math.floor(heights.length / 2)];
  return Math.max(15, median * 1.3);
};

const getBboxOverlap = (y1, h1, y2, h2) => {
  const top1 = y1;
  const bottom1 = y1 + h1;
  const top2 = y2;
  const bottom2 = y2 + h2;

  const overlapTop = Math.max(top1, top2);
  const overlapBottom = Math.min(bottom1, bottom2);

  if (overlapBottom <= overlapTop) return 0;
  return (overlapBottom - overlapTop) / Math.min(h1, h2);
};

const hasSignificantBboxOverlap = (word1, word2, threshold = 0.3) => {
  const y1 = Number(word1?.bbox?.y0 || 0);
  const y2 = Number(word2?.bbox?.y0 || 0);
  const h1 = wordHeight(word1);
  const h2 = wordHeight(word2);

  const overlap = getBboxOverlap(y1, h1, y2, h2);
  return overlap >= threshold;
};

const belongsToSameRow = (word1, word2, rowTolerance) => {
  const y1 = wordCenterY(word1);
  const y2 = wordCenterY(word2);
  const yDistance = Math.abs(y1 - y2);

  if (yDistance <= rowTolerance) return true;

  if (yDistance <= rowTolerance * 1.5 && hasSignificantBboxOverlap(word1, word2, 0.3)) {
    return true;
  }

  return false;
};

const clusterRowsByY = (words, manualTolerance = null) => {
  if (!Array.isArray(words) || !words.length) return [];

  const cleanWords = words.filter(isReliableWord);
  if (!cleanWords.length) return [];

  const sorted = [...cleanWords].sort((a, b) => wordCenterY(a) - wordCenterY(b));
  const tolerance = manualTolerance ?? detectRowTolerance(sorted);
  const rowHeight = estimateRowHeight(sorted);
  const outlierYs = identifyOutlierYs(
    sorted.map(wordCenterY),
    tolerance
  );

  const rows = [];
  for (const word of sorted) {
    const y = wordCenterY(word);
    if (outlierYs.has(y)) continue;

    let assignedRow = null;
    for (const candidate of rows) {
      if (belongsToSameRow(word, candidate.words[0], tolerance)) {
        assignedRow = candidate;
        break;
      }
    }

    if (assignedRow) {
      assignedRow.words.push(word);
      assignedRow.y = (assignedRow.y * (assignedRow.words.length - 1) + y) / assignedRow.words.length;
    } else {
      rows.push({ y, words: [word], height: rowHeight });
    }
  }

  for (const row of rows) {
    row.words.sort((a, b) => wordCenterX(a) - wordCenterX(b));
  }

  return rows.filter((row) => row.words.length >= 2);
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

const looksNumericToken = (text) => /^\d[\d,.]*$/.test(String(text || "").trim());

const calculateDynamicColumnTolerance = (columnCenters) => {
  if (!columnCenters || Object.keys(columnCenters).length < 2) {
    return 80;
  }
  const values = Object.values(columnCenters);
  const minX = Math.min(...values);
  const maxX = Math.max(...values);
  const spacing = (maxX - minX) / (Object.keys(columnCenters).length - 1 || 1);
  const baseTolerance = Math.max(35, spacing * 0.25);
  return Math.min(120, baseTolerance);
};

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

  const dynamicTolerance = calculateDynamicColumnTolerance(columnCenters);

  if (bestKey && bestDistance <= dynamicTolerance) {
    return { key: bestKey, distance: bestDistance, tolerance: dynamicTolerance };
  }

  return null;
};

// ============================================================================
// NICKNAME EXTRACTION FROM GEOMETRY - Improved multi-word support
// ============================================================================

const mergeAdjacentNicknameWords = (words, maxDistance = 15) => {
  if (!words.length) return [];

  const sorted = [...words].sort((a, b) => wordCenterX(a) - wordCenterX(b));
  const merged = [];

  let currentGroup = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = currentGroup[currentGroup.length - 1];
    const curr = sorted[i];
    const x1 = Number(prev?.bbox?.x1 || 0);
    const x2 = Number(curr?.bbox?.x0 || 0);
    const gap = x2 - x1;

    if (gap <= maxDistance) {
      currentGroup.push(curr);
    } else {
      merged.push({
        words: currentGroup,
        text: currentGroup.map((w) => w.text).join(""),
        bbox: {
          x0: Number(currentGroup[0]?.bbox?.x0 || 0),
          x1: Number(currentGroup[currentGroup.length - 1]?.bbox?.x1 || 0),
        },
      });
      currentGroup = [curr];
    }
  }

  if (currentGroup.length > 0) {
    merged.push({
      words: currentGroup,
      text: currentGroup.map((w) => w.text).join(""),
      bbox: {
        x0: Number(currentGroup[0]?.bbox?.x0 || 0),
        x1: Number(currentGroup[currentGroup.length - 1]?.bbox?.x1 || 0),
      },
    });
  }

  return merged;
};

const extractNicknamesFromRowWords = (rowWords, minStatX) => {
  const candidates = rowWords.filter((w) => wordCenterX(w) < minStatX - 10);
  if (!candidates.length) return [];

  const merged = mergeAdjacentNicknameWords(candidates, 20);

  return merged
    .filter((group) => {
      const text = group.text;
      if (text.length < 3 || text.length > 30) return false;
      if (!/[A-Z]/.test(text)) return false;
      if (isRankTitle({ text })) return false;
      return true;
    })
    .map((group) => ({
      text: group.text,
      bbox: group.bbox,
      wordCount: group.words.length,
      confidence: Math.min(1, group.words.length * 0.4),
    }));
};

const pickBestNicknameCandidateFromRow = (rowWords, minStatX) => {
  const candidates = extractNicknamesFromRowWords(rowWords, minStatX);
  if (!candidates.length) return null;

  const sorted = candidates.sort((a, b) => {
    if (b.wordCount !== a.wordCount) return b.wordCount - a.wordCount;
    return b.bbox.x1 - b.bbox.x0 - (a.bbox.x1 - a.bbox.x0);
  });

  return sorted[0].text || null;
};

const parseStatsFromRowWords = (rowWords, columnCenters) => {
  if (!columnCenters) return { stats: null, confidence: 0 };

  const minStatX = estimateColumnMinX(columnCenters);
  const numericWords = rowWords
    .filter((w) => looksNumericToken(w.text) && wordCenterX(w) >= minStatX)
    .sort((a, b) => wordCenterX(a) - wordCenterX(b));

  if (!numericWords.length) return { stats: null, confidence: 0 };

  const valuesByKey = {};
  let assignmentQuality = 0;
  let validAssignments = 0;

  for (const word of numericWords) {
    const x = wordCenterX(word);
    const assignment = assignStatValueToColumn(x, columnCenters);
    if (!assignment) continue;

    const parsed = parseScoreNumber(word.text);
    if (!Number.isFinite(parsed)) continue;

    if (valuesByKey[assignment.key] === undefined) {
      valuesByKey[assignment.key] = parsed;
      validAssignments += 1;
      const qualityScore = 1 - Math.min(1, assignment.distance / assignment.tolerance);
      assignmentQuality += qualityScore;
    }
  }

  const avgAssignmentQuality = validAssignments > 0 ? assignmentQuality / validAssignments : 0;

  if (
    valuesByKey.E !== undefined &&
    valuesByKey.A !== undefined &&
    valuesByKey.D !== undefined &&
    valuesByKey.DMG !== undefined
  ) {
    return {
      stats: {
        kills: valuesByKey.E ?? 0,
        assists: valuesByKey.A ?? 0,
        deaths: valuesByKey.D ?? 0,
        damage: valuesByKey.DMG ?? 0,
        healing: valuesByKey.H ?? 0,
        mitigation: valuesByKey.MIT ?? 0,
      },
      confidence: Math.min(1, 0.85 + avgAssignmentQuality * 0.15),
      method: "column-detection",
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
      return {
        stats: { kills: e, assists: a, deaths: d, damage: dmg, healing: heal, mitigation: mit },
        confidence: 0.72,
        method: "left-to-right-fallback",
      };
    }
  }

  return { stats: null, confidence: 0 };
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
    const nicknameCandidates = ocrWords
      .map((word) => ({
        word,
        score: nicknameMatchScore(word.text, player.nickname),
      }))
      .filter((entry) => entry.score >= 0.62)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    if (!nicknameCandidates.length) continue;

    let bestParsed = null;
    for (const candidateWord of nicknameCandidates) {
      const targetY = wordCenterY(candidateWord.word);
      let row = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const candidateRow of rows) {
        const distance = Math.abs(candidateRow.y - targetY);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          row = candidateRow;
        }
      }

      if (!row) continue;

      const avgRowHeight = rows.reduce((sum, r) => sum + r.height, 0) / rows.length;
      const maxYDistance = Math.max(18, avgRowHeight * 1.7);
      if (nearestDistance > maxYDistance) continue;

      const stats = parseStatsFromRowWords(row.words, columnCenters);
      if (!stats || !stats.stats) continue;

      const candidateQuality = (stats.confidence || 0) * 0.65 + candidateWord.score * 0.35;
      if (!bestParsed || candidateQuality > bestParsed.quality) {
        bestParsed = {
          stats,
          quality: candidateQuality,
        };
      }
    }

    if (!bestParsed || !bestParsed.stats?.stats) continue;

    detected.set(player.id, {
      ...bestParsed.stats.stats,
      confidence: bestParsed.stats.confidence,
      method: bestParsed.stats.method,
    });
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
    return { rows: [], confidence: 0, strategy: "spatial-reconstruction" };
  }

  const reliableWords = ocrWords.filter(isReliableWord);
  if (reliableWords.length === 0) {
    return { rows: [], confidence: 0, strategy: "spatial-reconstruction" };
  }

  const rows = clusterRowsByY(reliableWords);
  if (!rows.length) {
    return { rows: [], confidence: 0, strategy: "spatial-reconstruction" };
  }

  const columnCenters = detectColumnCenters(rows);
  if (!columnCenters) {
    return { rows: [], confidence: 0, strategy: "spatial-reconstruction" };
  }

  const { rows: reconstructed, score, validRowCount } = reconstructScoreboardRows(
    reliableWords,
    columnCenters
  );

  const baseConfidence = score + 0.15;
  const confidence = Math.max(0, Math.min(1, baseConfidence));

  return {
    rows: reconstructed,
    confidence,
    strategy: "spatial-reconstruction",
    validRowCount,
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
// PIPELINE ORCHESTRATOR - Spatial reconstruction as primary strategy
// ============================================================================

const executeParsingPipeline = async (text, ocrWords, players) => {
  const strategies = [];
  let spatialRowCount = 0;

  if (Array.isArray(ocrWords) && ocrWords.length > 0) {
    const spatialResult = parseRowsFromNumericGrid(ocrWords);
    if (spatialResult.rows.length > 0) {
      spatialRowCount = spatialResult.rows.length;
      strategies.push({
        name: "spatial-reconstruction",
        confidence: Math.min(1, spatialResult.confidence + 0.25),
        rows: spatialResult.rows,
        rowCount: spatialResult.rows.length,
        priority: 100,
      });
    }

    if (Array.isArray(players) && players.length > 0) {
      const geometryResult = detectStatsByWordGeometry(ocrWords, players);
      if (geometryResult.rowCount > 0) {
        const geometryPriority =
          geometryResult.rowCount >= Math.max(6, spatialRowCount + 2) ? 115 : 95;
        strategies.push({
          name: "geometry-player-matched",
          confidence: geometryResult.confidence,
          detected: geometryResult.detected,
          rowCount: geometryResult.rowCount,
          priority: geometryPriority,
        });
      }
    }
  }

  const genericResult = parseGenericRows(text);
  if (genericResult.rows.length > 0 && !spatialRowCount) {
    strategies.push({
      name: "generic-regex",
      confidence: genericResult.confidence,
      rows: genericResult.rows,
      rowCount: genericResult.rows.length,
      priority: 10,
    });
  }

  strategies.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (b.rowCount !== a.rowCount) return b.rowCount - a.rowCount;
    return b.confidence - a.confidence;
  });

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

    const minThreshold = row.nicknameConfidence !== undefined && row.nicknameConfidence < 0.6 ? 0.65 : 0.7;

    if (bestPlayer && bestScore >= minThreshold) {
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

const statMagnitude = (row) =>
  Number(row?.damage || 0) +
  Number(row?.healing || 0) +
  Number(row?.mitigation || 0) +
  (Number(row?.kills || 0) + Number(row?.assists || 0) + Number(row?.deaths || 0)) * 25;

const mergePlayerMatches = (primaryMatches, fallbackMatches) => {
  const byPlayerId = new Map();

  for (const match of primaryMatches || []) {
    byPlayerId.set(match.player.id, match);
  }

  for (const fallback of fallbackMatches || []) {
    const existing = byPlayerId.get(fallback.player.id);
    if (!existing) {
      byPlayerId.set(fallback.player.id, fallback);
      continue;
    }

    const existingMagnitude = statMagnitude(existing.row);
    const fallbackMagnitude = statMagnitude(fallback.row);

    if (
      fallbackMagnitude > existingMagnitude * 1.1 ||
      (existingMagnitude === 0 && fallbackMagnitude > 0)
    ) {
      byPlayerId.set(fallback.player.id, fallback);
    }
  }

  return Array.from(byPlayerId.values());
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
  const textFallbackMatches = detectRowsFromTextByPlayers(text, players);
  const combinedMatches =
    playerMatches.length >= 8
      ? playerMatches
      : mergePlayerMatches(playerMatches, textFallbackMatches);
  const finalRows = buildFinalRowsList(combinedMatches, players);

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
      textFallbackMatches: textFallbackMatches.length,
      combinedMatches: combinedMatches.length,
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
