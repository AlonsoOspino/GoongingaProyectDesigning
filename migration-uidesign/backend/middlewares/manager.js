// middlewares/manager.js

module.exports = function managerMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: No user info" });
  }
  if (req.user.role !== "MANAGER") {
    return res.status(403).json({ message: "Forbidden: Managers only" });
  }
  next();
};
