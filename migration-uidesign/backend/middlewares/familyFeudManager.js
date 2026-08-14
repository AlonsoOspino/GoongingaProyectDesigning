module.exports = function familyFeudManagerMiddleware(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized: No user info" });
  const roles = Array.isArray(req.user.roles) ? req.user.roles : [];
  if (!roles.includes("SOCIAL_MEDIA") && !roles.includes("ADMIN")) {
    return res.status(403).json({ message: "Only Social Media or administrators can manage Family Feud." });
  }
  next();
};
