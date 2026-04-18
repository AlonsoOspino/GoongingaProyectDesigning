const express = require("express");
const router = express.Router();
const tournamentController = require("../controllers/tournament");
const adminMiddleware = require("../middlewares/admin");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/", tournamentController.getAll);
router.get("/current", tournamentController.getCurrent);
router.post("/create", authMiddleware, adminMiddleware, tournamentController.create);
router.put("/update/:id", authMiddleware, adminMiddleware, tournamentController.update);
router.delete("/delete/:id", authMiddleware, adminMiddleware, tournamentController.remove);

module.exports = router;
