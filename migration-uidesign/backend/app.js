// src/app.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const memberRoutes = require("./routes/member");
const tournamentRoutes = require("./routes/tournament");
const draftActionRoutes = require("./routes/draftAction");
const draftTableRoutes = require("./routes/draftTable");
const draftRoutes = require("./routes/draft");
const matchRoutes = require("./routes/match");
const teamRoutes = require("./routes/team");
const playerStatRoutes = require("./routes/playerStat");
const newsRoutes = require("./routes/news");
const cors = require("cors");
const app = express();
app.use(cors()); 
app.use(express.json());

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
app.listen(3000, () => {
  console.log("Server running on port 3000");
});