const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/admin");
const router = express.Router();
const heroController = require("../controllers/hero");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.get("/", heroController.getAll);
router.post("/create", authMiddleware, adminMiddleware, upload.single("image"), heroController.create);
router.delete("/delete/:id", authMiddleware, adminMiddleware, heroController.remove);

module.exports = router;
