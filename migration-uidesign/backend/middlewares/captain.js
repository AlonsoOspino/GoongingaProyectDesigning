const prisma = require("../config/prisma");
const { isCaptainOf } = require("../utils/permissions");

module.exports = async function captainMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: No user info" });
  }
  try {
    const teamId = Number(req.params.id);
    if (!Number.isInteger(teamId)) {
      return res.status(400).json({ message: "Invalid team id" });
    }
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { tournamentId: true } });
    if (!team) return res.status(404).json({ message: "Team not found" });
    if (!(await isCaptainOf(req.user.id, team.tournamentId, teamId))) {
      return res.status(403).json({ message: "Forbidden: You can only act on your own team." });
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not verify captain access." });
  }
};
