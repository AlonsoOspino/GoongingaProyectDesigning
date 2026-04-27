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
router.put("/admin/week-maps", authMiddleware, adminMiddleware, matchController.adminUpdateWeekMaps);
router.get("/admin/week-maps/:tournamentId/:semanas", authMiddleware, adminMiddleware, matchController.adminGetWeekMapsConfig);
router.put("/captain/update/:id", authMiddleware, captainMatchMiddleware, matchController.captainUpdate);
router.post("/captain/:id/request-pause", authMiddleware, captainMatchMiddleware, matchController.captainRequestPause);
router.put("/manager/update/:id", authMiddleware, managerMiddleware, matchController.managerUpdate);
router.post("/manager/:id/toggle-pause", authMiddleware, managerMiddleware, matchController.managerTogglePause);
router.post("/manager/:id/clear-pause-request", authMiddleware, managerMiddleware, matchController.managerClearPauseRequest);
router.post("/:id/result", authMiddleware, managerMiddleware, matchController.submitResult);
router.post("/:id/undo-result", authMiddleware, managerMiddleware, matchController.undoLastResult);
router.post("/:id/finish-registers", authMiddleware, managerMiddleware, matchController.finishPendingRegisters);
router.get("/soonest", matchController.findSoonest);
router.get("/active", matchController.getActiveMatches);
router.get("/:id", matchController.getById);

module.exports = router;
