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
