const { assertPlainObject, optionalText } = require("./shared");
const prisma = require("../../config/prisma");

function validateContent(content) {
  const source = assertPlainObject(content);
  let matchId = null;

  if (source.matchId !== null && source.matchId !== undefined && source.matchId !== "") {
    matchId = Number(source.matchId);
    if (!Number.isInteger(matchId) || matchId <= 0) {
      throw new Error("Pick a valid match, or leave the announcement on automatic.");
    }
  }

  return { matchId, headline: optionalText(source.headline, 120) };
}

const matchSelect = {
  id: true,
  title: true,
  type: true,
  bestOf: true,
  status: true,
  startDate: true,
  mapWinsTeamA: true,
  mapWinsTeamB: true,
  gameNumber: true,
  teamA: { select: { id: true, name: true, logo: true } },
  teamB: { select: { id: true, name: true, logo: true } },
};

function pinnedState(status) {
  if (status === "ACTIVE") return "LIVE";
  if (status === "SCHEDULED") return "UPCOMING";
  return "IDLE";
}

async function resolvePayload(content) {
  if (content.matchId) {
    const pinned = await prisma.match.findUnique({ where: { id: content.matchId }, select: matchSelect });
    if (!pinned) return { state: "IDLE", match: null };
    const state = pinnedState(pinned.status);
    // A pinned match that is over must not keep announcing itself as the next
    // one. Dropping the match sends the view to its idle presentation, the same
    // fallback the automatic branch uses when nothing is live or upcoming.
    return state === "IDLE" ? { state, match: null } : { state, match: pinned };
  }

  const active = await prisma.match.findFirst({
    where: { status: "ACTIVE" },
    select: matchSelect,
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
  });
  if (active) return { state: "LIVE", match: active };

  const upcoming = await prisma.match.findFirst({
    where: { status: "SCHEDULED", startDate: { gte: new Date() } },
    select: matchSelect,
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
  });
  return { state: upcoming ? "UPCOMING" : "IDLE", match: upcoming };
}

module.exports = { type: "TOURNAMENT", validateContent, resolvePayload, __testables: { pinnedState } };
