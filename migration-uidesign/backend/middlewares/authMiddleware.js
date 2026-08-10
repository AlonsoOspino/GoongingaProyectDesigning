const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const JWT_SECRETS = [...new Set([process.env.NETWORK_JWT_SECRET, process.env.JWT_SECRET].filter(Boolean))];

if (!JWT_SECRETS.length) {
  throw new Error("JWT_SECRET or NETWORK_JWT_SECRET is not set");
}

function verifyToken(token) {
  for (const secret of JWT_SECRETS) {
    try {
      return jwt.verify(token, secret);
    } catch {
      // Try the next configured signing secret.
    }
  }
  throw new Error("Invalid token");
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Token malformed" });
  }

  try {
    const decoded = verifyToken(token);
    if (decoded.accountType !== "NETWORK_MEMBER") {
      return res.status(401).json({ error: "Discord sign-in is required" });
    }

    const member = await prisma.networkMember.findUnique({
      where: { id: Number(decoded.id) },
      select: { id: true, username: true, avatarUrl: true, roles: true, role: true, teamId: true, status: true },
    });

    if (!member || member.status !== "ACTIVE") {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = {
      ...decoded,
      id: member.id,
      role: member.role,
      teamId: member.teamId,
      username: member.username,
      avatarUrl: member.avatarUrl,
      roles: member.roles,
      accountType: "NETWORK_MEMBER",
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = authMiddleware;
