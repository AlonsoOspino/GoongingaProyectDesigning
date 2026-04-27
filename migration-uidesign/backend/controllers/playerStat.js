const playerStatService = require("../services/playerStat");
const googleVisionService = require("../services/googleVision");
const PRIVILEGED_STAT_ROLES = new Set(["MANAGER", "ADMIN"]);

function resolveEffectiveUserId(req) {
  const requesterId = Number(req.user?.id);
  if (!Number.isInteger(requesterId) || requesterId <= 0) {
    const err = new Error("Unauthorized user.");
    err.statusCode = 401;
    throw err;
  }

  const requestedUserIdRaw = req.body?.userId;
  if (requestedUserIdRaw === undefined || requestedUserIdRaw === null || requestedUserIdRaw === "") {
    return requesterId;
  }

  const requestedUserId = Number(requestedUserIdRaw);
  if (!Number.isInteger(requestedUserId) || requestedUserId <= 0) {
    const err = new Error("userId must be a positive integer.");
    err.statusCode = 400;
    throw err;
  }

  const canSubmitForOthers = PRIVILEGED_STAT_ROLES.has(String(req.user?.role || "").toUpperCase());
  if (!canSubmitForOthers && requestedUserId !== requesterId) {
    const err = new Error("Forbidden: You can only submit stats for your own user.");
    err.statusCode = 403;
    throw err;
  }

  return requestedUserId;
}

const create = async (req, res) => {
  try {
    const userId = resolveEffectiveUserId(req);
    const stat = await playerStatService.create({
      ...req.body,
      userId,
    });
    res.status(201).json(stat);
  } catch (err) {
    res.status(err.statusCode || 400).json({ message: err.message });
  }
};

const createFromImage = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "image file is required (multipart/form-data, field: image)." });
    }

    const userId = resolveEffectiveUserId(req);

    const text = await googleVisionService.extractTextFromBuffer(req.file.buffer);

    const stat = await playerStatService.createFromOcrText({
      text,
      userId,
      role: req.body.role,
      mapType: req.body.mapType,
      waitTime: req.body.waitTime,
      initialTime: req.body.initialTime,
      extraRounds: req.body.extraRounds,
      gameDuration: req.body.gameDuration,
      damage: req.body.damage,
      healing: req.body.healing,
      mitigation: req.body.mitigation,
      kills: req.body.kills,
      assists: req.body.assists,
      deaths: req.body.deaths,
    });

    res.status(201).json({
      stat,
      ocrPreview: text.slice(0, 400),
    });
  } catch (err) {
    res.status(err.statusCode || 400).json({ message: err.message });
  }
};

const previewMatchFromImage = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "image file is required (multipart/form-data, field: image)." });
    }

    const ocr = await googleVisionService.extractOcrFromBuffer(req.file.buffer);

    const preview = await playerStatService.previewMatchStatsFromOcrText({
      text: ocr.text,
      ocrWords: ocr.words,
      matchId: req.body.matchId,
      mapType: req.body.mapType,
      extraRounds: req.body.extraRounds,
    });

    res.json(preview);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const confirmBatchFromPreview = async (req, res) => {
  try {
    const created = await playerStatService.createBatchFromPreview({
      matchId: req.body.matchId,
      mapType: req.body.mapType,
      extraRounds: req.body.extraRounds,
      gameDuration: req.body.gameDuration,
      rows: req.body.rows,
    });

    res.status(201).json({ count: created.length, stats: created });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getAll = async (_req, res) => {
  try {
    const stats = await playerStatService.getAll();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMine = async (req, res) => {
  try {
    const stats = await playerStatService.getByUserId(req.user.id);
    res.json(stats);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getPublic = async (_req, res) => {
  try {
    const stats = await playerStatService.getAllPublic();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPublicByUser = async (req, res) => {
  try {
    const stats = await playerStatService.getPublicByUserId(req.params.userId);
    res.json(stats);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = {
  create,
  createFromImage,
  previewMatchFromImage,
  confirmBatchFromPreview,
  getAll,
  getMine,
  getPublic,
  getPublicByUser,
};
