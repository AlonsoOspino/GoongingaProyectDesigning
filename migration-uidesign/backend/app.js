// src/app.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const prisma = require("./config/prisma");
const memberRoutes = require("./routes/member");
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
const systemDbRoutes = require("./routes/systemDb");
const { ensureAdminUser } = require("./utils/ensureAdminUser");
const cors = require("cors");
const app = express();
const PORT = Number(process.env.PORT || 3000);
app.use(cors()); 
app.use(express.json());

app.get("/health", async (_req, res) => {
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

app.use("/member", memberRoutes);
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
app.use("/system-db", systemDbRoutes);

const startServer = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  await prisma.$connect();

  // Guarantee a working admin account on every deployment / restart.
  // Fail-soft: never block server startup on this.
  try {
    await ensureAdminUser();
  } catch (err) {
    console.error("[ensureAdminUser] Failed to bootstrap admin:", err?.message || err);
  }

  // Start draft timeout worker so server auto-applies skips/random-picks.
  try {
    const draftController = require("./controllers/draft");
    if (draftController && typeof draftController.startDraftTimeoutWorker === "function") {
      draftController.startDraftTimeoutWorker(3000);
      console.log("Draft timeout worker started (3s interval)");
    }
  } catch (err) {
    console.error("Failed to start draft timeout worker:", err?.message || err);
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
