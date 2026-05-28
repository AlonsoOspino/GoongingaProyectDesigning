const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
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
    const decoded = jwt.verify(token, JWT_SECRET);
    const member = await prisma.member.findUnique({
      where: { id: Number(decoded.id) },
      select: { id: true, role: true, teamId: true },
    });

    if (!member) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = {
      ...decoded,
      id: member.id,
      role: member.role,
      teamId: member.teamId,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = authMiddleware;
