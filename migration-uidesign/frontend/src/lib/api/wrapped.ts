import { apiRequest } from "@/lib/api/client";

export type WrappedAssetKey =
  | "averageKills"
  | "averageHealing"
  | "averageDamage"
  | "averageMitigation"
  | "averageAssists"
  | "averageSurvival"
  | "totalDamage"
  | "totalHealing"
  | "totalMitigation"
  | "bestKd"
  | "mostPickedMap"
  | "leastPickedMap";

export type WrappedAssetUrls = Partial<Record<WrappedAssetKey, string>>;
export type WrappedAssetFlips = Partial<Record<WrappedAssetKey, boolean>>;
export type WrappedVideoUrls = Partial<Record<WrappedAssetKey, string>>;
export type WrappedVideoPosition = { x: number; y: number };
export type WrappedVideoPositions = Partial<Record<WrappedAssetKey, WrappedVideoPosition>>;
export type WrappedStoryAudio = Partial<Record<WrappedAssetKey, string[]>>;
export type WrappedSoundtrack = {
  intro?: string;
  general?: string;
};

export type WrappedAssets = {
  images: WrappedAssetUrls;
  flipped: WrappedAssetFlips;
  videos: WrappedVideoUrls;
  videoPositions: WrappedVideoPositions;
  storyAudios: WrappedStoryAudio;
  soundtrack: WrappedSoundtrack;
};

type LegacyWrappedAssets = WrappedAssetUrls;

const wrappedAssetKeys = new Set<WrappedAssetKey>([
  "averageKills",
  "averageHealing",
  "averageDamage",
  "averageMitigation",
  "averageAssists",
  "averageSurvival",
  "totalDamage",
  "totalHealing",
  "totalMitigation",
  "bestKd",
  "mostPickedMap",
  "leastPickedMap",
]);

/** Supports Wrapped records created before artwork preferences were introduced. */
export function resolveWrappedAssets(value: unknown): WrappedAssets {
  const empty: WrappedAssets = { images: {}, flipped: {}, videos: {}, videoPositions: {}, storyAudios: {}, soundtrack: {} };
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;

  const raw = value as Record<string, unknown>;
  const imageSource = raw.images && typeof raw.images === "object" && !Array.isArray(raw.images)
    ? raw.images as Record<string, unknown>
    : raw;
  const flipSource = raw.flipped && typeof raw.flipped === "object" && !Array.isArray(raw.flipped)
    ? raw.flipped as Record<string, unknown>
    : {};
  const videoSource = raw.videos && typeof raw.videos === "object" && !Array.isArray(raw.videos)
    ? raw.videos as Record<string, unknown>
    : {};
  const videoPositionSource = raw.videoPositions && typeof raw.videoPositions === "object" && !Array.isArray(raw.videoPositions)
    ? raw.videoPositions as Record<string, unknown>
    : {};
  const storyAudioSource = raw.storyAudios && typeof raw.storyAudios === "object" && !Array.isArray(raw.storyAudios)
    ? raw.storyAudios as Record<string, unknown>
    : {};
  const soundtrackSource = raw.soundtrack && typeof raw.soundtrack === "object" && !Array.isArray(raw.soundtrack)
    ? raw.soundtrack as Record<string, unknown>
    : {};

  const images = Object.fromEntries(
    Object.entries(imageSource).filter(([key, image]) => wrappedAssetKeys.has(key as WrappedAssetKey) && typeof image === "string" && image.trim())
  ) as WrappedAssetUrls;
  const flipped = Object.fromEntries(
    Object.entries(flipSource).filter(([key, enabled]) => wrappedAssetKeys.has(key as WrappedAssetKey) && enabled === true)
  ) as WrappedAssetFlips;
  const videos = Object.fromEntries(
    Object.entries(videoSource).filter(([key, video]) => wrappedAssetKeys.has(key as WrappedAssetKey) && typeof video === "string" && video.trim())
  ) as WrappedVideoUrls;
  const videoPositions = Object.fromEntries(
    Object.entries(videoPositionSource)
      .filter(([key, position]) => wrappedAssetKeys.has(key as WrappedAssetKey) && position && typeof position === "object" && !Array.isArray(position))
      .map(([key, position]) => {
        const rawPosition = position as Record<string, unknown>;
        const x = typeof rawPosition.x === "number" && Number.isFinite(rawPosition.x) ? Math.min(100, Math.max(0, rawPosition.x)) : 50;
        const y = typeof rawPosition.y === "number" && Number.isFinite(rawPosition.y) ? Math.min(100, Math.max(0, rawPosition.y)) : 50;
        return [key, { x, y }];
      })
  ) as WrappedVideoPositions;
  const storyAudios = Object.fromEntries(
    Object.entries(storyAudioSource)
      .filter(([key, sources]) => wrappedAssetKeys.has(key as WrappedAssetKey) && Array.isArray(sources))
      .map(([key, sources]) => [key, (sources as unknown[]).filter((source): source is string => typeof source === "string" && Boolean(source.trim())).slice(0, 3)])
      .filter(([, sources]) => sources.length)
  ) as WrappedStoryAudio;
  const soundtrack = Object.fromEntries(
    Object.entries(soundtrackSource).filter(([key, source]) => (key === "intro" || key === "general") && typeof source === "string" && source.trim())
  ) as WrappedSoundtrack;

  return { images, flipped, videos, videoPositions, storyAudios, soundtrack };
}

