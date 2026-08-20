const express = require("express");
const announcementController = require("../controllers/announcement");
const { networkAuthMiddleware, requireNetworkRole } = require("../middlewares/networkAuthMiddleware");

const router = express.Router();
const manager = [networkAuthMiddleware, requireNetworkRole("SOCIAL_MEDIA", "ADMIN")];

router.get("/active", announcementController.getActive);
router.patch("/reorder", ...manager, announcementController.reorder);
router.get("/settings", ...manager, announcementController.getSettings);
router.patch("/settings", ...manager, announcementController.updateSettings);
router.get("/", ...manager, announcementController.list);
router.post("/", ...manager, announcementController.create);
router.patch("/:id", ...manager, announcementController.update);
router.delete("/:id", ...manager, announcementController.remove);

module.exports = router;
