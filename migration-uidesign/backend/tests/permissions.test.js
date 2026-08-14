const test = require("node:test");
const assert = require("node:assert/strict");
const { hasManagerAccess } = require("../utils/permissions");
const familyFeudManager = require("../middlewares/familyFeudManager");

test("Social Media network members share manager operations", () => {
  assert.equal(hasManagerAccess({ role: "DEFAULT", roles: ["SOCIAL_MEDIA"] }), true);
  assert.equal(hasManagerAccess({ role: "MANAGER", roles: [] }), true);
  assert.equal(hasManagerAccess({ role: "DEFAULT", roles: ["MEMBER"] }), false);
});

test("Family Feud creation is separate from Social Media permissions", () => {
  let allowed = false;
  const response = { statusCode: 200, payload: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } };
  familyFeudManager({ user: { role: "DEFAULT", roles: ["SOCIAL_MEDIA"] } }, response, () => { allowed = true; });
  assert.equal(allowed, false);
  assert.equal(response.statusCode, 403);

  familyFeudManager({ user: { role: "MANAGER", roles: [] } }, response, () => { allowed = true; });
  assert.equal(allowed, true);
});
