const express = require("express");
const router = express.Router();
const newsController = require("../controllers/news");
const authMiddleware = require("../middlewares/authMiddleware");
const editorMiddleware = require("../middlewares/editor");

router.get("/", newsController.getAll);
router.get("/:id", newsController.getById);
router.post("/create", authMiddleware, editorMiddleware, newsController.create);
router.put("/update/:id", authMiddleware, editorMiddleware, newsController.update);
router.delete("/delete/:id", authMiddleware, editorMiddleware, newsController.remove);

module.exports = router;
