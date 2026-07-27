const prisma = require("../config/prisma");

function getStateTokens(state) {
  const roomId = typeof state?.roomId === "string" ? state.roomId.trim() : "";
  const alphaInviteToken = typeof state?.teams?.alpha?.inviteToken === "string" ? state.teams.alpha.inviteToken.trim() : "";
  const betaInviteToken = typeof state?.teams?.beta?.inviteToken === "string" ? state.teams.beta.inviteToken.trim() : "";

  if (!roomId || !alphaInviteToken || !betaInviteToken) {
    throw new Error("state must include roomId and both team invite tokens.");
  }

  return { roomId, alphaInviteToken, betaInviteToken };
}

function preserveStableLinks(record, nextState) {
  const state = nextState && typeof nextState === "object" ? { ...nextState } : {};
  const teams = state.teams && typeof state.teams === "object" ? { ...state.teams } : {};
  const alpha = teams.alpha && typeof teams.alpha === "object" ? { ...teams.alpha } : {};
  const beta = teams.beta && typeof teams.beta === "object" ? { ...teams.beta } : {};

  return {
    ...state,
    roomId: record.roomId,
    teams: {
      ...teams,
      alpha: { ...alpha, inviteToken: record.alphaInviteToken },
      beta: { ...beta, inviteToken: record.betaInviteToken },
    },
  };
}

function toPayload(record) {
  if (!record) return null;
  return {
    id: record.id,
    roomId: record.roomId,
    alphaInviteToken: record.alphaInviteToken,
    betaInviteToken: record.betaInviteToken,
    state: record.state,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function createGame(req, res) {
  try {
    const state = req.body?.state;
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      return res.status(400).json({ message: "state must be an object." });
    }

    const { roomId, alphaInviteToken, betaInviteToken } = getStateTokens(state);
    const existing = await prisma.familyFeudGame.findUnique({ where: { roomId } });
    if (existing) {
      const stableState = preserveStableLinks(existing, state);
      const updated = await prisma.familyFeudGame.update({
        where: { roomId },
        data: { state: stableState },
      });
      return res.json(toPayload(updated));
    }

    const game = await prisma.familyFeudGame.create({
      data: { roomId, alphaInviteToken, betaInviteToken, state },
    });
    return res.status(201).json(toPayload(game));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Failed to create Family Feud game." });
  }
}

async function getLatestGame(_req, res) {
  try {
    const game = await prisma.familyFeudGame.findFirst({ orderBy: { createdAt: "desc" } });
    if (!game) return res.status(404).json({ message: "No Family Feud game has been created yet." });
    return res.json(toPayload(game));
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to load Family Feud game." });
  }
}

async function getGame(req, res) {
  try {
    const roomId = String(req.params.roomId || "").trim();
    const game = await prisma.familyFeudGame.findUnique({ where: { roomId } });
    if (!game) return res.status(404).json({ message: "Family Feud game not found." });
    return res.json(toPayload(game));
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to load Family Feud game." });
  }
}

async function getGameByInvite(req, res) {
  try {
    const inviteToken = String(req.params.inviteToken || "").trim().toUpperCase();
    const game = await prisma.familyFeudGame.findFirst({
      where: {
        OR: [{ alphaInviteToken: inviteToken }, { betaInviteToken: inviteToken }],
      },
    });
    if (!game) return res.status(404).json({ message: "Invite link is not assigned to an active Family Feud game." });
    return res.json(toPayload(game));
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Failed to load invite." });
  }
}

async function updateGame(req, res) {
  try {
    const roomId = String(req.params.roomId || "").trim();
    const state = req.body?.state;
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      return res.status(400).json({ message: "state must be an object." });
    }

    const existing = await prisma.familyFeudGame.findUnique({ where: { roomId } });
    if (!existing) return res.status(404).json({ message: "Family Feud game not found." });

    const stableState = preserveStableLinks(existing, state);
    const updated = await prisma.familyFeudGame.update({
      where: { roomId },
      data: { state: stableState },
    });
    return res.json(toPayload(updated));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Failed to update Family Feud game." });
  }
}

async function deleteGame(req, res) {
  try {
    const roomId = String(req.params.roomId || "").trim();
    await prisma.familyFeudGame.delete({ where: { roomId } });
    return res.status(204).send();
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ message: "Family Feud game not found." });
    return res.status(400).json({ message: error?.message || "Failed to delete Family Feud game." });
  }
}

module.exports = {
  createGame,
  getLatestGame,
  getGame,
  getGameByInvite,
  updateGame,
  deleteGame,
};
