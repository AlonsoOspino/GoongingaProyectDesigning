const prisma = require("../config/prisma");

function hasFullGameAccess(roles) {
  return roles.includes("SOCIAL_MEDIA") || roles.includes("ADMIN");
}

function canControlGame(roles, gameType) {
  return hasFullGameAccess(roles) || (roles.includes("CASTER") && gameType === "JEOPARDY");
}

module.exports = async function minigameOperator(req, res, next) {
  if (!req.networkMember) {
    return res.status(401).json({ message: "Network sign-in is required." });
  }

  const roles = Array.isArray(req.networkMember.roles) ? req.networkMember.roles : [];
  if (hasFullGameAccess(roles)) return next();
  if (!roles.includes("CASTER")) {
    return res.status(403).json({ message: "You do not have permission for this Minigames action." });
  }

  const slug = String(req.params.slug || "").trim().toLowerCase();
  const game = await prisma.miniGame.findUnique({ where: { slug }, select: { gameType: true } });
  if (!game) return res.status(404).json({ message: "Minigame not found." });
  if (!canControlGame(roles, game.gameType)) {
    return res.status(403).json({ message: "Casters can only control Jeopardy games." });
  }

  return next();
};

module.exports.__testables = { hasFullGameAccess, canControlGame };
