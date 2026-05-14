const express = require("express");
const router = express.Router();
const leaderboardOverlayAssetController = require("../controllers/leaderboardOverlayAsset");
const authMiddleware = require("../middlewares/authMiddleware");
const managerMiddleware = require("../middlewares/manager");

router.get("/leaderboard/:matchId", leaderboardOverlayAssetController.getLeaderboardOverlayAsset);
router.put(
  "/leaderboard/:matchId",
  authMiddleware,
  managerMiddleware,
  leaderboardOverlayAssetController.upsertLeaderboardOverlayAsset
);

module.exports = router;
