const heroService = require("../services/hero");

const getAll = async (_req, res) => {
  try {
    const heroes = await heroService.getAll();
    res.json(heroes);
  } catch (error) {
    res.status(500).json({ message: error?.message || "Failed to load heroes." });
  }
};

module.exports = {
  getAll,
};
