const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const JWT_SECRETS = [...new Set([process.env.NETWORK_JWT_SECRET, process.env.JWT_SECRET].filter(Boolean))];

function verifyToken(token) {
  for (const secret of JWT_SECRETS) {
    try { return jwt.verify(token, secret); } catch { /* try the next configured secret */ }
  }
  throw new Error("Invalid token");
}

module.exports = async function familyFeudAuth(req, res, next) {
  const token = String(req.headers.authorization || "").startsWith("Bearer ")
    ? String(req.headers.authorization).slice(7).trim()
    : "";
  if (!token) return res.status(401).json({ message: "A Family Feud session is required." });

  try {
    const decoded = verifyToken(token);
    if (!["NETWORK_MEMBER", "FEUD_GUEST"].includes(decoded?.accountType) || !Number.isInteger(Number(decoded.id))) {
      return res.status(401).json({ message: "Invalid Family Feud session." });
    }
    const member = await prisma.networkMember.findUnique({
      where: { id: Number(decoded.id) },
      select: { id: true, discordUserId: true, username: true, avatarUrl: true, roles: true, role: true, teamId: true, status: true },
    });
    const isGuest = decoded.accountType === "FEUD_GUEST";
    if (!member || member.status !== "ACTIVE" || (isGuest && !member.discordUserId.startsWith("FEUD_GUEST:"))) {
      return res.status(401).json({ message: "This Family Feud session has expired." });
    }
    req.user = { ...decoded, ...member, accountType: decoded.accountType, guest: isGuest };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired Family Feud session." });
  }
};
