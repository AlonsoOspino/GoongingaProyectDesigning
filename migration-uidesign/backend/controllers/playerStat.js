const playerStatService = require("../services/playerStat");
const googleVisionService = require("../services/googleVision");

const create = async (req, res) => {
  try {
    const stat = await playerStatService.create(req.body);
    res.status(201).json(stat);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const createFromImage = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "image file is required (multipart/form-data, field: image)." });
    }

    const userId = req.body.userId || req.user?.id;
    if (!userId) {
      return res.status(400).json({ message: "userId is required." });
    }

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
    res.status(400).json({ message: err.message });
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
