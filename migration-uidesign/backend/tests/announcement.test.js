const test = require("node:test");
const assert = require("node:assert/strict");
const { getTemplate, normalizeCountdown } = require("../announcements/registry");

test("unknown announcement types are rejected", () => {
  assert.throws(() => getTemplate("JEOPARDY"), /Tournament, Minigame or Custom/);
  assert.throws(() => getTemplate(""), /Tournament, Minigame or Custom/);
  assert.throws(() => getTemplate(undefined), /Tournament, Minigame or Custom/);
});

test("known announcement types resolve case-insensitively", () => {
  assert.equal(getTemplate(" tournament ").type, "TOURNAMENT");
  assert.equal(getTemplate("MINIGAME").type, "MINIGAME");
  assert.equal(getTemplate("custom").type, "CUSTOM");
});

test("content must be a plain object", () => {
  for (const type of ["TOURNAMENT", "MINIGAME", "CUSTOM"]) {
    const { validateContent } = getTemplate(type);
    assert.throws(() => validateContent(null), /must be an object/);
    assert.throws(() => validateContent(["nope"]), /must be an object/);
    assert.throws(() => validateContent("nope"), /must be an object/);
  }
});

test("tournament accepts automatic and pinned matches", () => {
  const { validateContent } = getTemplate("TOURNAMENT");
  assert.deepEqual(validateContent({}), { matchId: null, headline: "" });
  assert.deepEqual(validateContent({ matchId: null }), { matchId: null, headline: "" });
  assert.deepEqual(validateContent({ matchId: 12, headline: "  Grand final  " }), { matchId: 12, headline: "Grand final" });
});

test("tournament rejects non-positive or fractional match ids", () => {
  const { validateContent } = getTemplate("TOURNAMENT");
  assert.throws(() => validateContent({ matchId: 0 }), /valid match/);
  assert.throws(() => validateContent({ matchId: -3 }), /valid match/);
  assert.throws(() => validateContent({ matchId: 1.5 }), /valid match/);
  assert.throws(() => validateContent({ matchId: "abc" }), /valid match/);
});

test("minigame requires a usable slug", () => {
  const { validateContent } = getTemplate("MINIGAME");
  assert.deepEqual(validateContent({ minigameSlug: " ggl-jeopardy " }), { minigameSlug: "ggl-jeopardy", ctaLabel: "" });
  assert.deepEqual(validateContent({ minigameSlug: "trivia", ctaLabel: "Play now" }), { minigameSlug: "trivia", ctaLabel: "Play now" });
  assert.throws(() => validateContent({}), /which minigame/);
  assert.throws(() => validateContent({ minigameSlug: "   " }), /which minigame/);
  assert.throws(() => validateContent({ minigameSlug: "../admin" }), /not valid/);
  assert.throws(() => validateContent({ minigameSlug: "has space" }), /not valid/);
});

test("custom requires a headline and keeps the optional fields", () => {
  const { validateContent } = getTemplate("CUSTOM");
  assert.deepEqual(
    validateContent({ eyebrow: " Event ", headline: " Game night ", body: " Join us ", ctaLabel: " Open ", ctaHref: "/schedule" }),
    { eyebrow: "Event", headline: "Game night", body: "Join us", imageUrl: "", ctaLabel: "Open", ctaHref: "/schedule" },
  );
  assert.throws(() => validateContent({ body: "no headline" }), /Headline is required/);
});

test("custom links reject anything that is not an internal path or http(s)", () => {
  const { validateContent } = getTemplate("CUSTOM");
  const base = { headline: "Game night" };
  assert.equal(validateContent({ ...base, ctaHref: "https://twitch.tv/x" }).ctaHref, "https://twitch.tv/x");
  assert.equal(validateContent({ ...base, ctaHref: "/minigames" }).ctaHref, "/minigames");
  assert.equal(validateContent({ ...base, ctaHref: "" }).ctaHref, "");
  assert.throws(() => validateContent({ ...base, ctaHref: "javascript:alert(1)" }), /internal path or an http/);
  assert.throws(() => validateContent({ ...base, ctaHref: "//evil.example" }), /internal path or an http/);
  assert.throws(() => validateContent({ ...base, imageUrl: "javascript:alert(1)" }), /internal path or an http/);
  assert.throws(() => validateContent({ ...base, ctaHref: "/\\evil.example" }), /internal path or an http/);
  assert.throws(() => validateContent({ ...base, ctaHref: "/\\/evil.example" }), /internal path or an http/);
  assert.throws(() => validateContent({ ...base, ctaHref: "/\t/evil.example" }), /internal path or an http/);
  assert.equal(validateContent({ ...base, ctaHref: "/schedule/12?tab=maps#top" }).ctaHref, "/schedule/12?tab=maps#top");
});

test("countdown normalization accepts ISO input and rejects the rest", () => {
  assert.equal(normalizeCountdown(null), null);
  assert.equal(normalizeCountdown(undefined), null);
  assert.equal(normalizeCountdown(""), null);
  assert.equal(normalizeCountdown("not-a-date"), null);
  assert.equal(normalizeCountdown("2026-08-20T18:30:00-05:00").toISOString(), "2026-08-20T23:30:00.000Z");
});

test("every registered template implements the full contract", () => {
  for (const type of ["TOURNAMENT", "MINIGAME", "CUSTOM"]) {
    const template = getTemplate(type);
    assert.equal(typeof template.validateContent, "function", `${type} needs validateContent`);
    assert.equal(typeof template.resolvePayload, "function", `${type} needs resolvePayload`);
  }
});

test("the custom template resolves no live data", async () => {
  assert.equal(await getTemplate("CUSTOM").resolvePayload({}), null);
});
