const draftService = require("../services/draft");

const respondError = (res, err) => {
  const message = err?.message || "Unknown error";
  const status =
    message.includes("not found")
      ? 404
      : message.includes("Unauthorized") || message.includes("Forbidden")
        ? 403
        : 400;

  return res.status(status).json({ message });
};

const createDraft = async (req, res) => {
  try {
    const draft = await draftService.createDraft(req.params.matchId, req.user);
    res.status(201).json(draft);
  } catch (err) {
    respondError(res, err);
  }
};

const startMapPicking = async (req, res) => {
  try {
    const draft = await draftService.startMapPicking(req.params.id, req.user);
    res.json(draft);
  } catch (err) {
    respondError(res, err);
  }
};

const pickMap = async (req, res) => {
  try {
    const draft = await draftService.pickMap(req.params.id, req.body, req.user);
    res.status(201).json(draft);
  } catch (err) {
    respondError(res, err);
  }
};

const startBan = async (req, res) => {
  try {
    const draft = await draftService.startBan(req.params.id, req.user);
    res.json(draft);
  } catch (err) {
    respondError(res, err);
  }
};

const banHero = async (req, res) => {
  try {
    const draft = await draftService.banHero(req.params.id, req.body, req.user);
    res.status(201).json(draft);
  } catch (err) {
    respondError(res, err);
  }
};

const endMap = async (req, res) => {
  try {
    const draft = await draftService.endMap(req.params.id, req.user);
    res.json(draft);
  } catch (err) {
    respondError(res, err);
  }
};

const getDraftState = async (req, res) => {
  try {
    const draft = await draftService.getDraftState(req.params.id);
    res.json(draft);
  } catch (err) {
    respondError(res, err);
  }
};

const getDraftByMatchId = async (req, res) => {
  try {
    const draft = await draftService.getDraftByMatchId(req.params.matchId);
    res.json(draft);
  } catch (err) {
    respondError(res, err);
  }
};

module.exports = {
  createDraft,
  startMapPicking,
  pickMap,
  startBan,
  banHero,
  endMap,
  getDraftState,
  getDraftByMatchId,
};
