const sharp = require("sharp");
const { createWorker } = require("tesseract.js");

let workerPromise = null;

const getWorker = async () => {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    const worker = await createWorker("eng");
    return worker;
  })();

  return workerPromise;
};

const cleanDigits = (value) => String(value || "").replace(/[^0-9,]/g, "").trim();

const parseStatNumber = (value) => {
  const cleaned = cleanDigits(value).replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

const cleanNickname = (value) =>
  String(value || "")
    .replace(/[^A-Za-z0-9_\-]/g, "")
    .trim();

const relBox = (width, height, x, y, w, h) => ({
  left: Math.max(0, Math.round(width * x)),
  top: Math.max(0, Math.round(height * y)),
  width: Math.max(1, Math.round(width * w)),
  height: Math.max(1, Math.round(height * h)),
});

const parseStatWindow = (numbers) => {
  for (let i = 0; i + 5 < numbers.length; i += 1) {
    const e = numbers[i];
    const a = numbers[i + 1];
    const d = numbers[i + 2];
    const dmg = numbers[i + 3];
    const heal = numbers[i + 4];
    const mit = numbers[i + 5];

    const validCore = e <= 120 && a <= 120 && d <= 120;
    const validLarge = dmg <= 120000 && heal <= 120000 && mit <= 120000;
    if (validCore && validLarge) {
      return { kills: e, assists: a, deaths: d, damage: dmg, healing: heal, mitigation: mit };
    }
  }
  return null;
};

const recognizeRegion = async ({ imageBuffer, box, kind, thresholdValue, scale, psm }) => {
  const worker = await getWorker();

  const processed = await sharp(imageBuffer)
    .extract(box)
    .resize({ width: Math.max(1, Math.round(box.width * scale)), height: Math.max(1, Math.round(box.height * scale)), kernel: sharp.kernel.nearest })
    .grayscale()
    .normalize()
    .threshold(thresholdValue)
    .toBuffer();

  const parameters = {
    tessedit_pageseg_mode: String(psm),
    preserve_interword_spaces: "1",
  };

  if (kind === "digits") {
    parameters.tessedit_char_whitelist = "0123456789, ";
  } else {
    parameters.tessedit_char_whitelist = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  }

  const result = await worker.recognize(processed, {}, parameters);
  return {
    text: result?.data?.text || "",
    confidence: Number(result?.data?.confidence || 0),
  };
};

const ocrBest = async ({ imageBuffer, box, kind, thresholds, scale, psm }) => {
  let best = { text: "", confidence: -1 };
  for (const t of thresholds) {
    const out = await recognizeRegion({ imageBuffer, box, kind, thresholdValue: t, scale, psm });
    const trimmed = String(out.text || "").trim();
    if (!trimmed) continue;
    if (out.confidence > best.confidence) {
      best = out;
    }
  }
  return best.text || "";
};

const parseNumbersFromText = (text) => {
  const nums = [...String(text || "").matchAll(/\d[\d,]*/g)].map((m) => parseStatNumber(m[0]));
  return nums;
};

const readStatLine = async ({ imageBuffer, box }) => {
  const attempts = [
    { thresholds: [120, 140, 160, 180], scale: 4, psm: 7 },
    { thresholds: [140, 165, 190], scale: 5, psm: 6 },
  ];

  let bestTuple = null;
  let bestScore = -1;

  for (const attempt of attempts) {
    const text = await ocrBest({
      imageBuffer,
      box,
      kind: "digits",
      thresholds: attempt.thresholds,
      scale: attempt.scale,
      psm: attempt.psm,
    });

    const numbers = parseNumbersFromText(text);
    const tuple = parseStatWindow(numbers);
    if (!tuple) continue;

    let score = numbers.length;
    if (tuple.damage > 0) score += 4;
    if (tuple.healing > 0 || tuple.mitigation > 0) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestTuple = tuple;
    }
  }

  return bestTuple;
};

const readDurationSeconds = async (buffer, width, height) => {
  const timeBox = relBox(width, height, 0.90, 0.035, 0.085, 0.05);
  const timeText = await ocrBest({
    imageBuffer: buffer,
    box: timeBox,
    kind: "digits",
    thresholds: [130, 155, 180],
    scale: 3,
    psm: 7,
  });
  const match = String(timeText).match(/(\d{1,2})\D?(\d{2})/);
  if (!match) return 0;

  const mm = Number(match[1]);
  const ss = Number(match[2]);
  if (!Number.isFinite(mm) || !Number.isFinite(ss)) return 0;
  return mm * 60 + ss;
};

