const draftTableService = require("../services/draftTable");

const adminCreate = async (req, res) => {
  try {
    const draft = await draftTableService.create(req.body);
    res.status(201).json(draft);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const adminUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const draft = await draftTableService.update(Number(id), req.body);
    res.json(draft);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const adminRemove = async (req, res) => {
  try {
    const { id } = req.params;
    const draft = await draftTableService.remove(Number(id));
    res.json(draft);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const managerUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const forbiddenFields = ["id", "matchId", "actions"];
    const updateData = {};

    for (const key in req.body) {
      if (!forbiddenFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No allowed fields to update." });
    }

    const draft = await draftTableService.update(Number(id), updateData);
    res.json(draft);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const managerCreate = async (req, res) => {
  try {
    const draft = await draftTableService.create(req.body);
    res.status(201).json(draft);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getAll = async (req, res) => {
  try {
    const drafts = await draftTableService.getAll();
    res.json(drafts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getByMatchId = async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    if (!Number.isFinite(matchId) || matchId <= 0) {
      return res.status(400).json({ message: "Invalid matchId" });
    }
    // Authorization: allow if user is manager/admin, or if valid key provided in query/header
    const isManager = req.user && (req.user.role === "MANAGER" || req.user.role === "ADMIN");
    const key = req.query?.key || req.headers["x-draft-key"];
    const expected = process.env.DRAFT_TABLE_MANAGER_KEY;
    if (!isManager && !(key && expected && String(key) === String(expected))) {
      return res.status(403).json({ message: "Forbidden: managers only or valid key required" });
    }
    const draft = await draftTableService.findByMatchId(matchId);
    if (!draft) {
      return res.status(404).json({ message: "Draft table not found for this match" });
    }
    res.json(draft);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  adminCreate,
  adminUpdate,
  adminRemove,
  managerCreate,
  managerUpdate,
  getAll,
  getByMatchId
};
