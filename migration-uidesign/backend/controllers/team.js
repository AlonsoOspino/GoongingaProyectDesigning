const teamService = require("../services/team");

const getAll = async (req, res) => {
  try {
    const teams = await teamService.getAll()
    res.json(teams)
    } catch (err) {
      res.status(400).json({ message: err.message })
    }
};

const getbyId = async (req, res) => {
  try {
    const { id } = req.params;
    const team = await teamService.getById(Number(id));
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }
    res.json(team);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getLeaderboard = async (req, res) => {
  try {
    const { tournamentId } = req.query;
    const teams = await teamService.getLeaderboard(tournamentId);
    res.json(teams);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};


const create = async (req, res) => {
  try {
    const team = await teamService.create(req.body);
    res.status(201).json(team);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const createMany = async (req, res) => {
  try {
    const { count, namePrefix } = req.body;
    const tournamentId = req.body.tournamentId || (req.body.tournamentId === 0 ? 0 : undefined) || req.query.tournamentId;
    const parsedTournamentId = tournamentId ? Number(tournamentId) : undefined;
    const result = await teamService.createMany({ count: Number(count), tournamentId: parsedTournamentId, namePrefix: namePrefix || "Team" });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const team = await teamService.update(Number(id), req.body);
    res.json(team);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await teamService.remove(Number(id));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
const captainUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    // Only allow updating the name, logo and roster field
    const updateData = {};
    if (req.body.name) {
      updateData.name = req.body.name;
    }
    if (req.body.logo) {
      updateData.logo = req.body.logo;
    }
    if (req.body.roster) {
      updateData.roster = req.body.roster;
    }
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "Only 'name', 'logo' and 'roster' can be updated by captain." });
    }
    const team = await teamService.update(Number(id), updateData);
    res.json(team);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
    


module.exports = {
  create,
  update,
  remove,
  captainUpdate,
  getAll,
  getLeaderboard,
  getById: getbyId,
};
// expose createMany
module.exports.createMany = createMany;
