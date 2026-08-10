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
router.get("/jeopardy/player", networkAuthMiddleware, minigameController.getActiveJeopardyPlayer);
router.get("/games/:slug/player", networkAuthMiddleware, minigameController.getPlayerGame);
router.get("/games/:slug/manage", ...socialMedia, minigameController.getManageGame);
router.get("/games/:slug", minigameController.getPublicGame);
router.post("/games", ...socialMedia, minigameController.createGame);
router.patch("/games/:slug", ...socialMedia, minigameController.updateGame);
router.patch("/games/:slug/status", ...developer, minigameController.updateStatus);
router.post("/games/:slug/cover", ...socialMedia, upload.single("image"), minigameController.uploadCover);
router.get("/members", ...socialMedia, minigameController.searchMembers);
router.post("/games/:slug/join", networkAuthMiddleware, minigameController.joinGame);
router.post("/games/:slug/start", ...socialMedia, minigameController.startJeopardy);
router.put("/games/:slug/turn", ...socialMedia, minigameController.setTurn);
router.post("/games/:slug/select", ...socialMedia, minigameController.selectQuestion);
router.post("/games/:slug/resolve", ...socialMedia, minigameController.resolveQuestion);
router.post("/games/:slug/advance", ...socialMedia, minigameController.advanceJeopardy);
router.post("/games/:slug/finalize", ...socialMedia, minigameController.finalizeJeopardy);
router.post("/games/:slug/request", networkAuthMiddleware, minigameController.requestQuestion);
router.post("/games/:slug/respond", networkAuthMiddleware, minigameController.submitResponse);

module.exports = router;
