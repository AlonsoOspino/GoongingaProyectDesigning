const matchService = require("../services/match");
const prisma = require("../config/prisma");
const { sendDiscordMatchScheduled, editDiscordMatchScheduled } = require("../utils/discordWebhook");

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const toEpochMs = (value) => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const discordNotificationQueues = new Map();
const lastNotifiedStartMsByMatch = new Map();

const shouldNotifyScheduleChange = ({ requestBody, previousMatch, updatedMatch }) => {
  if (!hasOwn(requestBody, "startDate")) return false;
  if (!updatedMatch?.startDate) return false;

  const previousMs = toEpochMs(previousMatch?.startDate);
  const updatedMs = toEpochMs(updatedMatch.startDate);

  if (updatedMs === null) return false;
  if (!updatedMatch.discordMessageId) return true;

  return previousMs !== updatedMs;
};

const enqueueDiscordScheduleChange = (job) => {
  const previous = discordNotificationQueues.get(job.matchId) || Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(() => notifyDiscordScheduleChange(job));

  discordNotificationQueues.set(job.matchId, current);
  current.finally(() => {
    if (discordNotificationQueues.get(job.matchId) === current) {
      discordNotificationQueues.delete(job.matchId);
    }
  });

  return current;
};

const notifyDiscordScheduleChange = async ({
  matchId,
  previousMatch,
  updatedMatch,
  requestBody,
  contextLabel,
}) => {
  if (!shouldNotifyScheduleChange({ requestBody, previousMatch, updatedMatch })) {
    console.log(`[notifyDiscordScheduleChange] Skipping notification for match ${matchId} (${contextLabel}) - no schedule change`);
    return;
  }

  try {
    console.log(`[notifyDiscordScheduleChange] Starting notification for match ${matchId} (${contextLabel})`);
    
    // Fetch the latest match from DB to handle race conditions
    // Multiple requests might be updating the match simultaneously
    const currentMatch = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!currentMatch) {
      console.error(`Match not found for Discord notification (${contextLabel}): ${matchId}`);
      return;
    }

    const requestedStartMs = toEpochMs(updatedMatch.startDate);
    const currentStartMs = toEpochMs(currentMatch.startDate);
    if (requestedStartMs === null || currentStartMs === null || requestedStartMs !== currentStartMs) {
      console.log(`[notifyDiscordScheduleChange] Skipping notification for match ${matchId} (${contextLabel}) - schedule changed again`);
      return;
    }

    if (lastNotifiedStartMsByMatch.get(matchId) === currentStartMs) {
      console.log(`[notifyDiscordScheduleChange] Skipping notification for match ${matchId} (${contextLabel}) - already notified for this startDate`);
      return;
    }

    const teams = await prisma.team.findMany({
      where: { id: { in: [currentMatch.teamAId, currentMatch.teamBId] } },
      select: { id: true, name: true, logo: true, discordRoleId: true },
    });

    const teamA = teams.find((t) => t.id === currentMatch.teamAId);
    const teamB = teams.find((t) => t.id === currentMatch.teamBId);

    const payload = {
      teamAName: teamA?.name || "Team A",
      teamBName: teamB?.name || "Team B",
      teamALogo: teamA?.logo || null,
      teamBLogo: teamB?.logo || null,
      teamAId: currentMatch.teamAId,
      teamBId: currentMatch.teamBId,
      teamADiscordRoleId: teamA?.discordRoleId || undefined,
      teamBDiscordRoleId: teamB?.discordRoleId || undefined,
      startDate: currentMatch.startDate,
    };

    // Use current match from DB to check for existing message
    // This prevents race conditions where multiple requests try to send messages
    if (currentMatch.discordMessageId) {
      console.log(`[notifyDiscordScheduleChange] Editing existing Discord message ${currentMatch.discordMessageId} for match ${matchId}`);
      try {
        await editDiscordMatchScheduled({
          messageId: currentMatch.discordMessageId,
          ...payload,
        });
        lastNotifiedStartMsByMatch.set(matchId, currentStartMs);
        console.log(`[notifyDiscordScheduleChange] Successfully edited Discord message for match ${matchId}`);
        return;
      } catch (editErr) {
        // If message not found (404), clear the invalid messageId and send a new one
        if (editErr.isMessageNotFound) {
          console.warn(`[notifyDiscordScheduleChange] Discord message ${currentMatch.discordMessageId} not found (404) for match ${matchId}. Clearing messageId and sending new message.`);
          await matchService.update(Number(matchId), { discordMessageId: null });
          // Continue to send new message below
        } else {
          // Re-throw if it's a different error
          throw editErr;
        }
      }
    }

    // Only send if no message exists yet (or previous message was deleted)
    console.log(`[notifyDiscordScheduleChange] Sending new Discord message for match ${matchId}`);
    const messageId = await sendDiscordMatchScheduled(payload);
    if (messageId) {
      console.log(`[notifyDiscordScheduleChange] Received messageId ${messageId}, saving to database for match ${matchId}`);
      await matchService.update(Number(matchId), { discordMessageId: messageId });
      lastNotifiedStartMsByMatch.set(matchId, currentStartMs);
      console.log(`[notifyDiscordScheduleChange] Successfully saved messageId for match ${matchId}`);
    } else {
      console.warn(`[notifyDiscordScheduleChange] sendDiscordMatchScheduled returned no messageId for match ${matchId}`);
    }
  } catch (notifyErr) {
    console.error(`Failed to send/edit Discord match schedule message (${contextLabel}):`, notifyErr);
  }
};

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
    const { tournamentId, semanas, type } = req.query;
    const parsedTournamentId = tournamentId ? Number(tournamentId) : null;
    const parsedSemanas = semanas ? Number(semanas) : null;
    const matches = await matchService.getAll(parsedTournamentId, parsedSemanas, type);
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
    const matchId = Number(id);
    const previousMatch = await matchService.getById(matchId);
    if (!previousMatch) {
      return res.status(404).json({ message: "Match not found" });
    }

    const match = await matchService.update(matchId, req.body);
    
    // Discord notification is async and shouldn't block the response
    enqueueDiscordScheduleChange({
      matchId,
      previousMatch,
      updatedMatch: match,
      requestBody: req.body,
      contextLabel: "adminUpdate",
    }).catch((err) => {
      console.error(`[adminUpdate] Discord notification error for match ${matchId}:`, err);
    });

    res.json(match);
  } catch (err) {
    console.error(`[adminUpdate] Error updating match ${req.params.id}:`, err);
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

    const captainTeamId = req.seasonPlayer.teamId;

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

    console.log(`[captainUpdate] Match ${id} update data:`, updateData);
    const updatedMatch = await matchService.update(Number(id), updateData);
    console.log(`[captainUpdate] Match ${id} updated successfully. New startDate: ${updatedMatch.startDate}`);
    
    // Discord notification is async and shouldn't block the response
    enqueueDiscordScheduleChange({
      matchId: Number(id),
      previousMatch: match,
      updatedMatch,
      requestBody: req.body,
      contextLabel: "captainUpdate",
    }).catch((err) => {
      console.error(`[captainUpdate] Discord notification error for match ${id}:`, err);
    });

    res.json(updatedMatch);
  } catch (err) {
    console.error(`[captainUpdate] Error updating match ${req.params.id}:`, err);
    res.status(400).json({ message: err.message });
  }
};
const managerUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const matchId = Number(id);
    const previousMatch = await matchService.getById(matchId);
    if (!previousMatch) {
      return res.status(404).json({ message: "Match not found" });
    }

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
    const match = await matchService.update(matchId, updateData);
    
    // Discord notification is async and shouldn't block the response
    enqueueDiscordScheduleChange({
      matchId,
      previousMatch,
      updatedMatch: match,
      requestBody: req.body,
      contextLabel: "managerUpdate",
    }).catch((err) => {
      console.error(`[managerUpdate] Discord notification error for match ${matchId}:`, err);
    });

    res.json(match);
  } catch (err) {
    console.error(`[managerUpdate] Error updating match ${req.params.id}:`, err);
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

const undoLastResult = async (req, res) => {
  try {
    const updatedMatch = await matchService.undoLastResult(Number(req.params.id));
    res.json(updatedMatch);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Hard reset of a match back to the schedule stage. Wipes the draft, the
// scoreboard, the timers and the uploaded stats, and rolls back the standings.
// Intended for reruns and rehearsals, hence manager/admin only.
const managerResetMatch = async (req, res) => {
  try {
    const matchId = Number(req.params.id);
    const match = await matchService.getById(matchId);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    const updatedMatch = await matchService.resetToSchedule(matchId);
    return res.json(updatedMatch);
  } catch (err) {
    console.error(`[managerResetMatch] Error resetting match ${req.params.id}:`, err);
    return res.status(400).json({ message: err.message });
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

const captainRequestPause = async (req, res) => {
  try {
    const { id } = req.params;
    const match = await matchService.getById(Number(id));
    
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    const captainTeamId = req.seasonPlayer.teamId;
    if (captainTeamId !== match.teamAId && captainTeamId !== match.teamBId) {
      return res.status(403).json({ message: "You are not part of this match" });
    }

    // Store pause request with captain info (in match's pauseRequestedBy and pauseRequestedAt fields)
    const updatedMatch = await matchService.update(Number(id), {
      pauseRequestedBy: captainTeamId,
      pauseRequestedAt: new Date(),
    });

    res.json({
      message: "Pause requested",
      match: updatedMatch,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const managerTogglePause = async (req, res) => {
  try {
    const { id } = req.params;
    const { paused } = req.body;

    if (typeof paused !== "boolean") {
      return res.status(400).json({ message: "paused must be a boolean" });
    }

    const matchId = Number(id);
    const existing = await matchService.getById(matchId);
    if (!existing) {
      return res.status(404).json({ message: "Match not found" });
    }

    const now = new Date();
    const updates = {
      mapTimerPaused: paused,
      mapTimerPausedAt: paused ? now : null,
    };

    // When resuming after a pause, also clear any pending pause request
    // so the manager isn't left with a stale notification on screen.
    if (!paused) {
      updates.pauseRequestedBy = null;
      updates.pauseRequestedAt = null;
    }

    const updatedMatch = await matchService.update(matchId, updates);

    // When resuming, shift the active draft's phaseStartedAt forward by the
    // paused duration so the on-turn captain doesn't lose elapsed time.
    if (!paused && existing.mapTimerPaused && existing.mapTimerPausedAt) {
      const pausedDuration = now.getTime() - new Date(existing.mapTimerPausedAt).getTime();
      if (pausedDuration > 0) {
        try {
          const draft = await prisma.draftTable.findUnique({
            where: { matchId },
          });
          if (draft && draft.phaseStartedAt && ["MAPTYPEPICKING", "MAPPICKING", "BAN"].includes(draft.phase)) {
            await prisma.draftTable.update({
              where: { id: draft.id },
              data: {
                phaseStartedAt: new Date(
                  new Date(draft.phaseStartedAt).getTime() + pausedDuration
                ),
              },
            });
          }
        } catch (shiftErr) {
          console.error("Failed to shift draft phaseStartedAt on resume:", shiftErr);
        }
      }
    }

    res.json({
      message: paused ? "Timer paused" : "Timer resumed",
      match: updatedMatch,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const managerClearPauseRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedMatch = await matchService.update(Number(id), {
      pauseRequestedBy: null,
      pauseRequestedAt: null,
    });

    res.json({
      message: "Pause request cleared",
      match: updatedMatch,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const generateVsImage = async (req, res) => {
  try {
    const { teamAId, teamBId } = req.params;
    const { generateVsImage: createVsImage } = require("../utils/vsImageGenerator");

    const teams = await prisma.team.findMany({
      where: { id: { in: [Number(teamAId), Number(teamBId)] } },
      select: { id: true, name: true, logo: true },
    });

    const teamA = teams.find((t) => t.id === Number(teamAId));
    const teamB = teams.find((t) => t.id === Number(teamBId));

    if (!teamA || !teamB) {
      return res.status(404).json({ message: "Teams not found" });
    }

    const imageBuffer = await createVsImage({
      teamALogo: teamA.logo,
      teamBLogo: teamB.logo,
      teamAName: teamA.name,
      teamBName: teamB.name,
    });

    res.type("image/png");
    res.send(imageBuffer);
  } catch (err) {
    console.error("Image generation error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Broadcast focus for the map pool overlay. The overlay runs as an OBS browser
// source, a separate browser process, so nothing client-side can carry this —
// it has to round-trip through the match row the overlay already polls.
const OVERLAY_MAP_TYPES = ["CONTROL", "HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"];

const normalizeOverlayFocus = (body) => {
  const hasType = hasOwn(body, "focusType");
  const hasMapId = hasOwn(body, "focusMapId");

  if (!hasType && !hasMapId) {
    throw new Error("Provide focusType or focusMapId.");
  }

  const rawType = hasType ? body.focusType : null;

  // A null type is how the manager sends the overlay back to the plain pool,
  // which also drops any hero card behind it.
  if (rawType === null || rawType === undefined || rawType === "") {
    if (hasMapId && body.focusMapId !== null && body.focusMapId !== undefined) {
      throw new Error("focusType is required when focusMapId is set.");
    }
    return { overlayFocusType: null, overlayFocusMapId: null };
  }

  const overlayFocusType = String(rawType).trim().toUpperCase();
  if (!OVERLAY_MAP_TYPES.includes(overlayFocusType)) {
    throw new Error(`Invalid focusType: ${rawType}`);
  }

  const rawMapId = hasMapId ? body.focusMapId : null;
  if (rawMapId === null || rawMapId === undefined) {
    return { overlayFocusType, overlayFocusMapId: null };
  }

  // Number("") is 0 and Number(true) is 1, so reject anything that is not
  // already a number before letting it near the column.
  if (typeof rawMapId !== "number" || !Number.isInteger(rawMapId) || rawMapId <= 0) {
    throw new Error(`Invalid focusMapId: ${rawMapId}`);
  }

  return { overlayFocusType, overlayFocusMapId: rawMapId };
};

// Deliberately not routed through managerUpdate: that path fires a Discord
// schedule-change notification, and this endpoint is hit once per click.
const managerSetOverlayFocus = async (req, res) => {
  try {
    const matchId = Number(req.params.id);
    if (!Number.isInteger(matchId) || matchId <= 0) {
      return res.status(400).json({ message: "Invalid match id." });
    }

    let focus;
    try {
      focus = normalizeOverlayFocus(req.body);
    } catch (validationError) {
      return res.status(400).json({ message: validationError.message });
    }

    const existing = await prisma.match.findUnique({ where: { id: matchId } });
    if (!existing) {
      return res.status(404).json({ message: "Match not found" });
    }

    const match = await prisma.match.update({
      where: { id: matchId },
      data: focus,
    });

    res.json(match);
  } catch (err) {
    console.error(`[managerSetOverlayFocus] Error for match ${req.params.id}:`, err);
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
  undoLastResult,
  managerUpdate,
  managerResetMatch,
  findSoonest,
  getActiveMatches,
  submitResult,
  adminUpdateWeekMaps,
  adminGetWeekMapsConfig,
  captainRequestPause,
  managerTogglePause,
  managerClearPauseRequest,
  generateVsImage,
  managerSetOverlayFocus,
  __testables: { normalizeOverlayFocus },
};

