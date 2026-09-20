const devDraftApp = require("../services/devDraftApp");

const statusForError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("not found")) return 404;
  if (message.includes("already exists") || message.includes("before deleting")) return 409;
  return 400;
};

const handle = (action, successStatus = 200) => async (req, res) => {
  try {
    const result = await action(req);
    return res.status(successStatus).json(result);
  } catch (error) {
    return res.status(statusForError(error)).json({
      message: error?.message || "Developer draft app request failed.",
    });
  }
};

module.exports = {
  getState: handle(() => devDraftApp.getState()),
  createTeam: handle((req) => devDraftApp.createTeam(req.body), 201),
  deleteTeam: handle((req) => devDraftApp.deleteTeam(req.params.id)),
  createMatch: handle((req) => devDraftApp.createMatch(req.body), 201),
  deleteMatch: handle(() => devDraftApp.deleteMatch()),
  setOverlayFocus: handle((req) => devDraftApp.setOverlayFocus(req.body)),
  setBans: handle((req) => devDraftApp.setBans(req.body)),
};
