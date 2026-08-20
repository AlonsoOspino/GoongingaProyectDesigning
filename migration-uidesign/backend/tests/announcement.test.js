const test = require("node:test");
const assert = require("node:assert/strict");
const { getTemplate, normalizeCountdown } = require("../announcements/registry");

test("unknown announcement types are rejected", () => {
  assert.throws(() => getTemplate("JEOPARDY"), /Tournament, Minigame, Custom or Form/);
  assert.throws(() => getTemplate(""), /Tournament, Minigame, Custom or Form/);
  assert.throws(() => getTemplate(undefined), /Tournament, Minigame, Custom or Form/);
});

test("known announcement types resolve case-insensitively", () => {
  assert.equal(getTemplate(" tournament ").type, "TOURNAMENT");
  assert.equal(getTemplate("MINIGAME").type, "MINIGAME");
  assert.equal(getTemplate("custom").type, "CUSTOM");
  assert.equal(getTemplate("form").type, "FORM");
});

test("content must be a plain object", () => {
  for (const type of ["TOURNAMENT", "MINIGAME", "CUSTOM", "FORM"]) {
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

test("form validates content and rejects browser-normalized external routes", () => {
  const { validateContent } = getTemplate("FORM");
  assert.deepEqual(validateContent({ headline: " Sign up ", body: " Players only ", formUrl: "/forms/season-9" }), {
    headline: "Sign up", body: "Players only", formUrl: "/forms/season-9", ctaLabel: "",
  });
  assert.throws(() => validateContent({ headline: "x", formUrl: "/\\evil.host" }), /internal path or an http/);
  for (const separator of ["\t", "\r", "\n"]) {
    assert.throws(() => validateContent({ headline: "x", formUrl: `/${separator}/evil.host` }), /internal path or an http/);
  }
  assert.throws(() => validateContent({ headline: "x" }), /Form URL is required/);
});

test("countdown normalization accepts ISO input and rejects the rest", () => {
  assert.equal(normalizeCountdown(null), null);
  assert.equal(normalizeCountdown(undefined), null);
  assert.equal(normalizeCountdown(""), null);
  assert.equal(normalizeCountdown("not-a-date"), null);
  assert.equal(normalizeCountdown("2026-08-20T18:30:00-05:00").toISOString(), "2026-08-20T23:30:00.000Z");
});

test("every registered template implements the full contract", () => {
  for (const type of ["TOURNAMENT", "MINIGAME", "CUSTOM", "FORM"]) {
    const template = getTemplate(type);
    assert.equal(typeof template.validateContent, "function", `${type} needs validateContent`);
    assert.equal(typeof template.resolvePayload, "function", `${type} needs resolvePayload`);
  }
});

test("the custom template resolves no live data", async () => {
  assert.equal(await getTemplate("CUSTOM").resolvePayload({}), null);
});

test("the form template resolves no live data", async () => {
  assert.equal(await getTemplate("FORM").resolvePayload({}), null);
});

test("a pinned match only announces itself while it is scheduled or live", () => {
  const { pinnedState } = getTemplate("TOURNAMENT").__testables;
  assert.equal(pinnedState("ACTIVE"), "LIVE");
  assert.equal(pinnedState("SCHEDULED"), "UPCOMING");
  assert.equal(pinnedState("FINISHED"), "IDLE");
});

test("tournament falls back to the latest result and then idle", async () => {
  const calls = [];
  const finished = { id: 8, status: "FINISHED" };
  const client = { match: {
    findFirst: async (query) => { calls.push(query.where.status); return query.where.status === "FINISHED" ? finished : null; },
  } };
  assert.deepEqual(await getTemplate("TOURNAMENT").resolvePayload({}, client), { state: "RESULT", match: finished });
  assert.deepEqual(calls, ["ACTIVE", "SCHEDULED", "FINISHED"]);
  const empty = { match: { findFirst: async () => null } };
  assert.deepEqual(await getTemplate("TOURNAMENT").resolvePayload({}, empty), { state: "IDLE", match: null });
});

test("tournament prefers the latest dated result over a null-dated match", async () => {
  const matches = [
    { id: 12, status: "FINISHED", startDate: null },
    { id: 10, status: "FINISHED", startDate: new Date("2026-08-18T12:00:00.000Z") },
    { id: 11, status: "FINISHED", startDate: new Date("2026-08-19T12:00:00.000Z") },
  ];
  const client = {
    match: {
      findFirst: async (query) => {
        if (query.where.status !== "FINISHED") return null;
        assert.deepEqual(query.orderBy, [
          { startDate: { sort: "desc", nulls: "last" } },
          { id: "desc" },
        ]);
        return matches
          .filter((match) => match.startDate !== null)
          .sort((left, right) => right.startDate - left.startDate)[0];
      },
    },
  };

  assert.deepEqual(await getTemplate("TOURNAMENT").resolvePayload({}, client), {
    state: "RESULT",
    match: matches[2],
  });
});
