const test = require("node:test");
const assert = require("node:assert/strict");
const { hasManagerAccess, isCaptainOf } = require("../utils/permissions");
const familyFeudManager = require("../middlewares/familyFeudManager");
const { __testables: minigamePermissions } = require("../middlewares/minigameOperator");
const adminMiddleware = require("../middlewares/admin");
const editorMiddleware = require("../middlewares/editor");

function runMiddleware(middleware, user) {
  let allowed = false;
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } };
  middleware({ user }, response, () => { allowed = true; });
  return { allowed, statusCode: response.statusCode };
}

test("Manager operations use Network Social Media and Admin roles", () => {
  assert.equal(hasManagerAccess({ role: "DEFAULT", roles: ["SOCIAL_MEDIA"] }), true);
  assert.equal(hasManagerAccess({ role: "MANAGER", roles: [] }), false);
  assert.equal(hasManagerAccess({ role: "DEFAULT", roles: ["ADMIN"] }), true);
  assert.equal(hasManagerAccess({ role: "DEFAULT", roles: ["MEMBER"] }), false);
});

test("Family Feud management uses Network Social Media and Admin roles", () => {
  let allowed = false;
  const response = { statusCode: 200, payload: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } };
  familyFeudManager({ user: { role: "DEFAULT", roles: ["SOCIAL_MEDIA"] } }, response, () => { allowed = true; });
  assert.equal(allowed, true);

  allowed = false;
  familyFeudManager({ user: { role: "MANAGER", roles: [] } }, response, () => { allowed = true; });
  assert.equal(allowed, false);
  assert.equal(response.statusCode, 403);

  allowed = false;
  familyFeudManager({ user: { role: "DEFAULT", roles: ["ADMIN"] } }, response, () => { allowed = true; });
  assert.equal(allowed, true);
});

test("Casters control Jeopardy without receiving access to other Minigames", () => {
  assert.equal(minigamePermissions.canControlGame(["CASTER"], "JEOPARDY"), true);
  assert.equal(minigamePermissions.canControlGame(["CASTER"], "CUSTOM"), false);
  assert.equal(minigamePermissions.canControlGame(["SOCIAL_MEDIA"], "CUSTOM"), true);
  assert.equal(minigamePermissions.canControlGame(["ADMIN"], "JEOPARDY"), true);
});

test("Admin and editor middleware use Network roles", () => {
  assert.deepEqual(runMiddleware(adminMiddleware, { role: "ADMIN", roles: ["MEMBER"] }), { allowed: false, statusCode: 403 });
  assert.deepEqual(runMiddleware(adminMiddleware, { role: "DEFAULT", roles: ["ADMIN"] }), { allowed: true, statusCode: 200 });
  assert.deepEqual(runMiddleware(editorMiddleware, { role: "EDITOR", roles: ["MEMBER"] }), { allowed: false, statusCode: 403 });
  assert.deepEqual(runMiddleware(editorMiddleware, { role: "DEFAULT", roles: ["CONTENT_CREATOR"] }), { allowed: true, statusCode: 200 });
});

test("captain authority is scoped to the requested tournament", async () => {
  const client = {
    seasonPlayer: {
      findUnique: async ({ where }) => {
        const key = where.memberId_tournamentId;
        if (key.memberId === 7 && key.tournamentId === 9) {
          return { id: 70, teamId: 3, role: "CAPTAIN" };
        }
        if (key.memberId === 7 && key.tournamentId === 10) {
          return { id: 71, teamId: 8, role: "PLAYER" };
        }
        return null;
      },
    },
  };

  assert.equal(await isCaptainOf(7, 9, 3, client), true);
  assert.equal(await isCaptainOf(7, 10, 3, client), false);
});
