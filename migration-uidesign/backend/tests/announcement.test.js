const test = require("node:test");
const assert = require("node:assert/strict");
const { __testables } = require("../controllers/announcement");

test("announcement mode normalization accepts supported modes only", () => {
  assert.equal(__testables.normalizeMode(" tournament "), "TOURNAMENT");
  assert.equal(__testables.normalizeMode("jeopardy"), "JEOPARDY");
  assert.equal(__testables.normalizeMode("custom"), null);
});

test("announcement config only accepts plain objects", () => {
  assert.deepEqual(__testables.normalizeConfig({ label: "Live" }), { label: "Live" });
  assert.deepEqual(__testables.normalizeConfig(["invalid"]), {});
  assert.deepEqual(__testables.normalizeConfig(null), {});
});
