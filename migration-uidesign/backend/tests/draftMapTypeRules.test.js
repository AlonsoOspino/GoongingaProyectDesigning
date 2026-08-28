const test = require("node:test");
const assert = require("node:assert/strict");
const { getAllowedMapTypes, __testables } = require("../controllers/draft");

test("game one is always Control for every match format", () => {
  for (const matchType of ["ROUNDROBIN", "PLAYOFFS", "FINALS", "PRACTICE"]) {
    assert.deepEqual(getAllowedMapTypes(1, matchType), ["CONTROL"]);
  }
});

test("the previous loser can choose any supported non-Control mode from game two", () => {
  const expected = ["HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"];

  assert.deepEqual(getAllowedMapTypes(2, "ROUNDROBIN"), expected);
  assert.deepEqual(getAllowedMapTypes(5, "PLAYOFFS"), expected);
  assert.deepEqual(getAllowedMapTypes(7, "FINALS"), expected);
});

test("legacy per-game configuration is flattened into one weekly map pool", () => {
  assert.deepEqual(
    __testables.parseAllAllowedMapIds({
      1: [1, "2", 2],
      2: [3, null, -1],
      metadata: "ignored",
    }),
    [1, 2, 3]
  );
  assert.equal(__testables.parseAllAllowedMapIds(null), null);
});
