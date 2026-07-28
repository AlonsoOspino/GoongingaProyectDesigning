module.exports = function wrappedManagerMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: No user info" });
  }
  if (req.user.role !== "MANAGER" && req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden: Managers and admins only" });
  }
  next();
};
