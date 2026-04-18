const express = require("express");
const router = express.Router();
const teamController = require("../controllers/team");
const adminMiddleware = require("../middlewares/admin");
const captainMiddleware = require("../middlewares/captain");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/", teamController.getAll);
router.get("/leaderboard", teamController.getLeaderboard);
router.get("/:id", teamController.getById);
router.post("/create", authMiddleware, adminMiddleware, teamController.create);
router.put("/update/:id", authMiddleware, captainMiddleware, teamController.captainUpdate);
router.put("/admin/update/:id", authMiddleware,adminMiddleware, teamController.update);
router.delete("/delete/:id", authMiddleware, adminMiddleware,teamController.remove);

module.exports = router;
