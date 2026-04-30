const express = require("express");
const router = express.Router();
const draftTableController = require("../controllers/draftTable");
const adminMiddleware = require("../middlewares/admin");
const managerMiddleware = require("../middlewares/manager");
const authMiddleware = require("../middlewares/authMiddleware");
const optionalAuth = require("../middlewares/optionalAuth");

// Admin routes
router.post("/admin/create", authMiddleware, adminMiddleware, draftTableController.adminCreate);
router.put("/admin/update/:id", authMiddleware, adminMiddleware, draftTableController.adminUpdate);
router.delete("/admin/delete/:id", authMiddleware, adminMiddleware, draftTableController.adminRemove);
// Manager create route
router.post("/manager/create", authMiddleware, managerMiddleware, draftTableController.managerCreate);
router.put("/manager/update/:id", authMiddleware, managerMiddleware, draftTableController.managerUpdate);
// Public get all draft tables
router.get("/", draftTableController.getAll);

// Public get draft table by matchId
router.get("/by-match/:matchId", optionalAuth, draftTableController.getByMatchId);
module.exports = router;
