const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const managerMiddleware = require("../middlewares/manager");
const playerStatController = require("../controllers/playerStat");

const router = express.Router();

router.get("/public", playerStatController.getPublic);
router.get("/public/user/:userId", playerStatController.getPublicByUser);
router.get("/", authMiddleware, managerMiddleware, playerStatController.getAll);
router.get("/mine", authMiddleware, playerStatController.getMine);
router.post("/", authMiddleware, playerStatController.create);
router.post("/batch", authMiddleware, managerMiddleware, playerStatController.createBatch);

module.exports = router;
