const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/admin");
const router = express.Router();
const mapController = require("../controllers/map");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.get("/", mapController.getAll);
router.post("/create", authMiddleware, adminMiddleware, upload.single("image"), mapController.create);

module.exports = router;
