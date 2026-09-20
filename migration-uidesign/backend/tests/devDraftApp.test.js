const test = require("node:test");
const assert = require("node:assert/strict");
const { isDevMatchReference } = require("../utils/devDraftApp");
const { __testables } = require("../services/devDraftApp");

const { normalizeTeamInput, normalizeMapIds, normalizeBanIds } = __testables;

test("the dev match alias is case-insensitive and exact", () => {
  assert.equal(isDevMatchReference("dev"), true);
  assert.equal(isDevMatchReference(" DEV "), true);
  assert.equal(isDevMatchReference("development"), false);
  assert.equal(isDevMatchReference(12), false);
});

test("developer teams require only a valid name and logo", () => {
  assert.deepEqual(normalizeTeamInput({ name: "  Nova  ", logo: "/uploads/nova.png" }), {
    name: "Nova",
    logo: "/uploads/nova.png",
  });
  assert.throws(() => normalizeTeamInput({ name: "Nova" }), /logo is required/i);
  assert.throws(
    () => normalizeTeamInput({ name: "Nova", logo: "javascript:alert(1)" }),
    /absolute URL or public path/i
  );
});

test("map ids are positive, unique, and preserve selection order", () => {
  assert.deepEqual(normalizeMapIds([4, 2, 4, 8]), [4, 2, 8]);
  assert.throws(() => normalizeMapIds([]), /at least one valid map/i);
  assert.throws(() => normalizeMapIds([1, 0]), /at least one valid map/i);
});

test("each team can register at most two hero bans", () => {
  assert.deepEqual(normalizeBanIds([1, "2", null], "teamABans"), [1, 2]);
  assert.throws(() => normalizeBanIds([1, 2, 3], "teamABans"), /at most two/i);
  assert.throws(() => normalizeBanIds(["bad"], "teamABans"), /positive integer/i);
});
