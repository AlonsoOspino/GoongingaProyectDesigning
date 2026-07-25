import { apiRequest } from "@/lib/api/client";

export type WrappedAssetKey =
  | "damagePer10"
  | "healingPer10"
  | "killsPer10"
  | "assistsPer10"
  | "mitigationPer10"
  | "lowestDeathsPer10"
  | "damageTotal"
  | "healingTotal"
  | "killsTotal"
  | "assistsTotal"
  | "mitigationTotal"
  | "performanceKda"
  | "kills"
  | "healing"
  | "assists"
  | "lowestDeaths"
  | "mitigation"
  | "kda"
  | "totalDamage"
  | "totalHealing"
  | "mostBannedHero"
  | "mostPickedMap";

export type WrappedAssets = Partial<Record<WrappedAssetKey, string>>;

export interface WrappedPlayerLeader {
  player: string;
  profilePic: string | null;
  team: string | null;
  value: number;
  gameNumber: number;
}

export interface WrappedMapRanking {
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
  };
  averagesPer10: {
    damage: WrappedPlayerLeader | null;
    healing: WrappedPlayerLeader | null;
    kills: WrappedPlayerLeader | null;
    assists: WrappedPlayerLeader | null;
    mitigation: WrappedPlayerLeader | null;
    lowestDeaths: WrappedPlayerLeader | null;
  };
  totals: {
    damage: WrappedPlayerLeader | null;
    healing: WrappedPlayerLeader | null;
    kills: WrappedPlayerLeader | null;
    assists: WrappedPlayerLeader | null;
    mitigation: WrappedPlayerLeader | null;
  };
  performance: {
    kda: WrappedPlayerLeader | null;
  };
  leaders: {
    kills: WrappedPlayerLeader | null;
    healing: WrappedPlayerLeader | null;
    assists: WrappedPlayerLeader | null;
    lowestDeaths: WrappedPlayerLeader | null;
    mitigation: WrappedPlayerLeader | null;
    kda: WrappedPlayerLeader | null;
    totalDamage: WrappedPlayerLeader | null;
    totalHealing: WrappedPlayerLeader | null;
  };
  draft: {
    mostBannedHero: WrappedMapRanking | null;
    mostPickedMap: WrappedMapRanking | null;
    leastPlayedMaps: WrappedMapRanking[];
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

export async function getGoongingaWrapped() {
  return apiRequest<GoongingaWrapped>("/wrapped", { cache: "no-store" });
}

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
