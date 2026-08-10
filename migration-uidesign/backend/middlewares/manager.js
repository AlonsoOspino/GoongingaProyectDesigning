// middlewares/manager.js

const { hasManagerAccess } = require("../utils/permissions");

module.exports = function managerMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: No user info" });
  }
  if (!hasManagerAccess(req.user)) {
    return res.status(403).json({ message: "Forbidden: Manager or Social Media access required" });
  }
  next();
};
