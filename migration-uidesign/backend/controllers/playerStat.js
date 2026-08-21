const playerStatService = require("../services/playerStat");
const { hasNetworkRole } = require("../utils/permissions");

function canSubmitForOthers(user) {
  return hasNetworkRole(user, "ADMIN", "SOCIAL_MEDIA");
}

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

  if (!canSubmitForOthers(req.user) && requestedUserId !== requesterId) {
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

const createBatch = async (req, res) => {
  try {
    const created = await playerStatService.createBatch({
      matchId: req.body.matchId,
      games: req.body.games,
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
  createBatch,
  getAll,
  getMine,
  getPublic,
  getPublicByUser,
  __testables: { canSubmitForOthers, resolveEffectiveUserId },
};
