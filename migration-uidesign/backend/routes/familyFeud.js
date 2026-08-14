const express = require("express");
const familyFeudController = require("../controllers/familyFeud");
const authMiddleware = require("../middlewares/authMiddleware");
const optionalAuth = require("../middlewares/optionalAuth");
const familyFeudManager = require("../middlewares/familyFeudManager");

const router = express.Router();

router.get("/questions", authMiddleware, familyFeudManager, familyFeudController.listQuestions);
router.post("/questions/import", authMiddleware, familyFeudManager, familyFeudController.importQuestions);
router.post("/questions", authMiddleware, familyFeudManager, familyFeudController.createQuestion);
router.put("/questions/:questionId", authMiddleware, familyFeudManager, familyFeudController.updateQuestion);
router.delete("/questions/:questionId", authMiddleware, familyFeudManager, familyFeudController.deleteQuestion);

router.post("/games", authMiddleware, familyFeudManager, familyFeudController.createGame);
router.get("/games/:gameCode", optionalAuth, familyFeudController.getGame);
router.get("/games/:gameCode/events", optionalAuth, familyFeudController.events);
router.post("/games/:gameCode/join", authMiddleware, familyFeudController.joinGame);
router.post("/games/:gameCode/heartbeat", authMiddleware, familyFeudController.heartbeat);
router.post("/games/:gameCode/actions", authMiddleware, familyFeudController.gameAction);
router.delete("/games/:gameCode", authMiddleware, familyFeudController.deleteGame);

module.exports = router;
