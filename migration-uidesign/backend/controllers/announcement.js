const prisma = require("../config/prisma");

const MODES = new Set(["TOURNAMENT", "JEOPARDY"]);

function normalizeMode(value) {
  const mode = String(value || "").trim().toUpperCase();
  return MODES.has(mode) ? mode : null;
}

function normalizeConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const config = { ...value };
  if (Object.prototype.hasOwnProperty.call(config, "countdownAt")) {
    const timestamp = config.countdownAt ? new Date(config.countdownAt).getTime() : NaN;
    config.countdownAt = Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
  }
  return config;
}

async function getState() {
  return prisma.announcementMode.upsert({
    where: { id: 1 },
    create: { id: 1, activeMode: "TOURNAMENT", enabled: true, config: {} },
    update: {},
  });
}

const matchSelect = {
  id: true,
  title: true,
  type: true,
  bestOf: true,
  status: true,
  startDate: true,
  mapWinsTeamA: true,
  mapWinsTeamB: true,
  gameNumber: true,
  teamA: { select: { id: true, name: true, logo: true } },
  teamB: { select: { id: true, name: true, logo: true } },
};

async function getTournamentPayload() {
  const active = await prisma.match.findFirst({
    where: { status: "ACTIVE" },
    select: matchSelect,
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
  });
  if (active) return { state: "LIVE", match: active };

  const upcoming = await prisma.match.findFirst({
    where: { status: "SCHEDULED", startDate: { gte: new Date() } },
    select: matchSelect,
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
  });
  return { state: upcoming ? "UPCOMING" : "IDLE", match: upcoming };
}

async function getJeopardyPayload() {
  const game = await prisma.miniGame.findFirst({
    where: { gameType: "JEOPARDY", status: "LIVE" },
    select: {
      slug: true,
      title: true,
      description: true,
      coverImageUrl: true,
      phase: true,
      state: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  return { state: game ? "LIVE" : "IDLE", game };
}

async function getActive(req, res) {
  try {
    const state = await getState();
    const payload = state.activeMode === "JEOPARDY"
      ? await getJeopardyPayload()
      : await getTournamentPayload();

    return res.json({
      enabled: state.enabled,
      mode: state.activeMode,
      config: state.config,
      updatedAt: state.updatedAt,
      payload,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not load the active announcement." });
  }
}

async function getSettings(req, res) {
  try {
    const state = await getState();
    return res.json(state);
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not load announcement settings." });
  }
}

async function updateSettings(req, res) {
  try {
    const mode = req.body?.activeMode === undefined ? undefined : normalizeMode(req.body.activeMode);
    if (req.body?.activeMode !== undefined && !mode) {
      return res.status(400).json({ message: "Choose Tournament or Jeopardy mode." });
    }

    const state = await getState();
    const updated = await prisma.announcementMode.update({
      where: { id: state.id },
      data: {
        ...(mode ? { activeMode: mode } : {}),
        ...(typeof req.body?.enabled === "boolean" ? { enabled: req.body.enabled } : {}),
        ...(req.body?.config === undefined ? {} : { config: normalizeConfig(req.body.config) }),
        updatedById: req.networkMember.id,
      },
    });
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not update announcement settings." });
  }
}

module.exports = {
  getActive,
  getSettings,
  updateSettings,
  __testables: { normalizeMode, normalizeConfig },
};
