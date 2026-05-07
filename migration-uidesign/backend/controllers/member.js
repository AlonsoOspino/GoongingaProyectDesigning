const memberService = require("../services/authUser");
const memberRepo = require("../repositories/member");
const teamRepo = require("../repositories/team");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

function sanitizeMember(member, options = {}) {
  if (!member || typeof member !== "object") return member;
  const {
    passwordHash,
    obsWebsocketPassword,
    heroVideoFolderPath,
    obsWebsocketUrl,
    ...safeMember
  } = member;

  if (options.includePrivate) {
    return {
      ...safeMember,
      heroVideoFolderPath,
      obsWebsocketUrl,
      obsWebsocketPassword,
    };
  }

  return safeMember;
}

async function normalizeAdminTeamId(rawTeamId) {
  if (rawTeamId === undefined) return undefined;
  if (rawTeamId === null || rawTeamId === "") return null;

  const parsed = Number(rawTeamId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("teamId must be a positive integer or null.");
  }

  const team = await teamRepo.findById(parsed);
  if (!team) {
    throw new Error(`Team with id ${parsed} does not exist.`);
  }

  return parsed;
}

const register = async (req, res) => {
  try {
    const user = await memberService.register(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const login = async (req, res) => {
  try {
    const result = await memberService.login(req.body);
    res.json(result);
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
};

const getAll = async (req, res) => {
  try {
    const members = await memberRepo.findAll();
    res.json(members.map((member) => sanitizeMember(member)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getById = async (req, res) => {
  try {
    const memberId = Number(req.params.id);
    if (!req.user || (req.user.id !== memberId && req.user.role !== "ADMIN")) {
      return res.status(403).json({ message: "Forbidden: You can only view your own profile." });
    }

    const member = await memberRepo.findById(memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }
    res.json(sanitizeMember(member, { includePrivate: true }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const update = async (req, res) => {
  try {
    if (req.user.id !== Number(req.params.id) && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden: You can only update your own profile." });
    }
    const { role, team, teamId, password } = req.body;
    const safeBody = {};

    if (req.body.nickname !== undefined) safeBody.nickname = req.body.nickname;
    if (req.body.user !== undefined) safeBody.user = req.body.user;
    if (req.body.profilePic !== undefined) safeBody.profilePic = req.body.profilePic;
    if (req.body.rank !== undefined) safeBody.rank = req.body.rank;
    if (req.body.heroVideoFolderPath !== undefined) safeBody.heroVideoFolderPath = req.body.heroVideoFolderPath;
    if (req.body.obsWebsocketUrl !== undefined) safeBody.obsWebsocketUrl = req.body.obsWebsocketUrl;
    if (req.body.obsWebsocketPassword !== undefined) safeBody.obsWebsocketPassword = req.body.obsWebsocketPassword;

    if (password) {
      safeBody.passwordHash = await bcrypt.hash(password, 10);
    }
    const updatedMember = await memberRepo.update(Number(req.params.id), safeBody);
    res.json(sanitizeMember(updatedMember, { includePrivate: true }));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const adminUpdate = async (req, res) => {
  try {
    const { team, password, ...safeBody } = req.body;
    if (req.body.teamId !== undefined) {
      safeBody.teamId = await normalizeAdminTeamId(req.body.teamId);
    }
    if (req.body.nickname !== undefined) safeBody.nickname = req.body.nickname;
    if (req.body.user !== undefined) safeBody.user = req.body.user;
    if (req.body.profilePic !== undefined) safeBody.profilePic = req.body.profilePic;
    if (req.body.rank !== undefined) safeBody.rank = req.body.rank;
    if (req.body.heroVideoFolderPath !== undefined) safeBody.heroVideoFolderPath = req.body.heroVideoFolderPath;
    if (req.body.obsWebsocketUrl !== undefined) safeBody.obsWebsocketUrl = req.body.obsWebsocketUrl;
    if (req.body.obsWebsocketPassword !== undefined) safeBody.obsWebsocketPassword = req.body.obsWebsocketPassword;
    if (password) {
      safeBody.passwordHash = await bcrypt.hash(password, 10);
    }
    const updatedMember = await memberRepo.update(Number(req.params.id), safeBody);
    res.json(sanitizeMember(updatedMember));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getHeroVideo = async (req, res) => {
  try {
    const memberId = Number(req.params.id);
    const heroId = String(req.params.heroId || "").trim();

    if (!Number.isInteger(memberId) || memberId <= 0) {
      return res.status(400).json({ message: "Invalid member id" });
    }

    if (!heroId) {
      return res.status(400).json({ message: "Invalid hero id" });
    }

    if (!req.user || (req.user.id !== memberId && req.user.role !== "ADMIN")) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const member = await memberRepo.findById(memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    const folder = member.heroVideoFolderPath;
    if (!folder) {
      return res.status(404).json({ message: "Hero video folder is not configured" });
    }

    const videoPath = path.join(folder, `${path.basename(heroId)}.mp4`);

    try {
      await fs.promises.access(videoPath, fs.constants.R_OK);
    } catch {
      return res.status(404).json({ message: `Video not found: ${path.basename(heroId)}.mp4` });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.sendFile(path.resolve(videoPath));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Bulk import users from text format:
 * NICKNAME USUARIO CONTRASEÑA TEAMID
 * one per line, space-separated
 */
const bulkImport = async (req, res) => {
  try {
    const { script } = req.body;
    if (!script || typeof script !== "string" || !script.trim()) {
      return res.status(400).json({ message: "script is required (text block with users)" });
    }

    const lines = script
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (!lines.length) {
      return res.status(400).json({ message: "No valid lines found in script" });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(/\s+/);
      if (parts.length < 4) {
        errors.push(`Line ${i + 1}: expected 'NICKNAME USUARIO CONTRASEÑA TEAMID', got "${lines[i]}"`);
        continue;
      }

      const [nickname, user, password, teamIdStr] = parts;
      let teamId;

      try {
        teamId = await normalizeAdminTeamId(teamIdStr);
      } catch (validationErr) {
        errors.push(`Line ${i + 1}: ${validationErr.message}`);
        continue;
      }

      try {
        const member = await memberService.register({ user, password, nickname });
        // Assign role DEFAULT and teamId
        const updated = await memberRepo.update(member.id, { teamId });
        results.push(sanitizeMember(updated));
      } catch (err) {
        errors.push(`Line ${i + 1} (${user}): ${err.message}`);
      }
    }

    res.status(201).json({
      created: results.length,
      errors: errors.length,
      results,
      errorDetails: errors,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = {
  register,
  login,
  getAll,
  getById,
  update,
  adminUpdate,
  getHeroVideo,
  bulkImport,
};
