const express = require("express");
const announcementController = require("../controllers/announcement");
const { networkAuthMiddleware, requireNetworkRole } = require("../middlewares/networkAuthMiddleware");

const router = express.Router();
const socialMedia = [networkAuthMiddleware, requireNetworkRole("SOCIAL_MEDIA", "ADMIN")];

router.get("/active", announcementController.getActive);
router.get("/settings", ...socialMedia, announcementController.getSettings);
router.patch("/settings", ...socialMedia, announcementController.updateSettings);

module.exports = router;
