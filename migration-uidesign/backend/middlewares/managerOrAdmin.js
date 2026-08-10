// middlewares/managerOrAdmin.js
//
// Like managerMiddleware, but also lets ADMIN through. Used by operational
// actions that both roles need (for example the full match reset), without
// loosening the manager-only routes.

const { hasManagerAccess } = require("../utils/permissions");

module.exports = function managerOrAdminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: No user info" });
  }
  if (!hasManagerAccess(req.user)) {
    return res.status(403).json({ message: "Forbidden: Manager, Social Media, or admin access required" });
  }
  next();
};
