const mapService = require("../services/map");

const getAll = async (_req, res) => {
  try {
    const maps = await mapService.getAll();
    res.json(maps);
  } catch (error) {
    res.status(500).json({ message: error?.message || "Failed to load maps." });
  }
};

const create = async (req, res) => {
  try {
    const map = await mapService.create({
      name: req.body?.name,
      type: req.body?.type,
      image: req.file,
    });
    res.status(201).json(map);
  } catch (error) {
    res.status(400).json({ message: error?.message || "Failed to create map." });
  }
};

module.exports = {
  getAll,
  create,
};
