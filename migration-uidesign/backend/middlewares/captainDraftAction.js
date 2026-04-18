const matchService = require("../services/match");

module.exports = async function captainDraftActionMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: No user info" });
  }

  if (req.user.role !== "CAPTAIN") {
    return res.status(403).json({ message: "Forbidden: Captains only" });
  }

  try {
    const matchIdValue = Number(req.body.matchId);

    if (!Number.isInteger(matchIdValue)) {
      return res.status(400).json({ message: "matchId is required" });
    }

    const match = await matchService.getById(matchIdValue);

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    const captainTeamId = Number(req.user.teamId);
    const canAccess = captainTeamId === match.teamAId || captainTeamId === match.teamBId;

    if (!canAccess) {
      return res.status(403).json({ message: "Forbidden: You can only act on your own match." });
    }

    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};