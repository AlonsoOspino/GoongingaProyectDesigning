const DEV_DRAFT_TOURNAMENT_NAME = "GGL Developer Draft App";
const DEV_DRAFT_MATCH_TITLE = "Developer Match";
const DEV_DRAFT_START_DATE = new Date("1990-01-01T00:00:00.000Z");

const isDevMatchReference = (value) =>
  String(value || "").trim().toLowerCase() === "dev";

module.exports = {
  DEV_DRAFT_TOURNAMENT_NAME,
  DEV_DRAFT_MATCH_TITLE,
  DEV_DRAFT_START_DATE,
  isDevMatchReference,
};
