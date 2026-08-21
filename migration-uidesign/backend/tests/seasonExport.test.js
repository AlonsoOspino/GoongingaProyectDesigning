const test = require("node:test");
const assert = require("node:assert/strict");
const { __testables } = require("../scripts/export-season");

test("season export reconciliation requires the exact participant set", () => {
  const archive = {
    teams: [
      { players: [{ memberId: 8 }, { memberId: 3 }] },
      { players: [{ memberId: 5 }] },
    ],
  };
  assert.deepEqual(
    __testables.reconcileMemberIds(archive, [{ memberId: 3 }, { memberId: 5 }, { memberId: 8 }]),
    { matches: true, exported: [3, 5, 8], stored: [3, 5, 8] }
  );
  assert.equal(
    __testables.reconcileMemberIds(archive, [{ memberId: 3 }, { memberId: 5 }, { memberId: 8 }, { memberId: 13 }]).matches,
    false
  );
});

test("season export arguments keep archive and purge modes explicit", () => {
  const options = __testables.parseArguments(["--season=9", "--tournament=42", "--purge"]);
  assert.equal(options.season, 9);
  assert.equal(options.tournamentId, 42);
  assert.equal(options.purge, true);
  assert.equal(options.purgeOnly, false);
  assert.match(options.outputPath, /season-9\.json$/);
});
