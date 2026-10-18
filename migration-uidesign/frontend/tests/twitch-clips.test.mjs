import assert from "node:assert/strict";
import test from "node:test";
import { createTwitchClipFeed } from "../src/lib/twitch/clips.ts";

function fixture() {
  let time = 100000;
  let fail = false;
  let rejectToken = false;
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("oauth2/token")) return Response.json({ access_token: "test-token", expires_in: 3600 });
    if (rejectToken) { rejectToken = false; return new Response(null, { status: 401 }); }
    if (fail) return new Response(null, { status: 503 });
    if (url.includes("users?")) return Response.json({ data: [{ id: "123" }] });
    return Response.json({ data: Array.from({ length: 10 }, (_, index) => ({
      id: `clip-${index}`, broadcaster_id: "123", title: `Clip ${index}`,
      view_count: 1000 - index, duration: 30, thumbnail_url: "https://example.com/clip.jpg",
    })) });
  };
  const getClips = createTwitchClipFeed({
    clientId: "test-client", clientSecret: "test-secret", channel: "overtimeggl", request, now: () => time,
  });
  return { getClips, calls, advance: (ms) => { time += ms; }, fail: () => { fail = true; }, rejectToken: () => { rejectToken = true; } };
}

test("concurrent visitors share one request for the channel's all-time top ten", async () => {
  const feed = fixture();
  const [a, b] = await Promise.all([feed.getClips(), feed.getClips()]);
  assert.equal(a.clips.length, 10);
  assert.deepEqual(a, b);
  assert.equal(feed.calls.length, 3);
  assert.ok(feed.calls[2].url.endsWith("clips?broadcaster_id=123&first=10"));
  assert.equal("access_token" in a, false);
  assert.equal(JSON.stringify(a).includes("test-secret"), false);
});

test("keeps the list for 15 minutes then refreshes using the existing token and channel", async () => {
  const feed = fixture();
  await feed.getClips();
  feed.advance(14 * 60 * 1000);
  await feed.getClips();
  assert.equal(feed.calls.length, 3);
  feed.advance(60 * 1000);
  await feed.getClips();
  assert.equal(feed.calls.length, 4);
  assert.ok(feed.calls[3].url.includes("clips?"));
});

test("keeps recent clips when Twitch fails and backs off before retrying", async () => {
  const feed = fixture();
  const original = await feed.getClips();
  feed.advance(15 * 60 * 1000);
  feed.fail();
  const stale = await feed.getClips();
  assert.equal(stale.stale, true);
  assert.deepEqual(stale.clips, original.clips);
  await feed.getClips();
  assert.equal(feed.calls.length, 4);
  feed.advance(24 * 60 * 60 * 1000);
  await assert.rejects(feed.getClips(), /unavailable/);
});

test("renews a revoked token and retries once", async () => {
  const feed = fixture();
  await feed.getClips();
  feed.advance(15 * 60 * 1000);
  feed.rejectToken();
  assert.equal((await feed.getClips()).clips.length, 10);
  assert.equal(feed.calls.filter(({ url }) => url.includes("oauth2/token")).length, 2);
});

test("missing credentials never trigger an upstream request", async () => {
  const getClips = createTwitchClipFeed({ channel: "overtimeggl", request: () => { throw new Error("Must not request"); } });
  await assert.rejects(getClips(), /not configured/);
});

test("initial upstream failure is unavailable and repeated visits respect the backoff", async () => {
  const feed = fixture();
  feed.fail();
  await assert.rejects(feed.getClips(), /unavailable/);
  await assert.rejects(feed.getClips(), /unavailable/);
  assert.equal(feed.calls.length, 2);
});
