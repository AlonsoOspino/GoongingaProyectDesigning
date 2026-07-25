const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/admin");
const wrappedController = require("../controllers/wrapped");

const router = express.Router();

router.get("/", wrappedController.getCurrentWrapped);
router.get("/admin", authMiddleware, adminMiddleware, wrappedController.getAdminWrapped);
router.post("/admin/generate", authMiddleware, adminMiddleware, wrappedController.generateWrapped);
router.put("/admin/assets", authMiddleware, adminMiddleware, wrappedController.updateAssets);

module.exports = router;
