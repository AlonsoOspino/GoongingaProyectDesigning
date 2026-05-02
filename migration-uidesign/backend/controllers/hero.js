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
      imageUrl: req.body?.imageUrl,
    });
    res.status(201).json(hero);
  } catch (error) {
    res.status(400).json({ message: error?.message || "Failed to create hero." });
  }
};

const remove = async (req, res) => {
  try {
    const deletedHero = await heroService.remove(Number(req.params.id));
    res.json(deletedHero);
  } catch (error) {
    res.status(400).json({ message: error?.message || "Failed to delete hero." });
  }
};

module.exports = {
  getAll,
  create,
  remove,
};
