const assert = require("node:assert/strict");
const test = require("node:test");

const matchService = require("../services/match");
const matchController = require("../controllers/match");

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("generated playoff Grand Final accepts a presentation time separately from the official schedule", async (t) => {
  const originalGetById = matchService.getById;
  const originalUpdate = matchService.update;
  t.after(() => {
    matchService.getById = originalGetById;
    matchService.update = originalUpdate;
  });

  const officialStart = new Date("2026-08-08T20:00:00.000Z");
  const presentationStart = "2026-08-08T19:55:00.000Z";
  matchService.getById = async () => ({ id: 9, type: "PLAYOFFS", title: "Grand Final", startDate: officialStart });
  let updatePayload = null;
  matchService.update = async (_id, payload) => {
    updatePayload = payload;
    return { id: 9, type: "PLAYOFFS", title: "Grand Final", startDate: officialStart, ...payload };
  };

  const res = response();
  await matchController.managerUpdatePresentationTime({
    params: { id: "9" },
    body: { presentationStartDate: presentationStart },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(updatePayload.presentationStartDate.toISOString(), presentationStart);
  assert.equal(res.body.startDate, officialStart);
});

test("clearing the presentation override restores schedule-driven timing", async (t) => {
  const originalGetById = matchService.getById;
  const originalUpdate = matchService.update;
  t.after(() => {
    matchService.getById = originalGetById;
    matchService.update = originalUpdate;
  });

  matchService.getById = async () => ({ id: 9, type: "FINALS" });
  let updatePayload = undefined;
  matchService.update = async (_id, payload) => { updatePayload = payload; return { id: 9, ...payload }; };
  const res = response();
  await matchController.managerUpdatePresentationTime({ params: { id: "9" }, body: { presentationStartDate: null } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(updatePayload, { presentationStartDate: null });
});

test("resetting Finals starts a new rehearsal without touching the official schedule", async (t) => {
  const originalGetById = matchService.getById;
  const originalUpdate = matchService.update;
  t.after(() => {
    matchService.getById = originalGetById;
    matchService.update = originalUpdate;
  });

  const officialStart = new Date("2026-08-08T20:00:00.000Z");
  matchService.getById = async () => ({
    id: 9,
    type: "FINALS",
    startDate: officialStart,
    presentationVersion: 4,
    teamAready: 1,
    teamBready: 1,
  });
  let updatePayload = null;
  matchService.update = async (_id, payload) => {
    updatePayload = payload;
    return { id: 9, type: "FINALS", startDate: officialStart, presentationVersion: 5, teamAready: 0, teamBready: 0 };
  };

  const res = response();
  await matchController.managerResetFinalsPresentation({ params: { id: "9" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(updatePayload, {
    presentationStartDate: null,
    presentationVersion: { increment: 1 },
    teamAready: 0,
    teamBready: 0,
  });
  assert.equal(res.body.startDate, officialStart);
  assert.equal(res.body.presentationVersion, 5);
});
