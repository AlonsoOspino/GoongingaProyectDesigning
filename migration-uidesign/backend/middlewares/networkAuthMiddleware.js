const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

function getNetworkJwtSecret() {
  return process.env.NETWORK_JWT_SECRET || process.env.JWT_SECRET || null;
}

async function networkAuthMiddleware(req, res, next) {
  const secret = getNetworkJwtSecret();
  if (!secret) {
    return res.status(503).json({ message: "Network authentication is not configured." });
  }

  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return res.status(401).json({ message: "Network sign-in is required." });

  try {
    const decoded = jwt.verify(token, secret);
    if (decoded?.accountType !== "NETWORK_MEMBER" || !Number.isInteger(Number(decoded.id))) {
      return res.status(401).json({ message: "Invalid network session." });
    }

    const member = await prisma.networkMember.findUnique({
      where: { id: Number(decoded.id) },
      select: { id: true, username: true, avatarUrl: true, roles: true, status: true },
    });

    if (!member || member.status !== "ACTIVE") {
      return res.status(401).json({ message: "This Network Users account is unavailable." });
    }

    req.networkMember = member;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired network session." });
  }
}

function requireNetworkRole(...roles) {
  return (req, res, next) => {
    if (!req.networkMember) return res.status(401).json({ message: "Network sign-in is required." });
    if (!req.networkMember.roles.some((role) => roles.includes(role))) {
      return res.status(403).json({ message: "You do not have permission for this Minigames action." });
    }
    return next();
  };
}

module.exports = { networkAuthMiddleware, requireNetworkRole };
