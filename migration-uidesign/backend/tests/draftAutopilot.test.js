const test = require("node:test");
const assert = require("node:assert/strict");
const { __testables } = require("../services/draftAutopilot");

const { decideNextStep } = __testables;

const at = (overrides) =>
  decideNextStep({
    phase: "STARTING",
    matchStatus: "SCHEDULED",
    teamAready: 0,
    teamBready: 0,
    hasPickThisGame: false,
    ...overrides,
  });

test("a fresh draft checks the stand-in captains in before anything else", () => {
  assert.equal(at({ phase: "STARTING" }), "READY_UP");
});

test("one captain ready is not enough to open the game", () => {
  assert.equal(at({ phase: "STARTING", teamAready: 1 }), "READY_UP");
  assert.equal(at({ phase: "STARTING", teamBready: 1 }), "READY_UP");
});

test("both captains ready opens map picking", () => {
  assert.equal(at({ phase: "STARTING", teamAready: 1, teamBready: 1 }), "START_MAP_PICKING");
});

test("map picking waits for a pick, then opens bans", () => {
  assert.equal(at({ phase: "MAPPICKING", hasPickThisGame: false }), "PICK_MAP");
  assert.equal(at({ phase: "MAPPICKING", hasPickThisGame: true }), "START_BAN");
});

test("each remaining phase has exactly one move", () => {
  assert.equal(at({ phase: "MAPTYPEPICKING" }), "PICK_MAP_TYPE");
  assert.equal(at({ phase: "BAN" }), "BAN_HERO");
  assert.equal(at({ phase: "PLAYING" }), "END_MAP");
  assert.equal(at({ phase: "ENDMAP" }), "SUBMIT_RESULT");
});

test("a finished match is left alone whatever the draft phase says", () => {
  for (const phase of ["STARTING", "MAPPICKING", "BAN", "PLAYING", "ENDMAP"]) {
    assert.equal(
      at({ phase, matchStatus: "FINISHED", teamAready: 1, teamBready: 1 }),
      "IDLE",
      `expected ${phase} on a finished match to idle`
    );
  }
});

test("a finished draft idles even while the match still reads active", () => {
  assert.equal(at({ phase: "FINISHED", matchStatus: "ACTIVE" }), "IDLE");
});

test("an unknown phase idles rather than guessing a move", () => {
  assert.equal(at({ phase: "SOMETHING_NEW" }), "IDLE");
  assert.equal(decideNextStep(), "IDLE");
});

test("the whole best-of series is reachable by following the steps", () => {
  // Walk one game end to end, asserting the machine never stalls or repeats.
  const seen = [];
  let state = { phase: "STARTING", matchStatus: "ACTIVE", teamAready: 0, teamBready: 0, hasPickThisGame: false };

  const transitions = {
    READY_UP: (s) => ({ ...s, teamAready: 1, teamBready: 1 }),
    START_MAP_PICKING: (s) => ({ ...s, phase: "MAPTYPEPICKING" }),
    PICK_MAP_TYPE: (s) => ({ ...s, phase: "MAPPICKING" }),
    PICK_MAP: (s) => ({ ...s, hasPickThisGame: true }),
    START_BAN: (s) => ({ ...s, phase: "BAN" }),
    BAN_HERO: (s) => ({ ...s, phase: "PLAYING" }),
    END_MAP: (s) => ({ ...s, phase: "ENDMAP" }),
    SUBMIT_RESULT: (s) => ({ ...s, phase: "FINISHED" }),
  };

  for (let guard = 0; guard < 20; guard += 1) {
    const step = decideNextStep(state);
    if (step === "IDLE") break;
    seen.push(step);
    state = transitions[step](state);
  }

  assert.deepEqual(seen, [
    "READY_UP",
    "START_MAP_PICKING",
    "PICK_MAP_TYPE",
    "PICK_MAP",
    "START_BAN",
    "BAN_HERO",
    "END_MAP",
    "SUBMIT_RESULT",
  ]);
});
