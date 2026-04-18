const express = require("express");
const router = express.Router();
const matchController = require("../controllers/match");
const adminMiddleware = require("../middlewares/admin");
const captainMatchMiddleware = require("../middlewares/captainMatch");
const authMiddleware = require("../middlewares/authMiddleware");
const managerMiddleware = require("../middlewares/manager");

router.get("/", matchController.getAll);
router.post("/admin/create", authMiddleware, adminMiddleware, matchController.adminCreate);
router.post("/admin/generate-round-robin", authMiddleware, adminMiddleware, matchController.adminGenerateRoundRobin);
router.put("/admin/update/:id", authMiddleware, adminMiddleware, matchController.adminUpdate);
router.delete("/admin/delete/:id", authMiddleware, adminMiddleware, matchController.adminRemove);
router.put("/captain/update/:id", authMiddleware, captainMatchMiddleware, matchController.captainUpdate);
router.put("/manager/update/:id", authMiddleware, managerMiddleware, matchController.managerUpdate);
router.post("/:id/result", authMiddleware, managerMiddleware, matchController.submitResult);
router.get("/soonest", matchController.findSoonest);
router.get("/active", matchController.getActiveMatches);
router.get("/:id", matchController.getById);

module.exports = router;
