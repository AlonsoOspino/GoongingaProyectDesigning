const express = require("express");
const networkMemberController = require("../controllers/networkMember");

const router = express.Router();

router.get("/recent", networkMemberController.getRecent);

module.exports = router;
