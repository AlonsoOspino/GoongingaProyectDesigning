const networkMemberRepo = require("../repositories/networkMember");
const teamRepo = require("../repositories/team");
const { hasNetworkRole } = require("../utils/permissions");

function toLeagueMember(member, includePrivate = false) {
  const profile = {
    id: member.id,
    nickname: member.nickname || member.username,
    user: member.username,
    role: member.role,
    profilePic: member.profilePic || member.avatarUrl,
    rank: member.rank,
    teamId: member.teamId,
  };
  if (!includePrivate) return profile;
  return {
    ...profile,
    heroVideoFolderPath: member.heroVideoFolderPath,
    obsWebsocketUrl: member.obsWebsocketUrl,
    obsWebsocketPassword: member.obsWebsocketPassword,
  };
}

async function normalizeTeamId(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const teamId = Number(value);
  if (!Number.isInteger(teamId) || teamId < 1 || !(await teamRepo.findById(teamId))) {
    throw new Error("Select a valid team.");
  }
  return teamId;
}

function cleanSearch(value) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

async function getRecent(req, res) {
  try {
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 12)
      : 5;

    const members = await networkMemberRepo.findRecent(limit);
    return res.json(members);
  } catch (error) {
    return res.status(500).json({ message: "Unable to load network members." });
  }
}

async function getCurrent(req, res) {
  return res.json(req.networkMember);
}

async function getForAdmin(req, res) {
  try {
    return res.json(await networkMemberRepo.findForAdmin(cleanSearch(req.query.search)));
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Unable to load Network Users." });
  }
}

async function updateRoles(req, res) {
  try {
    const memberId = Number(req.params.id);
    if (!Number.isInteger(memberId) || memberId < 1) return res.status(400).json({ message: "Invalid Network User." });

    const suppliedRoles = Array.isArray(req.body?.roles) ? req.body.roles : [];
    const roles = [...new Set(suppliedRoles.filter((role) => typeof role === "string"))];
    const unknown = roles.filter((role) => !networkMemberRepo.NETWORK_MEMBER_ROLES.includes(role));
    if (unknown.length) return res.status(400).json({ message: `Unknown role: ${unknown.join(", ")}.` });

    const member = await networkMemberRepo.findById(memberId);
    if (!member) return res.status(404).json({ message: "Network User not found." });

    // MEMBER is the baseline identity role and is never removed by this panel.
    const normalizedRoles = ["MEMBER", ...roles.filter((role) => role !== "MEMBER")];
    return res.json(await networkMemberRepo.updateRoles(memberId, normalizedRoles));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Unable to update Network User roles." });
  }
}

async function getLeagueMembers(_req, res) {
  try {
    const members = await networkMemberRepo.findLeagueMembers();
    return res.json(members.map((member) => toLeagueMember(member)));
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Unable to load season members." });
  }
}

async function getLeagueMember(req, res) {
  try {
    const memberId = Number(req.params.id);
    if (req.user.id !== memberId && !hasNetworkRole(req.user, "ADMIN")) return res.status(403).json({ message: "Forbidden." });
    const member = await networkMemberRepo.findCompetitiveProfile(memberId);
    if (!member) return res.status(404).json({ message: "Network Member not found." });
    return res.json(toLeagueMember(member, true));
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Unable to load profile." });
  }
}

async function updateLeagueMember(req, res) {
  try {
    const memberId = Number(req.params.id);
    if (req.user.id !== memberId && !hasNetworkRole(req.user, "ADMIN")) return res.status(403).json({ message: "Forbidden." });
    const data = {};
    for (const field of ["nickname", "profilePic", "heroVideoFolderPath", "obsWebsocketUrl", "obsWebsocketPassword"]) {
      if (req.body?.[field] !== undefined) data[field] = req.body[field];
    }
    const member = await networkMemberRepo.updateCompetitiveProfile(memberId, data);
    return res.json(toLeagueMember(member, true));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Unable to update profile." });
  }
}

async function adminUpdateLeagueMember(req, res) {
  try {
    const memberId = Number(req.params.id);
    const data = {};
    if (req.body?.nickname !== undefined) data.nickname = req.body.nickname;
    if (req.body?.profilePic !== undefined) data.profilePic = req.body.profilePic;
    if (req.body?.rank !== undefined) data.rank = Number(req.body.rank) || 0;
    if (req.body?.role !== undefined) data.role = req.body.role;
    if (req.body?.teamId !== undefined) data.teamId = await normalizeTeamId(req.body.teamId);
    await networkMemberRepo.updateCompetitiveProfile(memberId, data);
    return res.json(await networkMemberRepo.findById(memberId));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Unable to update season member." });
  }
}

module.exports = {
  getRecent,
  getCurrent,
  getForAdmin,
  updateRoles,
  getLeagueMembers,
  getLeagueMember,
  updateLeagueMember,
  adminUpdateLeagueMember,
};
