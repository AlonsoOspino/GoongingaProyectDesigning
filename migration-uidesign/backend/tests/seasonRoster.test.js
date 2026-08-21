const test = require("node:test");
const assert = require("node:assert/strict");
const seasonRoster = require("../services/seasonRoster");

test("season roster rejects a captain without a team", () => {
  assert.throws(
    () => seasonRoster.__testables.normalizeAssignment({ teamId: null, role: "CAPTAIN" }),
    /captain must be assigned to a team/i
  );
});

test("season roster bridge preserves permanent scalar roles", () => {
  assert.deepEqual(seasonRoster.__testables.legacyRoleUpdate("ADMIN", "PLAYER"), {});
  assert.deepEqual(seasonRoster.__testables.legacyRoleUpdate("MANAGER", "CAPTAIN"), {});
  assert.deepEqual(seasonRoster.__testables.legacyRoleUpdate("DEFAULT", "CAPTAIN"), { role: "CAPTAIN" });
  assert.deepEqual(seasonRoster.__testables.legacyRoleUpdate("CAPTAIN", "PLAYER"), { role: "DEFAULT" });
});

test("season roster rejects a team from another tournament", async () => {
  const client = {
    $transaction: async (operation) => operation(client),
    tournament: { findUnique: async () => ({ id: 9, state: "SCHEDULED" }) },
    networkMember: { findUnique: async () => ({ id: 4, username: "Ana", status: "ACTIVE", role: "DEFAULT" }) },
    team: { findUnique: async () => ({ id: 30, tournamentId: 8 }) },
  };
  await assert.rejects(
    seasonRoster.upsertMember(9, 4, { teamId: 30, role: "PLAYER" }, client),
    /does not belong to this season/i
  );
});

test("promoting a captain demotes the incumbent in the same transaction", async () => {
  const updates = [];
  const client = {
    $transaction: async (operation) => operation(client),
    tournament: { findUnique: async () => ({ id: 9, state: "SCHEDULED" }) },
    team: { findUnique: async () => ({ id: 30, tournamentId: 9 }) },
    networkMember: {
      findUnique: async () => ({ id: 4, username: "Ana", status: "ACTIVE", role: "DEFAULT" }),
      update: async (request) => { updates.push(["member", request]); return request; },
    },
    seasonPlayer: {
      findFirst: async () => ({ id: 70, memberId: 7, member: { username: "Luis", role: "CAPTAIN" } }),
      update: async (request) => { updates.push(["season", request]); return request; },
      upsert: async () => ({ id: 71, memberId: 4, teamId: 30, role: "CAPTAIN" }),
    },
  };
  const result = await seasonRoster.upsertMember(9, 4, { teamId: 30, role: "CAPTAIN" }, client);
  assert.deepEqual(result.demoted, { memberId: 7, username: "Luis" });
  assert.deepEqual(updates[0], ["season", { where: { id: 70 }, data: { role: "PLAYER" } }]);
  assert.equal(updates.some(([type, request]) => type === "member" && request.where.id === 7 && request.data.role === "DEFAULT"), true);
});
