const draftActionService = require("../services/draftAction");

const adminCreate = async (req, res) => {
  try {
    const action = await draftActionService.create(req.body);
    res.status(201).json(action);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const adminUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const action = await draftActionService.update(Number(id), req.body);
    res.json(action);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const adminRemove = async (req, res) => {
  try {
    const { id } = req.params;
    const action = await draftActionService.remove(Number(id));
    res.json(action);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};


const getAll = async (req, res) => {
  try {
    const actions = await draftActionService.getAll();
    res.json(actions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const draftTableService = require("../services/draftTable");
const matchService = require("../services/match");

const captainCreate = async (req, res) => {
  try {
    // Remove forbidden fields
    const { teamId, draftId, order, matchId, ...allowedFields } = req.body;
    const normalizedAction = String(allowedFields.action || "").toUpperCase();

    if (["BAN", "PICK", "SKIP"].includes(normalizedAction)) {
      return res.status(400).json({
        message: "Use /draft endpoints for BAN/PICK/SKIP actions to enforce draft rules.",
      });
    }

    // Get teamId from authenticated user
    allowedFields.teamId = req.user.teamId;

    // Require matchId in body (or could be in params)
    const matchIdValue = req.body.matchId || req.params.matchId;
    if (!matchIdValue) {
      return res.status(400).json({ message: "matchId is required" });
    }

    // Lookup draftTable by matchId
    const draftTable = await draftTableService.findByMatchId(Number(matchIdValue));
    if (!draftTable) {
      return res.status(404).json({ message: "DraftTable not found for match" });
    }
    allowedFields.draftId = draftTable.id;
    // Set order as next available for this draft
    const allActions = await draftActionService.getAll();
    const draftActions = allActions.filter(a => a.draftId === draftTable.id);
    allowedFields.order = draftActions.length + 1;
    
    const action = await draftActionService.create(allowedFields);
    res.status(201).json(action);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = {
  adminCreate,
  adminUpdate,
  adminRemove,
  getAll,
  captainCreate
};
