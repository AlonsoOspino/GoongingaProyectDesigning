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
    questionResults: [],
  });
});

test("Jeopardy state normalizes direct question awards", () => {
  assert.deepEqual(__testables.normalizeState({
    questionResults: [
      { questionId: "question-1", memberId: 42, reward: 200 },
      { questionId: "question-2", memberId: null, reward: 300 },
    ],
  }).questionResults, [
    { questionId: "question-1", memberId: 42, reward: 200 },
    { questionId: "question-2", memberId: null, reward: 300 },
  ]);
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