const readScoreboardRowsFromImage = async (buffer) => {
  const meta = await sharp(buffer).metadata();
  const width = Number(meta.width || 0);
  const height = Number(meta.height || 0);

  if (!width || !height) {
    throw new Error("Invalid screenshot dimensions.");
  }

  const rowHeight = 0.048;
  const topStart = 0.185;
  const rowStep = 0.061;
  const bottomStart = 0.557;

  const xCols = {
    nickname: [0.168, 0.165],
    statLine: [0.352, 0.310],
    fallback: {
      e: [0.358, 0.032],
      a: [0.391, 0.032],
      d: [0.422, 0.032],
      dmg: [0.452, 0.072],
      h: [0.522, 0.065],
      mit: [0.583, 0.070],
    },
  };

  const rowY = [];
  for (let i = 0; i < 5; i += 1) rowY.push(topStart + i * rowStep);
  for (let i = 0; i < 5; i += 1) rowY.push(bottomStart + i * rowStep);

  const rows = [];

  for (let i = 0; i < rowY.length; i += 1) {
    const y = rowY[i];

    const nicknameRaw = await ocrBest({
      imageBuffer: buffer,
      box: relBox(width, height, xCols.nickname[0], y, xCols.nickname[1], rowHeight),
      kind: "name",
      thresholds: [115, 140, 165],
      scale: 3,
      psm: 7,
    });

    const statTuple = await readStatLine({
      imageBuffer: buffer,
      box: relBox(width, height, xCols.statLine[0], y, xCols.statLine[1], rowHeight),
    });

    let tuple = statTuple;
    if (!tuple) {
      const eRaw = await ocrBest({ imageBuffer: buffer, box: relBox(width, height, xCols.fallback.e[0], y, xCols.fallback.e[1], rowHeight), kind: "digits", thresholds: [120, 145, 170], scale: 3, psm: 7 });
      const aRaw = await ocrBest({ imageBuffer: buffer, box: relBox(width, height, xCols.fallback.a[0], y, xCols.fallback.a[1], rowHeight), kind: "digits", thresholds: [120, 145, 170], scale: 3, psm: 7 });
      const dRaw = await ocrBest({ imageBuffer: buffer, box: relBox(width, height, xCols.fallback.d[0], y, xCols.fallback.d[1], rowHeight), kind: "digits", thresholds: [120, 145, 170], scale: 3, psm: 7 });
      const dmgRaw = await ocrBest({ imageBuffer: buffer, box: relBox(width, height, xCols.fallback.dmg[0], y, xCols.fallback.dmg[1], rowHeight), kind: "digits", thresholds: [120, 145, 170], scale: 3, psm: 7 });
      const hRaw = await ocrBest({ imageBuffer: buffer, box: relBox(width, height, xCols.fallback.h[0], y, xCols.fallback.h[1], rowHeight), kind: "digits", thresholds: [120, 145, 170], scale: 3, psm: 7 });
      const mitRaw = await ocrBest({ imageBuffer: buffer, box: relBox(width, height, xCols.fallback.mit[0], y, xCols.fallback.mit[1], rowHeight), kind: "digits", thresholds: [120, 145, 170], scale: 3, psm: 7 });
      tuple = {
        kills: parseStatNumber(eRaw),
        assists: parseStatNumber(aRaw),
        deaths: parseStatNumber(dRaw),
        damage: parseStatNumber(dmgRaw),
        healing: parseStatNumber(hRaw),
        mitigation: parseStatNumber(mitRaw),
      };
    }

    rows.push({
      nickname: cleanNickname(nicknameRaw) || `PLAYER_${i + 1}`,
      kills: tuple.kills,
      assists: tuple.assists,
      deaths: tuple.deaths,
      damage: tuple.damage,
      healing: tuple.healing,
      mitigation: tuple.mitigation,
    });
  }

  const gameDuration = await readDurationSeconds(buffer, width, height);

  return {
    rows,
    gameDuration,
  };
};

module.exports = {
  readScoreboardRowsFromImage,
};
