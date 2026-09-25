const express = require("express");
const controller = require("../controllers/devDraftApp");
const {
  networkAuthMiddleware,
  requireNetworkRole,
} = require("../middlewares/networkAuthMiddleware");

const router = express.Router();

router.use(networkAuthMiddleware, requireNetworkRole("DEVELOPER"));
router.get("/", controller.getState);
router.post("/teams", controller.createTeam);
router.delete("/teams/:id", controller.deleteTeam);
router.post("/match", controller.createMatch);
router.delete("/match", controller.deleteMatch);
router.patch("/match/overlay", controller.setOverlayFocus);
router.patch("/match/score", controller.setScores);
router.put("/match/bans", controller.setBans);

module.exports = router;
