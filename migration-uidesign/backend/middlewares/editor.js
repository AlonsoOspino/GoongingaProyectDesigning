module.exports = function editorMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: No user info" });
  }

  const roles = Array.isArray(req.user.roles) ? req.user.roles : [];
  if (!roles.includes("CONTENT_CREATOR") && !roles.includes("ADMIN")) {
    return res.status(403).json({ message: "Forbidden: Content Creator access required" });
  }

  next();
};
