import type { TwitchClip, TwitchClipResponse } from "./types";

const CACHE_TTL = 15 * 60 * 1000;
const STALE_TTL = 24 * 60 * 60 * 1000;
const RETRY_DELAY = 60 * 1000;

interface FeedOptions {
  clientId?: string;
  clientSecret?: string;
  channel: string;
  request?: typeof fetch;
  now?: () => number;
}

interface HelixClip {
  id: string;
  broadcaster_id: string;
  title: string;
  view_count: number;
  duration: number;
  thumbnail_url: string;
}

// Keep tokens and API calls on the server; visitors share a cached top ten.
export function createTwitchClipFeed({
  clientId, clientSecret, channel, request = fetch, now = Date.now,
}: FeedOptions) {
  let token: { value: string; expiresAt: number } | undefined;
  let broadcasterId: string | undefined;
  let cached: { clips: TwitchClip[]; fetchedAt: number } | undefined;
  let inFlight: Promise<TwitchClipResponse> | undefined;
  let retryAt = 0;

  async function getToken() {
    if (token && token.expiresAt > now()) return token.value;
    const response = await request("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: clientId!, client_secret: clientSecret!, grant_type: "client_credentials",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Twitch authentication unavailable");
    const body = await response.json() as { access_token?: string; expires_in?: number };
    if (!body.access_token || !body.expires_in) throw new Error("Invalid Twitch token response");
    token = { value: body.access_token, expiresAt: now() + Math.max(0, body.expires_in - 60) * 1000 };
    return token.value;
  }

  async function helix<T>(path: string): Promise<T[]> {
    const send = async () => request(`https://api.twitch.tv/helix/${path}`, {
      headers: { "Client-Id": clientId!, Authorization: `Bearer ${await getToken()}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    let response = await send();
    if (response.status === 401) {
      token = undefined;
      response = await send();
    }
    if (!response.ok) throw new Error("Twitch clips unavailable");
    const body = await response.json() as { data?: T[] };
    if (!Array.isArray(body.data)) throw new Error("Invalid Twitch API response");
    return body.data;
  }

  async function refresh(): Promise<TwitchClipResponse> {
    try {
      if (!broadcasterId) {
        const users = await helix<{ id: string }>(`users?login=${encodeURIComponent(channel)}`);
        if (!users[0]?.id) throw new Error("Twitch channel unavailable");
        broadcasterId = users[0].id;
      }
      // Twitch sorts this endpoint by views; no dates means the all-time top.
      const results = await helix<HelixClip>(`clips?broadcaster_id=${encodeURIComponent(broadcasterId)}&first=10`);
      const clips = results
        .filter((clip) => clip.broadcaster_id === broadcasterId && /^[\w-]+$/.test(clip.id))
        .sort((a, b) => b.view_count - a.view_count)
        .slice(0, 10)
        .map((clip) => ({
          id: clip.id, title: clip.title, views: clip.view_count,
          duration: Number.isFinite(clip.duration) ? clip.duration : 30,
          thumbnail: clip.thumbnail_url,
        }));
      cached = { clips, fetchedAt: now() };
      retryAt = 0;
      return { clips };
    } catch {
      retryAt = now() + RETRY_DELAY;
      if (cached && now() - cached.fetchedAt < STALE_TTL) return { clips: cached.clips, stale: true };
      throw new Error("Twitch clips unavailable");
    }
  }

  return async function getClips(): Promise<TwitchClipResponse> {
    if (!clientId || !clientSecret) throw new Error("Twitch credentials are not configured");
    if (cached && now() - cached.fetchedAt < CACHE_TTL) return { clips: cached.clips };
    if (now() < retryAt) {
      if (cached && now() - cached.fetchedAt < STALE_TTL) return { clips: cached.clips, stale: true };
      throw new Error("Twitch clips unavailable");
    }
    if (!inFlight) inFlight = refresh().finally(() => { inFlight = undefined; });
    return inFlight;
  };
}
