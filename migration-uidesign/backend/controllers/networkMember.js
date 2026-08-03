const networkMemberRepo = require("../repositories/networkMember");

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

module.exports = { getRecent };
