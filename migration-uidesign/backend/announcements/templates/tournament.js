const { assertPlainObject, optionalText } = require("./shared");

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

module.exports = { type: "TOURNAMENT", validateContent };
