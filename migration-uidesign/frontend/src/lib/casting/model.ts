import type { DraftState, Hero, Match } from "@/lib/api/types";

export type BroadcastView = "waiting" | "draft" | "map-pool" | "hero-bans" | "winner" | "overwatch";
export const BROADCAST_VIEWS: Array<{ key: BroadcastView; label: string }> = [
  { key: "waiting", label: "Waiting for captains" },
  { key: "map-pool", label: "Map pool" },
  { key: "draft", label: "Draft table" },
  { key: "hero-bans", label: "Hero bans" },
  { key: "overwatch", label: "Overwatch" },
  { key: "winner", label: "Winner cards" },
];

export function phaseView(phase: string): BroadcastView {
  if (phase === "PLAYING") return "hero-bans";
  if (phase === "ENDMAP" || phase === "FINISHED") return "winner";
  if (phase === "STARTING") return "waiting";
  return "draft";
}

export function currentMapNumber(draft: DraftState): number {
  const last = Math.max(0, ...draft.actions.filter(a => a.action === "PICK").map(a => a.gameNumber));
  // gameNumber counts completed maps; ENDMAP still displays the map just played.
  return Math.max(1, last, draft.match.gameNumber + (draft.phase === "ENDMAP" || draft.phase === "FINISHED" ? 0 : 1));
}

export interface LogMapIdentity { matchId: number; gameNumber: number; mapName: string }
export function belongsToCurrentMap(draft: DraftState, event: LogMapIdentity): boolean {
  const normalize = (value: string) => value.normalize("NFC").trim().replace(/[’‘]/g, "'").toLowerCase();
  const map = draft.allMaps?.find(m => m.id === draft.currentMapId);
  return event.matchId === draft.matchId && event.gameNumber === currentMapNumber(draft)
    && Boolean(map && normalize(event.mapName) === normalize(map.description));
}

export function automaticView(draft: DraftState, gameStart?: LogMapIdentity | null): BroadcastView {
  if (draft.phase === "PLAYING" && gameStart && belongsToCurrentMap(draft,gameStart)) return "overwatch";
  if (draft.phase === "STARTING" && draft.match.gameNumber > 0) return "winner";
  return phaseView(draft.phase);
}

export function mapPoolIds(match: Match): number[] {
  return Array.from(new Set(Object.values(match.mapsAllowedByRound ?? {}).flat().filter(id => Number.isInteger(id) && id > 0)));
}

export interface HeroVideo { url: string; objectPosition?: string }
export type HeroVideoManifest = Record<string, HeroVideo | string>;

export async function loadHeroVideos(signal?: AbortSignal): Promise<HeroVideoManifest> {
  const url = process.env.NEXT_PUBLIC_HERO_VIDEO_MANIFEST_URL || "/casting/hero-videos.json";
  const response = await fetch(url, { signal, cache: "no-cache" });
  if (!response.ok) throw new Error("Unable to load the hero video library.");
  const value: unknown = await response.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid hero video manifest.");
  return value as HeroVideoManifest;
}

export function heroVideo(manifest: HeroVideoManifest, hero: Hero): HeroVideo | null {
  const entry = manifest[String(hero.id)] ?? manifest[hero.name.toLowerCase()] ?? manifest[hero.name];
  const value = typeof entry === "string" ? { url: entry } : entry;
  if (!value || typeof value.url !== "string") return null;
  try {
    const url = new URL(value.url);
    if (url.protocol !== "https:") return null;
    return { url: url.href, objectPosition: typeof value.objectPosition === "string" ? value.objectPosition : "50% 50%" };
  } catch { return null; }
}

export function canCast(roles: string[]): boolean {
  return roles.some(role => ["CASTER", "SOCIAL_MEDIA", "ADMIN"].includes(role));
}
