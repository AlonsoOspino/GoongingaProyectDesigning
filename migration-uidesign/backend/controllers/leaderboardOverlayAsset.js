const leaderboardOverlayAssetService = require("../services/leaderboardOverlayAsset");

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const parseMatchId = (value) => {
  const matchId = Number(value);
  if (!Number.isInteger(matchId) || matchId <= 0) {
    throw new Error("Invalid match id.");
  }
  return matchId;
};

const normalizeSettings = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("settings must be an object or null.");
  }
  return value;
};

const normalizeBackgroundUrl = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error("backgroundImageUrl must be a string or null.");
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getLeaderboardOverlayAsset = async (req, res) => {
  try {
    const matchId = parseMatchId(req.params.matchId);
    const existing = await leaderboardOverlayAssetService.getByMatchId(matchId);

    if (!existing) {
      return res.json({
        matchId,
        backgroundImageUrl: null,
        settings: null,
        createdAt: null,
        updatedAt: null,
      });
    }

    return res.json(existing);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load overlay asset.";
    const status = message === "Match not found." ? 404 : 400;
    return res.status(status).json({ message });
  }
};

const upsertLeaderboardOverlayAsset = async (req, res) => {
  try {
    const matchId = parseMatchId(req.params.matchId);

    const updateData = {};
    if (hasOwn(req.body, "backgroundImageUrl")) {
      updateData.backgroundImageUrl = normalizeBackgroundUrl(req.body.backgroundImageUrl);
    }
    if (hasOwn(req.body, "settings")) {
      updateData.settings = normalizeSettings(req.body.settings);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No valid fields to update." });
    }

    const updated = await leaderboardOverlayAssetService.upsertByMatchId(matchId, updateData);
    return res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save overlay asset.";
    const status = message === "Match not found." ? 404 : 400;
    return res.status(status).json({ message });
  }
};

module.exports = {
  getLeaderboardOverlayAsset,
  upsertLeaderboardOverlayAsset,
};
