// middlewares/admin.js

module.exports = function adminMiddleware(req, res, next) {
  // Assumes req.user is set by authentication middleware (e.g., after JWT verification)
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: No user info" });
  }
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }
  next();
};
