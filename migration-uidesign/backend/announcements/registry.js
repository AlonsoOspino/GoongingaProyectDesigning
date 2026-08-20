const tournament = require("./templates/tournament");
const minigame = require("./templates/minigame");
const custom = require("./templates/custom");
const form = require("./templates/form");

const templates = new Map([tournament, minigame, custom, form].map((template) => [template.type, template]));

function getTemplate(type) {
  const template = templates.get(String(type || "").trim().toUpperCase());
  if (!template) throw new Error("Choose Tournament, Minigame, Custom or Form.");
  return template;
}

function normalizeCountdown(value) {
  if (value === null || value === undefined || value === "") return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time) : null;
}

module.exports = { getTemplate, normalizeCountdown, templates };
