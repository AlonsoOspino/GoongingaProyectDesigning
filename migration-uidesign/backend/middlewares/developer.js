// middlewares/developer.js

/*
 * Access for developer tooling. Matches the gate the admin dashboard already
 * uses on the frontend (ADMIN or DEVELOPER), so the people who maintain the
 * league software can reach their own tools without holding a full admin role.
 */
module.exports = function developerMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: No user info" });
  }
  const roles = Array.isArray(req.user.roles) ? req.user.roles : [];
  if (!roles.includes("ADMIN") && !roles.includes("DEVELOPER")) {
    return res.status(403).json({ message: "Forbidden: Admin or developer access required" });
  }
  next();
};
