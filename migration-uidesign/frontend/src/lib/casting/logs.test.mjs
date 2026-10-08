import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("./logs.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("exports", "module", compiled)(module.exports, module);
const { parseWorkshopLog, createWorkshopLogWatcher } = module.exports;

const session = { matchId: 21, gameNumber: 1, mapName: "Lijiang Tower", startedAt: 1000 };
const roster = [{ username: "Jinhyeok", teamId: 11 }, { username: "Naku", teamId: 22 }];
// Fields transcribed from the public upstream real ScrimTime sample at:
// apps/web/test/samples/Log-2024-01-22-20-02-45.txt (see docs/CASTING_LOGS.md).
const start = "[00:00:00] ,match_start,0,Lijiang Tower,Control,Team 1,Team 2\n";
const players = "[00:00:10] ,hero_spawn,0,Team 1,Jinhyeok,Ramattra,0,0\n[00:00:17] ,hero_spawn,0,Team 2,Naku,Junkrat,0,0\n";
const setup = "[00:03:33] ,setup_complete,0,1,29.99\n";
const final = "[00:17:43] ,match_end,727.37,3,0,3\n";
const complete = start + players + setup + final;
const parse = (text, overrides = {}) => parseWorkshopLog(text, { roster, session, ...overrides });

test("verified final match_end maps custom lobby sides through roster names", () => {
  const result = parse(complete);
  assert.equal(result.status, "complete");
  assert.equal(result.result.winnerTeamId, 22);
  assert.deepEqual(result.result.scores, [0, 3]);
  assert.equal(result.result.roundNumber, 3);
  assert.equal(result.result.gameNumber, 1);
  assert.equal(result.result.isDraw, false);
  const reversed = parse(complete, { roster: [{ username: "Jinhyeok", teamId: 22 }, { username: "Naku", teamId: 11 }] });
  assert.equal(reversed.result.winnerTeamId, 11);
});

test("round_end is not a final map result and match_start is not game live", () => {
  assert.equal(parse(start + players).status, "incomplete");
  const result = parse(start + players + setup + "[00:06:25] ,round_end,172.33,1,0,0,1,1,0,100,0\n");
  assert.equal(result.status, "started");
  assert.equal(result.result, undefined);
});

test("partial terminal writes and censored fields cannot create a result", () => {
  assert.equal(parse(complete.trimEnd()).result, undefined);
  assert.equal(parse(complete.replace(",727.37,3,0,3", ",727.37,3,0,****")).status, "review");
  assert.equal(parse(complete.replace(",727.37,3,0,3", ",727.37,3,0")).result, undefined);
  assert.equal(parse(start + players + final + setup).status, "review");
});

test("both sides and at least two unambiguous registered users are required", () => {
  assert.equal(parse(complete, { roster: roster.slice(0, 1) }).status, "review");
  assert.equal(parse(complete, { roster: [{ username: "Jinhyeok", teamId: 11 }, { username: "Naku", teamId: 11 }] }).status, "review");
  assert.equal(parse(complete, { roster: [...roster, { username: "naku#1234", teamId: 11 }] }).status, "review");
  assert.equal(parse(complete.replace("Team 2,Naku", "Team 1,Naku")).status, "review");
  assert.equal(parse(start + players + "[00:00:18] ,hero_spawn,0,Team 1,Naku,Junkrat,0,0\n" + setup + final).status, "review");
});

test("BattleTags match exact base names but accent and punctuation differences are retained", () => {
  assert.equal(parse(complete, { roster: [{ username: "Jinhyeok#1234", teamId: 11 }, { username: "NAKU#9876", teamId: 22 }] }).status, "complete");
  assert.equal(parse(complete, { roster: [{ username: "Jinhyeók", teamId: 11 }, roster[1]] }).status, "review");
});

test("map mismatch, merged sessions, conflicting results and legacy Push require review", () => {
  assert.equal(parse(complete, { session: { ...session, mapName: "Nepal" } }).status, "review");
  assert.equal(parse(complete + start + players + setup + final).status, "review");
  assert.equal(parse(complete + final.replace(",0,3", ",3,0")).status, "review");
  assert.equal(parse(complete.replace(",Control,", ",Push,")).status, "review");
  assert.equal(parse(complete.replace(",727.37,3,0,3", ",727.37,3,3,3")).result, undefined);
});

test("events before Playing boundary are ignored and filename does not change result identity", () => {
  assert.equal(parse(complete, { minimumLiveOffset: start.length + players.length + setup.length }).result, undefined);
  assert.equal(parse(complete, { sourceFile: "Log_one.txt" }).result.eventId, parse(complete, { sourceFile: "Log_duplicate.txt" }).result.eventId);
  const extra = "[00:03:01] ,hero_spawn,1,Team 1,Spingar,Sojourn,0,1\n";
  assert.equal(parse(start + players + setup).start.eventId, parse(start + players + setup + extra, { roster: [...roster, { username: "Spingar", teamId: 11 }] }).start.eventId);
});

function fakeDirectory() {
  let permission = "granted";
  const files = new Map();
  const handle = {
    kind: "directory", name: "Workshop",
    queryPermission: async ({ mode }) => { assert.equal(mode, "read"); return permission; },
    async *values() {
      for (const [name, value] of files) yield {
        kind: "file", name,
        async getFile() { return { size: value.text.length, lastModified: value.modified, text: async () => value.text }; },
      };
    },
  };
  return { handle, files, revoke() { permission = "denied"; } };
}

test("folder watcher excludes old/unchanged logs, waits for final stability and delivers one result", async () => {
  const directory = fakeDirectory();
  const states = [], starts = [], results = [];
  directory.files.set("Log_old.txt", { text: complete.replace("727.37", "600.12"), modified: 900 });
  const watcher = createWorkshopLogWatcher({
    roster, onState: (value) => states.push(value), onGameStart: (value) => starts.push(value), onResult: (value) => results.push(value), pollIntervalMs: 60000,
    picker: async ({ mode }) => { assert.equal(mode, "read"); return directory.handle; },
  });
  try {
    await watcher.selectFolder();
    await watcher.arm(session);
    await watcher.poll();
    assert.equal(results.length, 0);
    directory.files.set("Log_live.txt", { text: start + players + setup, modified: 1100 });
    await watcher.poll();
    assert.equal(starts.length, 1);
    directory.files.set("Log_live.txt", { text: complete, modified: 1200 });
    await watcher.poll();
    assert.equal(results.length, 0);
    await watcher.poll();
    assert.equal(results.length, 1);
    await watcher.poll();
    directory.files.set("Log_copy.txt", { text: complete, modified: 1300 });
    await watcher.poll();
    await watcher.poll();
    assert.equal(results.length, 1);
    assert.equal(starts.length, 1);
    assert.equal(results[0].winnerTeamId, 22);
    assert.ok(states.some((value) => value.status === "watching"));
  } finally { watcher.stop(); }
});

test("a preexisting partial file requires a new first-round setup after arming", async () => {
  const directory = fakeDirectory();
  directory.files.set("Log_partial.txt", { text: start + players, modified: 900 });
  let results = 0;
  const watcher = createWorkshopLogWatcher({ roster, onState() {}, onResult() { results++; }, pollIntervalMs: 60000, picker: async () => directory.handle });
  try {
    await watcher.selectFolder();
    await watcher.arm(session);
    directory.files.set("Log_partial.txt", { text: complete, modified: 1200 });
    await watcher.poll();
    await watcher.poll();
    assert.equal(results, 1);
  } finally { watcher.stop(); }
});

test("revoked permission stops automation and updates its visible state", async () => {
  const directory = fakeDirectory();
  const states = [];
  const watcher = createWorkshopLogWatcher({ roster, onState: (value) => states.push(value), onResult() { assert.fail("Must not publish after revocation"); }, pollIntervalMs: 60000, picker: async () => directory.handle });
  try {
    await watcher.selectFolder();
    await watcher.arm(session);
    directory.revoke();
    await watcher.poll();
    assert.equal(states.at(-1).status, "permission-denied");
    directory.files.set("Log_live.txt", { text: complete, modified: 1200 });
    await watcher.poll();
    assert.equal(states.at(-1).status, "permission-denied");
  } finally { watcher.stop(); }
});

test("copied preexisting terminal files stay stale even when renamed after arming", async () => {
  const directory = fakeDirectory();
  directory.files.set("Log_before.txt", { text: complete, modified: 900 });
  let results = 0;
  const watcher = createWorkshopLogWatcher({ roster, onState() {}, onResult() { results++; }, pollIntervalMs: 60000, picker: async () => directory.handle });
  try {
    await watcher.selectFolder();
    await watcher.arm(session);
    directory.files.set("Log_renamed.txt", { text: complete, modified: 1200 });
    await watcher.poll();
    await watcher.poll();
    assert.equal(results, 0);
  } finally { watcher.stop(); }
});

test("two new distinct current-map results require review even before stability", async () => {
  const directory = fakeDirectory();
  const states = [];
  let results = 0;
  const watcher = createWorkshopLogWatcher({ roster, onState: (value) => states.push(value), onResult() { results++; }, pollIntervalMs: 60000, picker: async () => directory.handle });
  try {
    await watcher.selectFolder();
    await watcher.arm(session);
    directory.files.set("Log_one.txt", { text: complete, modified: 1200 });
    await watcher.poll();
    directory.files.set("Log_two.txt", { text: complete.replace("727.37", "900.45"), modified: 1200 });
    await watcher.poll();
    await watcher.poll();
    assert.equal(results, 0);
    assert.equal(states.at(-1).status, "review");
  } finally { watcher.stop(); }
});

test("unsupported environments and picker cancellation have explicit states", async () => {
  const states = [];
  const unsupported = createWorkshopLogWatcher({ roster, onState: (value) => states.push(value), onResult() {} });
  assert.equal(states.at(-1).status, "unsupported");
  assert.equal(await unsupported.selectFolder(), false);
  unsupported.stop();
  const cancelled = createWorkshopLogWatcher({ roster, onState: (value) => states.push(value), onResult() {}, picker: async () => { const error = new Error("Cancelled"); error.name = "AbortError"; throw error; } });
  assert.equal(await cancelled.selectFolder(), false);
  assert.equal(states.at(-1).status, "disconnected");
  cancelled.stop();
});
