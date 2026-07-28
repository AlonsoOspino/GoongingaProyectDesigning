const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/admin");
const wrappedManagerMiddleware = require("../middlewares/wrappedManager");
const wrappedController = require("../controllers/wrapped");

const router = express.Router();

router.get("/", wrappedController.getCurrentWrapped);
router.get("/manage", authMiddleware, wrappedManagerMiddleware, wrappedController.getManageWrapped);
router.post("/manage/snapshot", authMiddleware, wrappedManagerMiddleware, wrappedController.generateWrapped);
router.put("/manage/assets", authMiddleware, wrappedManagerMiddleware, wrappedController.updateAssets);

// Legacy admin routes remain available for existing clients.
router.get("/admin", authMiddleware, adminMiddleware, wrappedController.getAdminWrapped);
router.post("/admin/generate", authMiddleware, adminMiddleware, wrappedController.generateWrapped);
router.put("/admin/assets", authMiddleware, adminMiddleware, wrappedController.updateAssets);

module.exports = router;
