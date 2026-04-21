const heroService = require("../services/hero");

const getAll = async (_req, res) => {
  try {
    const heroes = await heroService.getAll();
    res.json(heroes);
  } catch (error) {
    res.status(500).json({ message: error?.message || "Failed to load heroes." });
  }
};

const create = async (req, res) => {
  try {
    const hero = await heroService.create({
      name: req.body?.name,
      role: req.body?.role,
      image: req.file,
    });
    res.status(201).json(hero);
  } catch (error) {
    res.status(400).json({ message: error?.message || "Failed to create hero." });
  }
};

module.exports = {
  getAll,
  create,
};
