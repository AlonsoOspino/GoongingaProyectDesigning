const express = require("express");
const familyFeudController = require("../controllers/familyFeud");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/latest", familyFeudController.getLatestGame);
router.get("/invite/:inviteToken", authMiddleware, familyFeudController.getGameByInvite);
router.get("/games/:roomId", familyFeudController.getGame);
router.post("/games", familyFeudController.createGame);
router.post("/games/:roomId/join", authMiddleware, familyFeudController.joinGameTeam);
router.put("/games/:roomId", familyFeudController.updateGame);
router.delete("/games/:roomId", familyFeudController.deleteGame);

module.exports = router;
