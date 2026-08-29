const test = require("node:test");
const assert = require("node:assert/strict");
const developerMiddleware = require("../middlewares/developer");

const callMiddleware = (user) => {
  const req = user === undefined ? {} : { user };
  const captured = { status: null, body: null, nextCalled: false };

  const res = {
    status(code) {
      captured.status = code;
      return this;
    },
    json(payload) {
      captured.body = payload;
      return this;
    },
  };

  developerMiddleware(req, res, () => {
    captured.nextCalled = true;
  });

  return captured;
};

test("an anonymous request is refused before any role check", () => {
  const result = callMiddleware(undefined);
  assert.equal(result.status, 401);
  assert.equal(result.nextCalled, false);
});

test("admins reach developer tooling", () => {
  const result = callMiddleware({ roles: ["MEMBER", "ADMIN"] });
  assert.equal(result.nextCalled, true);
  assert.equal(result.status, null);
});

test("developers reach developer tooling, which is the whole point", () => {
  const result = callMiddleware({ roles: ["MEMBER", "DEVELOPER"] });
  assert.equal(result.nextCalled, true);
});

test("a manager or social media account cannot spin up sandbox matches", () => {
  const result = callMiddleware({ roles: ["MEMBER", "SOCIAL_MEDIA"] });
  assert.equal(result.status, 403);
  assert.equal(result.nextCalled, false);
});

test("a plain member is refused", () => {
  const result = callMiddleware({ roles: ["MEMBER"] });
  assert.equal(result.status, 403);
  assert.equal(result.nextCalled, false);
});

test("a malformed roles field is refused rather than crashing", () => {
  for (const roles of [undefined, null, "ADMIN", 7, {}]) {
    const result = callMiddleware({ roles });
    assert.equal(result.status, 403, `expected ${JSON.stringify(roles)} to be refused`);
    assert.equal(result.nextCalled, false);
  }
});

test("the sandbox is on by default and only DEV_SANDBOX_ENABLED=false turns it off", () => {
  const { __testables } = require("../controllers/devSandbox");
  const original = process.env.DEV_SANDBOX_ENABLED;

  try {
    delete process.env.DEV_SANDBOX_ENABLED;
    assert.equal(__testables.isEnabled(), true, "default should be enabled");

    process.env.DEV_SANDBOX_ENABLED = "true";
    assert.equal(__testables.isEnabled(), true);

    process.env.DEV_SANDBOX_ENABLED = "false";
    assert.equal(__testables.isEnabled(), false);

    process.env.DEV_SANDBOX_ENABLED = "FALSE";
    assert.equal(__testables.isEnabled(), false, "the switch is case insensitive");

    process.env.DEV_SANDBOX_ENABLED = "no";
    assert.equal(__testables.isEnabled(), true, "only the word false disables it");
  } finally {
    if (original === undefined) delete process.env.DEV_SANDBOX_ENABLED;
    else process.env.DEV_SANDBOX_ENABLED = original;
  }
});
