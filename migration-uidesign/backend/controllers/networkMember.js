const networkMemberRepo = require("../repositories/networkMember");

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

module.exports = { getRecent, getCurrent, getForAdmin, updateRoles };
