// middlewares/captain.js

module.exports = function captainMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: No user info" });
  }
  if (req.user.role !== "CAPTAIN") {
    return res.status(403).json({ message: "Forbidden: Captains only" });
  }
  // Check if captain's teamId matches the team being accessed (assumes team id is in req.params.id)
  if (req.user.teamId !== Number(req.params.id)) {
    return res.status(403).json({ message: "Forbidden: You can only act on your own team." });
  }
  next();
};
