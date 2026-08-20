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

async function resolvePayload(content) {
  if (content.matchId) {
    const pinned = await prisma.match.findUnique({ where: { id: content.matchId }, select: matchSelect });
    if (!pinned) return { state: "IDLE", match: null };
    return { state: pinned.status === "ACTIVE" ? "LIVE" : "UPCOMING", match: pinned };
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

module.exports = { type: "TOURNAMENT", validateContent, resolvePayload };
