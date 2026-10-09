import test from "node:test";
import assert from "node:assert/strict";
import { filterMatchesByDivision, groupTeamsByDivision, regularSeasonDivision, regularSeasonStats } from "./divisions.ts";

const divisions = [
  { id: 20, name: "Division B", sortOrder: 1 },
  { id: 10, name: "Division A", sortOrder: 0 },
];
const teams = [
  { id: 1, divisionId: 10 }, { id: 2, divisionId: 10 },
  { id: 3, divisionId: 20 }, { id: 4, divisionId: 20 },
  { id: 5, divisionId: null }, { id: 6, divisionId: 999 },
];

test("division tables retain configured order and keep unassigned teams visible", () => {
  const groups = groupTeamsByDivision(teams, divisions);
  assert.deepEqual(groups.map((group) => [group.id, group.teams.map((team) => team.id)]), [
    [10, [1, 2]], [20, [3, 4]], [null, [5, 6]],
  ]);
  assert.deepEqual(groupTeamsByDivision(teams, []), [{ id: null, name: "All teams", teams }]);
});

test("player statistics follow season match IDs and division opponents, not current team membership", () => {
  const matches = [
    { id: 100, type: "ROUNDROBIN", teamAId: 1, teamBId: 2 },
    { id: 200, type: "ROUNDROBIN", teamAId: 3, teamBId: 4 },
    { id: 300, type: "FINALS", teamAId: 1, teamBId: 3 },
  ];
  const stats = [
    { id: 1, matchId: 100, user: { teamId: 3 } },
    { id: 2, matchId: 200, user: { teamId: 1 } },
    { id: 3, matchId: 99 }, { id: 4, matchId: 300 },
  ];
  assert.deepEqual(regularSeasonStats(stats, matches, teams, null).map((stat) => stat.id), [1, 2]);
  assert.deepEqual(regularSeasonStats(stats, matches, teams, 10).map((stat) => stat.id), [1]);
  assert.deepEqual(regularSeasonStats(stats, matches, teams, 20).map((stat) => stat.id), [2]);
});

test("regular fixtures need both opponents in the same division; playoff crossover stays visible", () => {
  const matches = [
    { id: 1, type: "ROUNDROBIN", teamAId: 1, teamBId: 2 },
    { id: 2, type: "ROUNDROBIN", teamAId: 3, teamBId: 4 },
    { id: 3, type: "ROUNDROBIN", teamAId: 1, teamBId: 3 },
    { id: 4, type: "PLAYOFFS", teamAId: 1, teamBId: 3 },
  ];
  const index = new Map(teams.map((team) => [team.id, team]));
  assert.equal(regularSeasonDivision(matches[0], index), 10);
  assert.equal(regularSeasonDivision(matches[2], index), null);
  assert.equal(regularSeasonDivision(matches[3], index), null);
  assert.deepEqual(filterMatchesByDivision(matches, teams, 10).map((match) => match.id), [1, 4]);
  assert.deepEqual(filterMatchesByDivision(matches, teams, 20).map((match) => match.id), [2, 4]);
  assert.deepEqual(filterMatchesByDivision(matches, teams, null), matches);
});
