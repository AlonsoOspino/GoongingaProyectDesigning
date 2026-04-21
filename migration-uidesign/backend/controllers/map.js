const mapService = require("../services/map");

const getAll = async (_req, res) => {
  try {
    const maps = await mapService.getAll();
    res.json(maps);
  } catch (error) {
    res.status(500).json({ message: error?.message || "Failed to load maps." });
  }
};

module.exports = {
  getAll,
};
