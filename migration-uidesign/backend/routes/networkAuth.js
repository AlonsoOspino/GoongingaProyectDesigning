const express = require("express");
const networkAuthController = require("../controllers/networkAuth");

const router = express.Router();

router.get("/discord", networkAuthController.startDiscordAuth);
router.get("/discord/callback", networkAuthController.finishDiscordAuth);

module.exports = router;
