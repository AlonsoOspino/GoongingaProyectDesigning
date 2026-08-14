module.exports = function familyFeudManagerMiddleware(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized: No user info" });
  const isManager = req.user.role === "MANAGER" || req.user.role === "ADMIN";
  const isAdmin = Array.isArray(req.user.roles) && req.user.roles.includes("ADMIN");
  if (!isManager && !isAdmin) {
    return res.status(403).json({ message: "Only a manager or administrator can manage Family Feud." });
  }
  next();
};
