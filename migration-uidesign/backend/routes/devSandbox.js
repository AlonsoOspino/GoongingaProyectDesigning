const express = require("express");
const router = express.Router();
const devSandboxController = require("../controllers/devSandbox");
const authMiddleware = require("../middlewares/authMiddleware");
const developerMiddleware = require("../middlewares/developer");

// Admin or developer, all of it. The sandbox creates matches and drives
// drafts, so it is not something a manager account should be able to spin up
// by accident. This mirrors the gate the admin dashboard already uses.
router.use(authMiddleware, developerMiddleware);

router.get("/", devSandboxController.getStatus);
router.post("/match", devSandboxController.createMatch);
router.delete("/match/:id", devSandboxController.deleteMatch);
router.post("/autopilot", devSandboxController.setAutopilot);
router.post("/step", devSandboxController.stepOnce);

module.exports = router;
