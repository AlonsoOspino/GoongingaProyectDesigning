const express = require("express");
const seasonRoster = require("../controllers/seasonRoster");
const { networkAuthMiddleware, requireNetworkRole } = require("../middlewares/networkAuthMiddleware");

const router = express.Router();
const adminOnly = [networkAuthMiddleware, requireNetworkRole("ADMIN")];

router.get("/tournaments", adminOnly, seasonRoster.getTournaments);
router.get("/:tournamentId", adminOnly, seasonRoster.getRoster);
router.put("/:tournamentId/members/:memberId", adminOnly, seasonRoster.upsertMember);
router.delete("/:tournamentId/members/:memberId", adminOnly, seasonRoster.removeMember);

module.exports = router;
