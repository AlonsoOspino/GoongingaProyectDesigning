const express = require("express");
const router = express.Router();
const draftController = require("../controllers/draft");
const authMiddleware = require("../middlewares/authMiddleware");

router.post("/:matchId", authMiddleware, draftController.createDraft);
router.patch("/:id/start-map-picking", authMiddleware, draftController.startMapPicking);
router.post("/:id/pick-map", authMiddleware, draftController.pickMap);
router.patch("/:id/start-ban", authMiddleware, draftController.startBan);
router.post("/:id/ban-hero", authMiddleware, draftController.banHero);
router.patch("/:id/end-map", authMiddleware, draftController.endMap);
router.get("/:id/state", draftController.getDraftState);

module.exports = router;
