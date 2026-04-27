const memberService = require("../services/authUser");
const memberRepo = require("../repositories/member");
const teamRepo = require("../repositories/team");
const bcrypt = require("bcrypt");

function sanitizeMember(member) {
  if (!member || typeof member !== "object") return member;
  const { passwordHash, ...safeMember } = member;
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
    const safeMembers = members.map(({ passwordHash, ...rest }) => rest);
    res.json(safeMembers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getById = async (req, res) => {
  try {
    const member = await memberRepo.findById(Number(req.params.id));
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }
    const { passwordHash, ...safeMember } = member;
    res.json(safeMember);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const update = async (req, res) => {
  try {
    if (req.user.id !== Number(req.params.id) && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden: You can only update your own profile." });
    }
    const { role, team, teamId, password, ...safeBody } = req.body;
    if (password) {
      safeBody.passwordHash = await bcrypt.hash(password, 10);
    }
    const updatedMember = await memberRepo.update(Number(req.params.id), safeBody);
    res.json(sanitizeMember(updatedMember));
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
    if (password) {
      safeBody.passwordHash = await bcrypt.hash(password, 10);
    }
    const updatedMember = await memberRepo.update(Number(req.params.id), safeBody);
    res.json(sanitizeMember(updatedMember));
  } catch (err) {
    res.status(400).json({ message: err.message });
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
        const { passwordHash, ...safe } = updated;
        results.push(safe);
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
  bulkImport,
};
