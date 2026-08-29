const test = require("node:test");
const assert = require("node:assert/strict");
const { __testables } = require("../controllers/match");

const { normalizeOverlayFocus } = __testables;

test("an empty body is rejected so a stray call cannot silently clear the overlay", () => {
  assert.throws(() => normalizeOverlayFocus({}), /focusType or focusMapId/i);
});

test("a map type is accepted and normalized to upper case", () => {
  assert.deepEqual(normalizeOverlayFocus({ focusType: "control" }), {
    overlayFocusType: "CONTROL",
    overlayFocusMapId: null,
  });
});

test("every supported map type is allowed", () => {
  for (const type of ["CONTROL", "HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"]) {
    assert.equal(normalizeOverlayFocus({ focusType: type }).overlayFocusType, type);
  }
});

test("an unknown map type is rejected", () => {
  assert.throws(() => normalizeOverlayFocus({ focusType: "KOTH" }), /invalid focusType/i);
});

test("clearing the focus sends both columns back to null", () => {
  assert.deepEqual(normalizeOverlayFocus({ focusType: null }), {
    overlayFocusType: null,
    overlayFocusMapId: null,
  });
});

test("a focused map keeps its type so the column stays expanded behind it", () => {
  assert.deepEqual(normalizeOverlayFocus({ focusType: "HYBRID", focusMapId: 12 }), {
    overlayFocusType: "HYBRID",
    overlayFocusMapId: 12,
  });
});

test("a map id without a type is rejected: a hero card with no column is not a state", () => {
  assert.throws(() => normalizeOverlayFocus({ focusMapId: 12 }), /focusType is required/i);
});

test("a non-positive or non-integer map id is rejected", () => {
  for (const bad of [0, -3, 1.5, "abc", true]) {
    assert.throws(
      () => normalizeOverlayFocus({ focusType: "PUSH", focusMapId: bad }),
      /invalid focusMapId/i,
      `expected ${JSON.stringify(bad)} to be rejected`
    );
  }
});

test("an explicitly null map id clears only the hero card", () => {
  assert.deepEqual(normalizeOverlayFocus({ focusType: "PUSH", focusMapId: null }), {
    overlayFocusType: "PUSH",
    overlayFocusMapId: null,
  });
});
