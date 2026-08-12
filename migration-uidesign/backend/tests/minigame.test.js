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
      { questionId: "question-3", memberId: 42, reward: -400 },
    ],
  }).questionResults, [
    { questionId: "question-1", memberId: 42, reward: 200 },
    { questionId: "question-2", memberId: null, reward: 300 },
    { questionId: "question-3", memberId: 42, reward: -400 },
  ]);
});

test("Jeopardy board exposes added, subtracted, and unanswered results", () => {
  const config = {
    categories: [{
      id: "category-1",
      name: "Test",
      questions: [
        { id: "add", question: "Add?", answer: "Yes", reward: 100 },
        { id: "subtract", question: "Subtract?", answer: "Yes", reward: 200 },
        { id: "none", question: "No answer?", answer: "Yes", reward: 300 },
      ],
    }],
  };
  const board = __testables.publicBoard(config, {
    usedQuestionIds: ["add", "subtract", "none"],
    questionResults: [
      { questionId: "add", memberId: 42, reward: 100 },
      { questionId: "subtract", memberId: 42, reward: -200 },
      { questionId: "none", memberId: null, reward: 0 },
    ],
  });

  assert.deepEqual(board.categories[0].questions.map(({ answeredMemberId, unanswered, scoreDelta }) => ({ answeredMemberId, unanswered, scoreDelta })), [
    { answeredMemberId: 42, unanswered: false, scoreDelta: 100 },
    { answeredMemberId: 42, unanswered: false, scoreDelta: -200 },
    { answeredMemberId: null, unanswered: true, scoreDelta: 0 },
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

test("Jeopardy keeps a question open until a correct answer or every player misses", () => {
  const roster = [10, 20, 30];
  assert.equal(__testables.shouldCloseQuestion("SUBTRACT", roster, [10]), false);
  assert.equal(__testables.shouldCloseQuestion("SUBTRACT", roster, [10, 20]), false);
  assert.equal(__testables.shouldCloseQuestion("SUBTRACT", roster, [10, 20, 30]), true);
  assert.equal(__testables.shouldCloseQuestion("ADD", roster, [10]), true);
  assert.equal(__testables.shouldCloseQuestion("NO_ANSWER", roster, []), true);
});
