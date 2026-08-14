// middlewares/admin.js

module.exports = function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: No user info" });
  }
  if (!Array.isArray(req.user.roles) || !req.user.roles.includes("ADMIN")) {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }
  next();
};
