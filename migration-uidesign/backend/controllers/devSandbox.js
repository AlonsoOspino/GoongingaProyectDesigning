/*
 * HTTP surface for the developer sandbox.
 *
 * Every route is admin-only and every write is scoped to the sandbox season by
 * the service beneath it, so a wrong id returns "not part of the sandbox"
 * rather than touching a real match.
 */

const devSandbox = require("../services/devSandbox");
const draftAutopilot = require("../services/draftAutopilot");

// The sandbox ships enabled so it is usable on the server without editing env
// files. Set DEV_SANDBOX_ENABLED=false to switch it off completely.
const isEnabled = () => String(process.env.DEV_SANDBOX_ENABLED || "").toLowerCase() !== "false";

const ensureEnabled = (res) => {
  if (isEnabled()) return true;
  res.status(404).json({ message: "The developer sandbox is disabled on this server." });
  return false;
};

const buildStatus = async () => {
  const tournament = await devSandbox.findSandboxTournament();
  const matches = await devSandbox.listSandboxMatches();

  return {
    enabled: isEnabled(),
    tournament: tournament
      ? { id: tournament.id, name: tournament.name, state: tournament.state }
      : null,
    autopilot: {
      running: draftAutopilot.isRunning(),
      tickMs: draftAutopilot.DEFAULT_TICK_MS,
      lastResults: draftAutopilot.getLastResults(),
    },
    matches: matches.map((match) => ({
      id: match.id,
      status: match.status,
      bestOf: match.bestOf,
      gameNumber: match.gameNumber,
      mapWinsTeamA: match.mapWinsTeamA,
      mapWinsTeamB: match.mapWinsTeamB,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      teamAready: match.teamAready,
      teamBready: match.teamBready,
      phase: match.draft?.phase ?? null,
      draftId: match.draft?.id ?? null,
    })),
  };
};

const getStatus = async (req, res) => {
  try {
    if (!ensureEnabled(res)) return;
    res.json(await buildStatus());
  } catch (error) {
    console.error("[devSandbox] status failed:", error);
    res.status(500).json({ message: error.message });
  }
};

const createMatch = async (req, res) => {
  try {
    if (!ensureEnabled(res)) return;

    const rawBestOf = Number(req.body?.bestOf);
    const bestOf = [3, 5, 7].includes(rawBestOf) ? rawBestOf : 5;

    const created = await devSandbox.createSandboxMatch({ bestOf });

    // A sandbox match with nobody driving it is the old problem again, so the
    // stand-in captains start as soon as there is something to play.
    if (req.body?.autopilot !== false) {
      draftAutopilot.start(Number(req.body?.tickMs) || draftAutopilot.DEFAULT_TICK_MS);
    }

    res.status(201).json({
      matchId: created.match.id,
      draftId: created.draft.id,
      teamA: { id: created.teamA.id, name: created.teamA.name },
      teamB: { id: created.teamB.id, name: created.teamB.name },
      status: await buildStatus(),
    });
  } catch (error) {
    console.error("[devSandbox] create failed:", error);
    res.status(400).json({ message: error.message });
  }
};

const deleteMatch = async (req, res) => {
  try {
    if (!ensureEnabled(res)) return;
    const result = await devSandbox.deleteSandboxMatch(req.params.id);
    res.json({ ...result, status: await buildStatus() });
  } catch (error) {
    const notSandbox = /not part of the developer sandbox/i.test(error?.message || "");
    res.status(notSandbox ? 403 : 400).json({ message: error.message });
  }
};

const setAutopilot = async (req, res) => {
  try {
    if (!ensureEnabled(res)) return;

    const shouldRun = req.body?.running !== false;
    if (shouldRun) {
      draftAutopilot.start(Number(req.body?.tickMs) || draftAutopilot.DEFAULT_TICK_MS);
    } else {
      draftAutopilot.stop();
    }

    res.json(await buildStatus());
  } catch (error) {
    console.error("[devSandbox] autopilot toggle failed:", error);
    res.status(400).json({ message: error.message });
  }
};

/** Run a single step now, for when 3 seconds is too long to wait. */
const stepOnce = async (req, res) => {
  try {
    if (!ensureEnabled(res)) return;
    const results = await draftAutopilot.tick();
    res.json({ results, status: await buildStatus() });
  } catch (error) {
    console.error("[devSandbox] manual step failed:", error);
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getStatus,
  createMatch,
  deleteMatch,
  setAutopilot,
  stepOnce,
  __testables: { isEnabled },
};
