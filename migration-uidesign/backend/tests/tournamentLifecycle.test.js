const test = require("node:test");
const assert = require("node:assert/strict");
const { __testables } = require("../services/tournament");

test("tournament creation accepts a valid season after prior seasons finish", () => {
  const result = __testables.normalizeCreateData({
    name: "GGL Season 9",
    startDate: "2026-09-01T00:00:00.000Z",
  });

  assert.equal(result.name, "GGL Season 9");
  assert.equal(result.state, "SCHEDULED");
  assert.equal(result.startDate.toISOString(), "2026-09-01T00:00:00.000Z");
});

test("tournament creation names the active season that blocks it", () => {
  assert.throws(
    () => __testables.normalizeCreateData(
      { name: "GGL Season 10", startDate: "2027-01-01" },
      { id: 9, name: "GGL Season 9", state: "ROUNDROBIN" }
    ),
    /Finish GGL Season 9 before creating another season/
  );
});

test("tournament creation rejects an invalid countdown date", () => {
  assert.throws(
    () => __testables.normalizeCreateData({ name: "GGL Season 9", startDate: "not-a-date" }),
    /startDate must be a valid date/
  );
});

test("tournament creation cannot bypass the active-season guard with a supplied state", () => {
  const result = __testables.normalizeCreateData({
    name: "GGL Season 9",
    startDate: "2026-09-01T00:00:00.000Z",
    state: "FINISHED",
  });
  assert.equal(result.state, "SCHEDULED");
});
