import test from "node:test";
import assert from "node:assert/strict";
import { groupSeasonSchedule } from "./schedule.ts";

const divisions = [{ id: 20, name: "Division B", sortOrder: 1 }, { id: 10, name: "Division A", sortOrder: 0 }];
const teams = [{ id: 1, divisionId: 10 }, { id: 2, divisionId: 10 }, { id: 3, divisionId: 20 }, { id: 4, divisionId: 20 }];
const fixture = (id, a, b, week, extra = {}) => ({ id, teamAId: a, teamBId: b, semanas: week, type: "ROUNDROBIN", status: "SCHEDULED", startDate: null, ...extra });
const matches = [fixture(4, 3, 4, 2), fixture(2, 3, 4, 1), fixture(3, 1, 2, 2), fixture(1, 1, 2, 1), fixture(5, 1, 3, null, { type: "FINALS", status: "FINISHED" })];

test("each division keeps its own weekly schedule and crossovers appear once", () => {
  const result = groupSeasonSchedule(matches, teams, divisions);
  assert.deepEqual(result.map((section) => [section.name, section.weeks.map((week) => [week.week, week.matches.map((match) => match.id)])]), [
    ["Division A", [[1, [1]], [2, [3]]]], ["Division B", [[1, [2]], [2, [4]]]], ["Playoffs", [[null, [5]]]],
  ]);
});

test("week filters apply across both divisions and status filters omit empty sections", () => {
  assert.deepEqual(groupSeasonSchedule(matches, teams, divisions, { week: 2 }).flatMap((section) => section.weeks.flatMap((week) => week.matches.map((match) => match.id))), [3, 4]);
  assert.deepEqual(groupSeasonSchedule(matches, teams, divisions, { divisionId: 10, status: "FINISHED" }).map((section) => section.key), ["playoffs"]);
  assert.equal(groupSeasonSchedule(matches, teams, divisions, { status: "ACTIVE" }).length, 0);
});

test("dated fixtures precede undated fixtures with stable ordering; practice is excluded", () => {
  const result = groupSeasonSchedule([
    fixture(4, 1, 2, 1, { startDate: "invalid" }), fixture(3, 1, 2, 1),
    fixture(2, 1, 2, 1, { startDate: "2026-11-02T20:00:00Z" }),
    fixture(1, 1, 2, 1, { startDate: "2026-11-01T20:00:00Z" }),
    fixture(5, 1, 2, 1, { type: "PRACTICE" }),
  ], teams, divisions);
  assert.deepEqual(result[0].weeks[0].matches.map((match) => match.id), [1, 2, 3, 4]);
});

test("legacy seasons and unassigned opponents remain visible without inventing a division", () => {
  assert.equal(groupSeasonSchedule([fixture(1, 1, 2, 1)], [], [])[0].name, "Regular season");
  assert.equal(groupSeasonSchedule([fixture(1, 1, 3, 1)], teams, divisions)[0].name, "Awaiting division");
  assert.equal(groupSeasonSchedule([fixture(1, 1, 3, 1)], teams, divisions, { divisionId: 10 }).length, 0);
});
