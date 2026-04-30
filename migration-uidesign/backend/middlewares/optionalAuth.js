const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

function optionalAuth(req, _res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return next();
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (_error) {
    // Ignore invalid/expired token on optional auth paths.
  }

  return next();
}

module.exports = optionalAuth;
