import { apiRequest } from "@/lib/api/client";

export type WrappedAssetKey =
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

export interface WrappedSnapshot {
  generatedAt: string;
  tournament: { id: number; name: string; startDate: string };
  overview: {
    weeks: number;
    games: number;
    players: number;
    teams: Array<{ id: number; name: string; logo: string | null }>;
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
    mostBannedHero: { name: string; image: string | null; count: number } | null;
    mostPickedMap: { name: string; image: string | null; count: number } | null;
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
