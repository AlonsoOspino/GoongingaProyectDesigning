import { apiRequest } from "@/lib/api/client";
import type { PlayerStat } from "@/lib/api/types";

export async function getAllPlayerStats(token: string) {
  return apiRequest<PlayerStat[]>("/playerStat", { token });
}

export async function getPublicPlayerStats() {
  return apiRequest<PlayerStat[]>("/playerStat/public");
}

export async function getPublicPlayerStatsByUserId(userId: number) {
  return apiRequest<PlayerStat[]>(`/playerStat/public/user/${userId}`);
}
