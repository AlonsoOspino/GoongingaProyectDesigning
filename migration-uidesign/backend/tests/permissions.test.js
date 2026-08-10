const test = require("node:test");
const assert = require("node:assert/strict");
const { hasManagerAccess } = require("../utils/permissions");

test("Social Media network members share manager operations", () => {
  assert.equal(hasManagerAccess({ role: "DEFAULT", roles: ["SOCIAL_MEDIA"] }), true);
  assert.equal(hasManagerAccess({ role: "MANAGER", roles: [] }), true);
  assert.equal(hasManagerAccess({ role: "DEFAULT", roles: ["MEMBER"] }), false);
});
