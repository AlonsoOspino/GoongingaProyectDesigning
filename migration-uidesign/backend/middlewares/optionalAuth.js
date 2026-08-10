const jwt = require("jsonwebtoken");

const JWT_SECRETS = [...new Set([process.env.NETWORK_JWT_SECRET, process.env.JWT_SECRET].filter(Boolean))];

if (!JWT_SECRETS.length) {
  throw new Error("JWT_SECRET or NETWORK_JWT_SECRET is not set");
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

  for (const secret of JWT_SECRETS) {
    try {
      req.user = jwt.verify(token, secret);
      break;
    } catch {
      // Ignore this secret and try the next configured one.
    }
  }

  return next();
}

module.exports = optionalAuth;
