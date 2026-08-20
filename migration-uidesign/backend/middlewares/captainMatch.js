const matchService = require("../services/match");
const { resolveSeasonPlayer } = require("../utils/permissions");

module.exports = async function captainMatchMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: No user info" });
  }

  try {
    const matchId = Number(req.params.id);

    if (!Number.isInteger(matchId)) {
      return res.status(400).json({ message: "Invalid match id" });
    }

    const match = await matchService.getById(matchId);

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    const seasonPlayer = await resolveSeasonPlayer(req.user.id, match.tournamentId);
    if (seasonPlayer?.role !== "CAPTAIN") {
      return res.status(403).json({ message: "Forbidden: Captains only" });
    }

    const captainTeamId = seasonPlayer.teamId;
    const canAccess = captainTeamId === match.teamAId || captainTeamId === match.teamBId;

    if (!canAccess) {
      return res.status(403).json({ message: "Forbidden: You can only act on your own match." });
    }

    req.seasonPlayer = seasonPlayer;
    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
