import assert from "node:assert/strict";
import test from "node:test";
import { getMapModeTransitionKey, shouldAcceptDraftSnapshot, splitModeMaps } from "../src/lib/draft/mapModeScene.ts";

function snapshot(overrides = {}) {
  return {
    id: 14,
    phase: "MAPTYPEPICKING",
    phaseStartedAt: "2026-10-18T12:00:05Z",
    selectedMapType: null,
    currentMapId: null,
    match: { gameNumber: 1 },
    ...overrides,
  };
}
const choosing = snapshot();
const selected = snapshot({ phase: "MAPPICKING", selectedMapType: "PUSH", phaseStartedAt: "2026-10-18T12:00:15Z" });

test("the same round's confirmed mode selection has a stable scene identity", () => {
  const key = getMapModeTransitionKey(choosing, selected);
  assert.equal(key, "14:2:PUSH:2026-10-18T12:00:15Z");
  assert.equal(getMapModeTransitionKey(choosing, { ...selected }), key);
});

test("mounting into a chosen mode or polling it again does not replay the scene", () => {
  assert.equal(getMapModeTransitionKey(null, selected), null);
  assert.equal(getMapModeTransitionKey(undefined, selected), null);
  assert.equal(getMapModeTransitionKey(selected, selected), null);
  assert.equal(getMapModeTransitionKey(selected, { ...selected, phaseStartedAt: "2026-10-18T12:00:20Z" }), null);
});

test("cross-draft and cross-round responses cannot create a mode scene", () => {
  assert.equal(getMapModeTransitionKey(choosing, { ...selected, id: 15 }), null);
  assert.equal(getMapModeTransitionKey(choosing, { ...selected, match: { gameNumber: 2 } }), null);
  assert.equal(getMapModeTransitionKey(choosing, null), null);
});

test("late snapshots with a locked map or another phase cannot present an obsolete mode scene", () => {
  assert.equal(getMapModeTransitionKey(choosing, { ...selected, currentMapId: 71 }), null);
  for (const phase of ["STARTING", "BAN", "PLAYING", "ENDMAP", "FINISHED"]) {
    assert.equal(getMapModeTransitionKey(choosing, { ...selected, phase }), null);
    assert.equal(getMapModeTransitionKey({ ...choosing, phase }, selected), null);
  }
  assert.equal(getMapModeTransitionKey(choosing, { ...selected, selectedMapType: null }), null);
  assert.equal(getMapModeTransitionKey(choosing, { ...selected, phaseStartedAt: "" }), null);
});

test("a replay after reset gets a fresh identity even with the same draft, round and mode", () => {
  const first = getMapModeTransitionKey(choosing, selected);
  const replay = getMapModeTransitionKey(choosing, { ...selected, phaseStartedAt: "2026-10-18T12:03:15Z" });
  assert.notEqual(replay, first);
});

test("mode detection follows the confirmed server type, including any future control selection", () => {
  assert.equal(getMapModeTransitionKey(choosing, { ...selected, selectedMapType: "CONTROL" }), "14:2:CONTROL:2026-10-18T12:00:15Z");
});

test("map lanes preserve pool order and balance odd and even counts", () => {
  for (let count = 2; count <= 9; count += 1) {
    const maps = Object.freeze(Array.from({ length: count }, (_, id) => ({ id })));
    const { left, right } = splitModeMaps(maps);
    assert.equal(left.length, Math.floor(count / 2));
    assert.equal(right.length, Math.ceil(count / 2));
    assert.deepEqual([...left, ...right], maps);
  }
  assert.deepEqual(splitModeMaps(["a", "b", "c"]), { left: ["a"], right: ["b", "c"] });
});

test("empty and single-map pools remain usable without duplicating map cards", () => {
  assert.deepEqual(splitModeMaps([]), { left: [], right: [] });
  assert.deepEqual(splitModeMaps(["only"]), { left: ["only"], right: [] });
});

test("a late poll cannot replace a confirmed action or a completed reset of the same draft", () => {
  const beforeReset = { ...selected, version: 8 };
  const afterReset = { ...choosing, phase: "STARTING", version: 9 };
  assert.equal(shouldAcceptDraftSnapshot(beforeReset, afterReset), true);
  assert.equal(shouldAcceptDraftSnapshot(afterReset, beforeReset), false);
  assert.equal(shouldAcceptDraftSnapshot({ id: 14, version: 8 }, { id: 14, version: 7 }), false);
});

test("equal-version responses remain usable for refreshed timers and match display fields", () => {
  assert.equal(shouldAcceptDraftSnapshot({ id: 14, version: 8 }, { id: 14, version: 8 }), true);
  assert.equal(shouldAcceptDraftSnapshot({ id: 14, version: 8 }, { id: 14, version: 9 }), true);
});

test("initial, new-draft and older-server responses do not require a comparable version", () => {
  assert.equal(shouldAcceptDraftSnapshot(null, { id: 14, version: 1 }), true);
  assert.equal(shouldAcceptDraftSnapshot({ id: 14, version: 8 }, { id: 15, version: 0 }), true);
  assert.equal(shouldAcceptDraftSnapshot({ id: 14 }, { id: 14, version: 1 }), true);
  assert.equal(shouldAcceptDraftSnapshot({ id: 14, version: 1 }, { id: 14 }), true);
});
