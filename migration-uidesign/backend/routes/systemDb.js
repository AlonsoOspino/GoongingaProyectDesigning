const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/admin");
const { generateBackupSql, restoreFromBackupSql } = require("../utils/dbBackupSql");

const router = express.Router();
const RESTORE_CONFIRMATION_TEXT = "RESTORE DATABASE";
const WIPE_CONFIRMATION_TEXT = "DELETE DATABASE";

router.get("/backup", authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const sql = await generateBackupSql();
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(sql);
  } catch (error) {
    res.status(500).json({ message: error?.message || "Failed to export backup SQL." });
  }
});

router.post("/restore", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const confirmationText = String(req.body?.confirmationText || "").trim();
    const script = String(req.body?.script || "");

    if (confirmationText !== RESTORE_CONFIRMATION_TEXT) {
      return res.status(400).json({
        message: `Invalid confirmation text. Type exactly: ${RESTORE_CONFIRMATION_TEXT}`,
      });
    }

    const result = await restoreFromBackupSql(script);
    return res.json({
      message: "Database restore completed successfully.",
      ...result,
    });
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Failed to restore database." });
  }
});

router.post("/wipe", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const confirmationText = String(req.body?.confirmationText || "").trim();
    if (confirmationText !== WIPE_CONFIRMATION_TEXT) {
      return res.status(400).json({
        message: `Invalid confirmation text. Type exactly: ${WIPE_CONFIRMATION_TEXT}`,
      });
    }

    await restoreFromBackupSql(
      'TRUNCATE TABLE "PlayerStat", "DraftAction", "DraftTable", "News", "Match", "Member", "Team", "Tournament", "_AllowedMaps" RESTART IDENTITY CASCADE;'
    );

    return res.json({ message: "Database deleted successfully. Maps and heroes were preserved." });
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Failed to delete database." });
  }
});

module.exports = router;
