const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middlewares/authMiddleware");
const managerMiddleware = require("../middlewares/manager");
const playerStatController = require("../controllers/playerStat");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/public", playerStatController.getPublic);
router.get("/public/user/:userId", playerStatController.getPublicByUser);
router.get("/", authMiddleware, managerMiddleware, playerStatController.getAll);
router.get("/mine", authMiddleware, playerStatController.getMine);
router.post("/", authMiddleware, playerStatController.create);
router.post("/upload", authMiddleware, upload.single("image"), playerStatController.createFromImage);
router.post("/upload-match-preview", authMiddleware, managerMiddleware, upload.single("image"), playerStatController.previewMatchFromImage);
router.post("/upload-match-confirm", authMiddleware, managerMiddleware, playerStatController.confirmBatchFromPreview);

module.exports = router;
