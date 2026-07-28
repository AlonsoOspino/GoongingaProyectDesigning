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

export type WrappedAssets = Partial<Record<WrappedAssetKey, string>>;

export interface WrappedPlayerLeader {
  userId: number;
  player: string;
  profilePic: string | null;
  team: string | null;
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
  assets: WrappedAssets;
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
