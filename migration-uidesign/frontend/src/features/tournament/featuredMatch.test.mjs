import test from "node:test";
import assert from "node:assert/strict";
import { pickTournamentPhase } from "./featuredMatch.ts";

const season = { id: 9, state: "SCHEDULED", startDate: null };
const match = (id, fields = {}) => ({
  id, tournamentId: 9, type: "ROUNDROBIN", status: "SCHEDULED", startDate: "", semanas: 1, ...fields,
});
const now = Date.parse("2026-10-17T00:00:00Z");

test("scheduled seasons feature real fixtures without waiting for a season state change", () => {
  const fixture = match(1, { startDate: "2026-10-18T00:00:00Z" });
  assert.deepEqual(pickTournamentPhase(season, [fixture], now), { kind: "next-match", match: fixture, at: fixture.startDate });
  assert.equal(pickTournamentPhase(season, [match(2)], now).kind, "preview");
});

test("old seasons and practice matches cannot become the landing announcement", () => {
  const practice = match(1, { type: "PRACTICE", status: "ACTIVE" });
  const archived = match(2, { tournamentId: 8, status: "ACTIVE" });
  assert.deepEqual(pickTournamentPhase(season, [practice, archived], now), { kind: "preparation", at: null });
  assert.deepEqual(pickTournamentPhase(null, [match(3)], now), { kind: "coming-soon" });
});

test("live takes priority and upcoming dates beat delayed fixtures", () => {
  const upcoming = match(2, { startDate: "2026-10-18T00:00:00Z" });
  const delayed = match(1, { startDate: "2026-10-16T00:00:00Z" });
  const live = match(3, { status: "ACTIVE" });
  assert.equal(pickTournamentPhase(season, [delayed, upcoming], now).match.id, 2);
  assert.equal(pickTournamentPhase(season, [delayed, upcoming, live], now).match.id, 3);
});

test("latest results use date and week instead of per-match game number", () => {
  const older = match(1, { status: "FINISHED", semanas: 1, gameNumber: 5 });
  const latest = match(2, { status: "FINISHED", semanas: 2, gameNumber: 3 });
  assert.equal(pickTournamentPhase(season, [older, latest], now).match.id, 2);
  assert.deepEqual(pickTournamentPhase({ ...season, state: "FINISHED" }, [], now), { kind: "complete" });
});

test("invalid opening dates do not create a broken countdown", () => {
  assert.deepEqual(pickTournamentPhase({ ...season, startDate: "invalid" }, [], now), { kind: "preparation", at: null });
  assert.deepEqual(pickTournamentPhase({ ...season, startDate: "2026-10-18T00:00:00Z" }, [], now), {
    kind: "preparation", at: "2026-10-18T00:00:00Z",
  });
});
