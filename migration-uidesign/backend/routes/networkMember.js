const express = require("express");
const networkMemberController = require("../controllers/networkMember");
const { networkAuthMiddleware, requireNetworkRole } = require("../middlewares/networkAuthMiddleware");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/admin");

const router = express.Router();

router.get("/recent", networkMemberController.getRecent);
router.get("/me/capabilities", networkAuthMiddleware, networkMemberController.getCapabilities);
router.get("/me", networkAuthMiddleware, networkMemberController.getCurrent);
router.get("/admin/users", networkAuthMiddleware, requireNetworkRole("ADMIN", "DEVELOPER"), networkMemberController.getForAdmin);
router.patch("/admin/users/:id/roles", networkAuthMiddleware, requireNetworkRole("ADMIN", "DEVELOPER"), networkMemberController.updateRoles);
router.get("/players", networkMemberController.getLeagueMembers);
router.get("/players/:id", authMiddleware, networkMemberController.getLeagueMember);
router.put("/players/:id", authMiddleware, networkMemberController.updateLeagueMember);
router.put("/admin/players/:id", authMiddleware, adminMiddleware, networkMemberController.adminUpdateLeagueMember);

module.exports = router;
