const express = require("express");
const router = express.Router();
const draftActionController = require("../controllers/draftAction");
const adminMiddleware = require("../middlewares/admin");
const captainDraftActionMiddleware = require("../middlewares/captainDraftAction");
const authMiddleware = require("../middlewares/authMiddleware");

// Public get all draft actions
router.get("/", draftActionController.getAll);
// Captain create draft action
router.post("/captain/create", authMiddleware, captainDraftActionMiddleware, draftActionController.captainCreate);
// Admin routes
router.post("/admin/create", authMiddleware, adminMiddleware, draftActionController.adminCreate);
router.put("/admin/update/:id", authMiddleware, adminMiddleware, draftActionController.adminUpdate);
router.delete("/admin/delete/:id", authMiddleware, adminMiddleware, draftActionController.adminRemove);

module.exports = router;
