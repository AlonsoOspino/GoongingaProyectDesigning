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
router.get("/games/:slug/player", networkAuthMiddleware, minigameController.getPlayerGame);
router.get("/games/:slug/manage", ...socialMedia, minigameController.getManageGame);
router.get("/games/:slug", minigameController.getPublicGame);
router.post("/games", ...socialMedia, minigameController.createGame);
router.patch("/games/:slug", ...socialMedia, minigameController.updateGame);
router.patch("/games/:slug/status", ...developer, minigameController.updateStatus);
router.post("/games/:slug/cover", ...socialMedia, upload.single("image"), minigameController.uploadCover);
router.get("/members", ...socialMedia, minigameController.searchMembers);
router.put("/games/:slug/turn", ...socialMedia, minigameController.setTurn);
router.post("/games/:slug/select", ...socialMedia, minigameController.selectQuestion);
router.post("/games/:slug/resolve", ...socialMedia, minigameController.resolveQuestion);
router.post("/games/:slug/request", networkAuthMiddleware, minigameController.requestQuestion);

module.exports = router;
