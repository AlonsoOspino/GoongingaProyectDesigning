const express = require("express");
const multer = require("multer");
const controller = require("../controllers/mvpVoting");
const authMiddleware = require("../middlewares/authMiddleware");
const wrappedManagerMiddleware = require("../middlewares/wrappedManager");
const { networkAuthMiddleware } = require("../middlewares/networkAuthMiddleware");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get("/", controller.getPublic);
router.post("/vote", networkAuthMiddleware, controller.vote);
router.get("/my-vote", networkAuthMiddleware, controller.getMyVote);
router.get("/manage", authMiddleware, wrappedManagerMiddleware, controller.getManage);
router.patch("/manage/status", authMiddleware, wrappedManagerMiddleware, controller.updateStatus);
router.post("/manage/candidates/:candidateId/image", authMiddleware, wrappedManagerMiddleware, upload.single("image"), controller.uploadCandidate);
router.post("/manage/publish", authMiddleware, wrappedManagerMiddleware, controller.publishWinner);

module.exports = router;
