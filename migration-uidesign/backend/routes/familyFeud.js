const express = require("express");
const familyFeudController = require("../controllers/familyFeud");

const router = express.Router();

router.get("/latest", familyFeudController.getLatestGame);
router.get("/invite/:inviteToken", familyFeudController.getGameByInvite);
router.get("/games/:roomId", familyFeudController.getGame);
router.post("/games", familyFeudController.createGame);
router.put("/games/:roomId", familyFeudController.updateGame);
router.delete("/games/:roomId", familyFeudController.deleteGame);

module.exports = router;
