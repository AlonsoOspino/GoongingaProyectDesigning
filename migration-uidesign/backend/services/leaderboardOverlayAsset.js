const matchRepo = require("../repositories/match");
const leaderboardOverlayAssetRepo = require("../repositories/leaderboardOverlayAsset");

const normalizeMatchId = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("matchId must be a positive integer.");
  }
  return parsed;
};

const ensureMatchExists = async (matchId) => {
  const match = await matchRepo.findById(matchId);
  if (!match) {
    throw new Error("Match not found.");
  }
  return match;
};

const getByMatchId = async (matchIdInput) => {
  const matchId = normalizeMatchId(matchIdInput);
  await ensureMatchExists(matchId);
  return leaderboardOverlayAssetRepo.findByMatchId(matchId);
};

const upsertByMatchId = async (matchIdInput, data) => {
  const matchId = normalizeMatchId(matchIdInput);
  await ensureMatchExists(matchId);
  return leaderboardOverlayAssetRepo.upsertByMatchId(matchId, data);
};

module.exports = {
  getByMatchId,
  upsertByMatchId,
};