export interface WrappedPlayerLeader {
  userId: number;
  player: string;
  profilePic: string | null;
  team: string | null;
  /** Added to refreshed snapshots; older frozen records may not include it. */
  mapsPlayed?: number;
  value: number;
}

export interface WrappedMapRanking {
  mapId: number;
  name: string;
  image: string | null;
  count: number;
}

export interface WrappedSnapshot {
  generatedAt: string;
  tournament: { id: number; name: string; startDate: string };
  overview: {
    weeks: number;
    games: number;
    players: number;
    teams: Array<{ id: number; name: string; logo: string | null }>;
    totals: { damage: number; healing: number; mitigation: number };
  };
  averagesPer10: {
    kills: WrappedPlayerLeader | null;
    healing: WrappedPlayerLeader | null;
    damage: WrappedPlayerLeader | null;
    mitigation: WrappedPlayerLeader | null;
    assists: WrappedPlayerLeader | null;
    lowestDeaths: WrappedPlayerLeader | null;
  };
  totals: {
    damage: WrappedPlayerLeader | null;
    healing: WrappedPlayerLeader | null;
    mitigation: WrappedPlayerLeader | null;
  };
  performance: {
    kd: WrappedPlayerLeader | null;
  };
  maps: {
    mostPicked: WrappedMapRanking | null;
    leastPicked: WrappedMapRanking | null;
  };
}

export interface GoongingaWrapped {
  id: number;
  tournamentId: number;
  snapshot: WrappedSnapshot;
  assets: WrappedAssets | LegacyWrappedAssets;
  generatedAt: string;
  updatedAt: string;
}

type LegacyWrappedSnapshot = {
  performance?: { kda?: WrappedPlayerLeader | null };
  draft?: {
    mostPickedMap?: WrappedMapRanking | null;
    leastPlayedMaps?: WrappedMapRanking[];
  };
};

/**
 * Allows an already-frozen pre-redesign snapshot to stay viewable until a
 * manager refreshes it into the new shape. No live stat query is performed.
 */
export function resolveWrappedSnapshot(snapshot: WrappedSnapshot) {
  const legacy = snapshot as WrappedSnapshot & LegacyWrappedSnapshot;
  return {
    overview: {
      ...snapshot.overview,
      totals: snapshot.overview?.totals || { damage: 0, healing: 0, mitigation: 0 },
    },
    averagesPer10: snapshot.averagesPer10 || {
      kills: null,
      healing: null,
      damage: null,
      mitigation: null,
      assists: null,
      lowestDeaths: null,
    },
    totals: snapshot.totals || { damage: null, healing: null, mitigation: null },
    performance: { kd: snapshot.performance?.kd || legacy.performance?.kda || null },
    maps: snapshot.maps || {
      mostPicked: legacy.draft?.mostPickedMap || null,
      leastPicked: legacy.draft?.leastPlayedMaps?.[0] || null,
    },
  };
}

export async function getGoongingaWrapped() {
  return apiRequest<GoongingaWrapped>("/wrapped", { cache: "no-store" });
}

export async function getManageGoongingaWrapped(token: string) {
  return apiRequest<GoongingaWrapped>("/wrapped/manage", { token, cache: "no-store" });
}

export async function freezeGoongingaWrapped(token: string) {
  return apiRequest<GoongingaWrapped>("/wrapped/manage/snapshot", { method: "POST", token });
}

export async function updateManageGoongingaWrappedAssets(token: string, assets: WrappedAssets) {
  return apiRequest<GoongingaWrapped>("/wrapped/manage/assets", {
    method: "PUT",
    token,
    body: { assets },
  });
}

// Legacy admin API helpers remain exported for backwards compatibility.
export async function getAdminGoongingaWrapped(token: string) {
  return apiRequest<GoongingaWrapped>("/wrapped/admin", { token, cache: "no-store" });
}

export async function adminGenerateGoongingaWrapped(token: string) {
  return apiRequest<GoongingaWrapped>("/wrapped/admin/generate", { method: "POST", token });
}

export async function adminUpdateGoongingaWrappedAssets(token: string, assets: WrappedAssets) {
  return apiRequest<GoongingaWrapped>("/wrapped/admin/assets", {
    method: "PUT",
    token,
    body: { assets },
  });
}
