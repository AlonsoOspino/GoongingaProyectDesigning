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
