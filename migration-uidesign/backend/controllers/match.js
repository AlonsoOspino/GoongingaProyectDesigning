const matchService = require("../services/match");

const getById = async (req, res) => {
  try {
    const match = await matchService.getById(Number(req.params.id));
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }
    res.json(match);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAll = async (req, res) => {
  try {
    const matches = await matchService.getAll();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const adminCreate = async (req, res) => {
  try {
    const match = await matchService.create(req.body);  
    res.status(201).json(match);
  } catch (err) {
    res.status(400).json({ message: err.message });
  } 
};
const adminGenerateRoundRobin = async (req, res) => {
  try {
    const createdMatches = await matchService.generateRoundRobin(req.body || {});
    res.status(201).json(createdMatches);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
const adminUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const match = await matchService.update(Number(id), req.body);
    res.json(match);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
const adminRemove = async (req, res) => {
  try {
    const { id } = req.params;  
    const match = await matchService.remove(Number(id));
    res.json(match);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
const captainUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {};

    const match = await matchService.getById(Number(id));
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    const captainTeamId = Number(req.user.teamId);

    if (captainTeamId === match.teamAId && req.body.teamAready !== undefined) {
      updateData.teamAready = Number(req.body.teamAready) === 1 ? 1 : 0;
    }

    if (captainTeamId === match.teamBId && req.body.teamBready !== undefined) {
      updateData.teamBready = Number(req.body.teamBready) === 1 ? 1 : 0;
    }

    if (req.body.startDate !== undefined) {
      const nextStartDate = new Date(req.body.startDate);
      if (Number.isNaN(nextStartDate.getTime())) {
        return res.status(400).json({ message: "Invalid startDate format." });
      }
      updateData.startDate = nextStartDate;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "Captain can only update own team ready flag and startDate." });
    }

    const updatedMatch = await matchService.update(Number(id), updateData);
    res.json(updatedMatch);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
const managerUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    // Allow updating all fields except: id, bestOf, tournamentId, teamAId, teamBId, allowedMaps
    const forbiddenFields = ["id", "bestOf", "tournamentId", "teamAId", "teamBId", "allowedMaps"];
    const updateData = {};
    for (const key in req.body) {
      if (!forbiddenFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    }
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No allowed fields to update." });
    }
    const match = await matchService.update(Number(id), updateData);
    res.json(match);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
const findSoonest = async (req, res) => {
  try {
    const match = await matchService.findSoonest();
    if (!match) {
      return res.status(404).json({ message: "No upcoming matches found" });
    }
    res.json(match);
  }
  catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const getActiveMatches = async (req, res) => {
  try {
    const matches = await matchService.getActiveMatches();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const submitResult = async (req, res) => {
  try {
    // winnerTeamId can be null/undefined for draws
    const winnerTeamId = req.body?.winnerTeamId;
    
    // If provided, validate it's a positive integer
    if (winnerTeamId !== null && winnerTeamId !== undefined) {
      const parsed = Number(winnerTeamId);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return res.status(400).json({ message: "winnerTeamId must be a positive integer or null for draw." });
      }
    }

    const updatedMatch = await matchService.submitResult(
      Number(req.params.id), 
      winnerTeamId ?? null
    );
    res.json(updatedMatch);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const finishPendingRegisters = async (req, res) => {
  try {
    const updatedMatch = await matchService.finishPendingRegisters(Number(req.params.id));
    res.json(updatedMatch);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const adminUpdateWeekMaps = async (req, res) => {
  try {
    const { tournamentId, semanas, mapsAllowedByRound } = req.body;
    const updatedMatches = await matchService.updateWeekMaps(tournamentId, semanas, mapsAllowedByRound);
    res.json({ 
      message: `Updated ${updatedMatches.length} matches in week ${semanas}`,
      matches: updatedMatches 
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const adminGetWeekMapsConfig = async (req, res) => {
  try {
    const { tournamentId, semanas } = req.params;
    const config = await matchService.getWeekMapsConfig(Number(tournamentId), Number(semanas));
    res.json({ mapsAllowedByRound: config });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = {
  getById,
  getAll,
  adminCreate,
  adminGenerateRoundRobin,
  adminUpdate,
  adminRemove,
  captainUpdate,
  managerUpdate,
  findSoonest,
  getActiveMatches,
  submitResult,
  finishPendingRegisters,
  adminUpdateWeekMaps,
  adminGetWeekMapsConfig,
};

