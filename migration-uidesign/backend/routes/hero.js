const express = require("express");
const router = express.Router();
const heroController = require("../controllers/hero");

router.get("/", heroController.getAll);

module.exports = router;
