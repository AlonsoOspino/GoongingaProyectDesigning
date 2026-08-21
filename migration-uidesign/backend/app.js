// src/app.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const prisma = require("./config/prisma");
const tournamentRoutes = require("./routes/tournament");
const draftActionRoutes = require("./routes/draftAction");
const draftTableRoutes = require("./routes/draftTable");
const draftRoutes = require("./routes/draft");
const matchRoutes = require("./routes/match");
const teamRoutes = require("./routes/team");
const playerStatRoutes = require("./routes/playerStat");
const newsRoutes = require("./routes/news");
const mapRoutes = require("./routes/map");
const heroRoutes = require("./routes/hero");
const leaderboardOverlayAssetRoutes = require("./routes/leaderboardOverlayAsset");
const familyFeudRoutes = require("./routes/familyFeud");
const networkAuthRoutes = require("./routes/networkAuth");
const networkMemberRoutes = require("./routes/networkMember");
const minigameRoutes = require("./routes/minigame");
const announcementRoutes = require("./routes/announcement");
const seasonRosterRoutes = require("./routes/seasonRoster");
const cors = require("cors");
const app = express();
const PORT = Number(process.env.PORT || 3000);
const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || path.join(__dirname, "uploads"));
const corsOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors(corsOrigins.length > 0 ? { origin: corsOrigins } : undefined));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use((req, res, next) => {
  if (typeof prisma.$requestStarted === "function") {
    prisma.$requestStarted();
  }

  res.on("finish", () => {
    if (typeof prisma.$requestFinished === "function") {
      prisma.$requestFinished();
    }
  });

  next();
});

app.get("/health", (_req, res) => {
  return res.status(200).json({ ok: true });
});

app.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ ok: true, database: "connected" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      database: "disconnected",
      error: error?.message || "Unknown DB error",
    });
  }
});

app.use("/assets/heroes", express.static(path.join(__dirname, "../frontend/HeroImages")));
app.use("/assets/maps", express.static(path.join(__dirname, "../frontend/MapImages")));
app.use("/uploads", express.static(MEDIA_DIR, { maxAge: "1y", immutable: true }));

app.use("/tournament", tournamentRoutes);
app.use("/draftAction", draftActionRoutes);
app.use("/draftTable", draftTableRoutes);
app.use("/draft", draftRoutes);
app.use("/match", matchRoutes);
app.use("/team", teamRoutes);
app.use("/playerStat", playerStatRoutes);
app.use("/news", newsRoutes);
app.use("/map", mapRoutes);
app.use("/hero", heroRoutes);
app.use("/overlay-assets", leaderboardOverlayAssetRoutes);
app.use("/family-feud", familyFeudRoutes);
app.use("/network-auth", networkAuthRoutes);
app.use("/network-members", networkMemberRoutes);
app.use("/minigames", minigameRoutes);
app.use("/announcements", announcementRoutes);
app.use("/season-roster", seasonRosterRoutes);

const startServer = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  if (typeof prisma.$disconnectWhenIdle === "function") {
    prisma.$disconnectWhenIdle();
  }

  // Optional: a background worker keeps draft timers advancing even with no
  // connected clients, but it also keeps serverless Postgres computes awake.
  if (process.env.ENABLE_DRAFT_TIMEOUT_WORKER === "true") {
    try {
      const draftController = require("./controllers/draft");
      if (draftController && typeof draftController.startDraftTimeoutWorker === "function") {
        draftController.startDraftTimeoutWorker(3000);
        console.log("Draft timeout worker started (3s interval)");
      }
    } catch (err) {
      console.error("Failed to start draft timeout worker:", err?.message || err);
    }
  } else {
    console.log("Draft timeout worker disabled; draft polling applies timeouts on demand");
  }
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log("Database connection established");
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error?.message || error);
  process.exit(1);
});
