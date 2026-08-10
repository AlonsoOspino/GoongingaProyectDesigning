const test = require("node:test");
const assert = require("node:assert/strict");
const archive = require("../../frontend/src/data/history/season-8.json");

test("Season 8 archive contains aggregates and local Wrapped videos", () => {
  assert.equal(archive.season, 8);
  assert.ok(archive.standings.length > 0);
  assert.ok(archive.teams.every((team) => Array.isArray(team.players)));
  assert.ok(archive.playerLeaderboard.every((player) => Number.isFinite(player.killsPer10)));
  assert.equal(archive.grandFinal.champion.score, 4);
  assert.equal(archive.grandFinal.runnerUp.score, 2);
  assert.equal(archive.grandFinal.mvp.name, "Jordaan");
  assert.ok(archive.grandFinal.mvp.image.startsWith("/history/season-8/"));
  assert.ok(Object.values(archive.wrapped.assets.videos).every((url) => url.startsWith("/history/season-8/")));
  assert.equal(Object.prototype.hasOwnProperty.call(archive, "rawPlayerStats"), false);
});
