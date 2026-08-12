const express = require("express");
const multer = require("multer");
const minigameController = require("../controllers/minigame");
const { networkAuthMiddleware, requireNetworkRole } = require("../middlewares/networkAuthMiddleware");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const socialMedia = [networkAuthMiddleware, requireNetworkRole("SOCIAL_MEDIA", "ADMIN")];
const developer = [networkAuthMiddleware, requireNetworkRole("DEVELOPER", "ADMIN")];

router.get("/games", minigameController.listGames);
router.get("/system/family-feud", minigameController.getFamilyFeudStatus);
router.get("/jeopardy/active", minigameController.getActiveJeopardy);
router.get("/games/:slug/manage", ...socialMedia, minigameController.getManageGame);
router.get("/games/:slug", minigameController.getPublicGame);
router.post("/games", ...socialMedia, minigameController.createGame);
router.patch("/games/:slug", ...socialMedia, minigameController.updateGame);
router.delete("/games/:slug", ...socialMedia, minigameController.deleteGame);
router.patch("/games/:slug/status", ...developer, minigameController.updateStatus);
router.post("/games/:slug/cover", ...socialMedia, upload.single("image"), minigameController.uploadCover);
router.get("/members", ...socialMedia, minigameController.searchMembers);
router.post("/games/:slug/start", ...socialMedia, minigameController.startJeopardy);
router.post("/games/:slug/award", ...socialMedia, minigameController.awardJeopardyQuestion);
router.post("/games/:slug/score", ...socialMedia, minigameController.adjustJeopardyScore);
router.post("/games/:slug/display-order", ...socialMedia, minigameController.publishJeopardyDisplayOrder);
router.post("/games/:slug/finalize", ...socialMedia, minigameController.finalizeJeopardy);

module.exports = router;
