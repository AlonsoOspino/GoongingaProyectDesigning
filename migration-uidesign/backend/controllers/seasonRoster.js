const seasonRoster = require("../services/seasonRoster");

function sendError(res, error) {
  return res.status(error.status || 400).json({ message: error.message || "Unable to update the season roster." });
}

async function getTournaments(_req, res) {
  try {
    return res.json(await seasonRoster.getTournaments());
  } catch (error) {
    return sendError(res, error);
  }
}

async function getRoster(req, res) {
  try {
    return res.json(await seasonRoster.getRoster(req.params.tournamentId));
  } catch (error) {
    return sendError(res, error);
  }
}

async function upsertMember(req, res) {
  try {
    return res.json(await seasonRoster.upsertMember(req.params.tournamentId, req.params.memberId, req.body));
  } catch (error) {
    return sendError(res, error);
  }
}

async function removeMember(req, res) {
  try {
    return res.json(await seasonRoster.removeMember(req.params.tournamentId, req.params.memberId));
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = { getTournaments, getRoster, upsertMember, removeMember };
