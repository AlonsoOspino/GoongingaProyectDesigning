import { apiRequest } from "@/lib/api/client";
import type { PlayerStat } from "@/lib/api/types";

export interface PlayerStatPayload {
  userId: number;
  matchId: number;
  gameNumber: number;
  damage: number;
  healing: number;
  mitigation: number;
  kills: number;
  assists: number;
  deaths: number;
  gameDuration: number | string;
  mapType: "CONTROL" | "HYBRID" | "PAYLOAD" | "PUSH" | "FLASHPOINT";
  role: "TANK" | "DPS" | "SUPPORT";
}

export async function getAllPlayerStats(token: string) {
  return apiRequest<PlayerStat[]>("/playerStat", { token });
}

export async function getPublicPlayerStats() {
  return apiRequest<PlayerStat[]>("/playerStat/public");
}

export async function getPublicPlayerStatsByUserId(userId: number) {
  return apiRequest<PlayerStat[]>(`/playerStat/public/user/${userId}`);
}

export async function getMyPlayerStats(token: string) {
  return apiRequest<PlayerStat[]>("/playerStat/mine", { token });
}

export async function createPlayerStat(token: string, payload: PlayerStatPayload) {
  return apiRequest<PlayerStat>("/playerStat", {
    method: "POST",
    token,
    body: payload,
  });
}

export interface MatchStatEntryRow {
  userId: number | null;
  role: "TANK" | "DPS" | "SUPPORT";
  kills: number;
  assists: number;
  deaths: number;
  damage: number;
  healing: number;
  mitigation: number;
}

export interface MatchStatEntryPlayer {
  id: number;
  nickname: string;
  user: string;
  teamId: number | null;
}

export interface MatchStatGameEntry {
  mapType: "CONTROL" | "HYBRID" | "PAYLOAD" | "PUSH" | "FLASHPOINT";
  gameDuration: number;
  rows: MatchStatEntryRow[];
  players: MatchStatEntryPlayer[];
}

export async function createBatchPlayerStats(
  token: string,
  payload: {
    matchId: number;
    games: Array<{
      mapType: "CONTROL" | "HYBRID" | "PAYLOAD" | "PUSH" | "FLASHPOINT";
      gameNumber: number;
      gameDuration: number | string;
      rows: MatchStatEntryRow[];
    }>;
  }
) {
  return apiRequest<{ count: number; stats: PlayerStat[] }>("/playerStat/batch", {
    method: "POST",
    token,
    body: payload,
  });
}
