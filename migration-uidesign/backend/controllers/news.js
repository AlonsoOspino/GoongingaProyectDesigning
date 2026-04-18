const newsService = require("../services/news");

const create = async (req, res) => {
  try {
    const news = await newsService.create(req.body);
    res.status(201).json(news);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const news = await newsService.update(Number(req.params.id), req.body);
    res.json(news);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    await newsService.remove(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getById = async (req, res) => {
  try {
    const news = await newsService.getById(Number(req.params.id));
    if (!news) return res.status(404).json({ message: "News not found" });
    res.json(news);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAll = async (_req, res) => {
  try {
    const news = await newsService.getAll();
    res.json(news);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  create,
  update,
  remove,
  getById,
  getAll,
};
