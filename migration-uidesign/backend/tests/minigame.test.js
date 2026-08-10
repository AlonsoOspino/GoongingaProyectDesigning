const test = require("node:test");
const assert = require("node:assert/strict");
const { __testables } = require("../controllers/minigame");

test("Jeopardy state keeps response and result fields explicit", () => {
  assert.deepEqual(__testables.normalizeState({
    turnMemberId: 12,
    currentQuestionId: "question-1",
    responseText: "  Tracer  ",
    answerCorrect: true,
  }), {
    turnMemberId: 12,
    requestedQuestionId: null,
    currentQuestionId: "question-1",
    usedQuestionIds: [],
    revealed: false,
    responseText: "Tracer",
    answerCorrect: true,
    respondedAt: null,
  });
});

test("Jeopardy exposes the six supported lifecycle phases", () => {
  assert.deepEqual([...__testables.JEOPARDY_PHASES], [
    "CREATED",
    "PICKING_MEMBER",
    "PICKING_QUESTION",
    "RESPONDING",
    "RESPONDED",
    "FINALIZED",
  ]);
});
