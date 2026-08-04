const express = require("express");
const networkMemberController = require("../controllers/networkMember");
const { networkAuthMiddleware, requireNetworkRole } = require("../middlewares/networkAuthMiddleware");

const router = express.Router();

router.get("/recent", networkMemberController.getRecent);
router.get("/me", networkAuthMiddleware, networkMemberController.getCurrent);
router.get("/admin/users", networkAuthMiddleware, requireNetworkRole("ADMIN", "DEVELOPER"), networkMemberController.getForAdmin);
router.patch("/admin/users/:id/roles", networkAuthMiddleware, requireNetworkRole("ADMIN", "DEVELOPER"), networkMemberController.updateRoles);

module.exports = router;
