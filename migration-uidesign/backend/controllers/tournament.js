const tournamentService = require("../services/tournament");

const create = async (req, res) => {
  try {
    const tournament = await tournamentService.create(req.body);
    res.status(201).json(tournament);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tournament = await tournamentService.update(Number(id), req.body);
    res.json(tournament);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await tournamentService.remove(Number(id));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getAll = async (req, res) => {
  try {
    const tournaments = await tournamentService.getAll();
    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCurrent = async (req, res) => {
  try {
    const tournament = await tournamentService.getCurrent();
    if (!tournament) {
      return res.status(404).json({ message: "No tournament found" });
    }
    res.json(tournament);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  create,
  update,
  remove,
  getAll,
  getCurrent,
};
