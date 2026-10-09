const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

test("season label uses administered data and stays neutral without it", async () => {
  const moduleUrl = pathToFileURL(path.resolve(
    __dirname,
    "../../frontend/src/features/tournament/seasonIdentity.ts",
  )).href;
  const { resolveSeasonLabel } = await import(moduleUrl);

  assert.equal(resolveSeasonLabel({ name: "  Community Cup  " }), "Community Cup");
  assert.equal(resolveSeasonLabel(null), "Season");
  assert.equal(resolveSeasonLabel({ name: "" }), "Season");
  assert.doesNotMatch(resolveSeasonLabel(null), /\d/);
});

test("season-specific pages do not inherit the preceding season's phase", async () => {
  const moduleUrl = pathToFileURL(path.resolve(
    __dirname,
    "../../frontend/src/features/tournament/seasonIdentity.ts",
  )).href;
  const { matchesSeasonNumber } = await import(moduleUrl);

  assert.equal(matchesSeasonNumber({ name: "Goonginga Season 8!" }, 9), false);
  assert.equal(matchesSeasonNumber({ name: "Goonginga Season 9!" }, 9), true);
  assert.equal(matchesSeasonNumber({ name: "season 90" }, 9), false);
  assert.equal(matchesSeasonNumber({ name: "Community Cup" }, 9), false);
  assert.equal(matchesSeasonNumber(null, 9), false);
});
