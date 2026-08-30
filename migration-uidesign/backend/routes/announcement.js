const express = require("express");
const multer = require("multer");
const announcementController = require("../controllers/announcement");
const { networkAuthMiddleware, requireNetworkRole } = require("../middlewares/networkAuthMiddleware");

const router = express.Router();
// Same ceiling the other content uploads use.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const manager = [networkAuthMiddleware, requireNetworkRole("SOCIAL_MEDIA", "ADMIN")];

router.get("/active", announcementController.getActive);
router.patch("/reorder", ...manager, announcementController.reorder);
router.get("/settings", ...manager, announcementController.getSettings);
router.patch("/settings", ...manager, announcementController.updateSettings);
router.get("/", ...manager, announcementController.list);
router.post("/image", ...manager, upload.single("image"), announcementController.uploadImage);
router.post("/", ...manager, announcementController.create);
router.patch("/:id", ...manager, announcementController.update);
router.delete("/:id", ...manager, announcementController.remove);

module.exports = router;
