import { apiRequest } from "@/lib/api/client";
import type { PlayerStat } from "@/lib/api/types";

export interface PlayerStatPayload {
  userId: number;
  damage: number;
  healing: number;
  mitigation: number;
  kills: number;
  assists: number;
  deaths: number;
  gameDuration: number | string;
  waitTime?: number;
  initialTime?: number;
  extraRounds?: number;
  mapType: "CONTROL" | "HYBRID" | "PAYLOAD" | "PUSH" | "FLASHPOINT";
  role: "TANK" | "DPS" | "SUPPORT";
}

export async function getAllPlayerStats(token: string) {
  return apiRequest<PlayerStat[]>("/playerStat", { token });
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

export async function uploadPlayerStatImage(
  token: string,
  payload: {
    image: File;
    userId?: number;
    role?: "TANK" | "DPS" | "SUPPORT";
    mapType?: "CONTROL" | "HYBRID" | "PAYLOAD" | "PUSH" | "FLASHPOINT";
    waitTime?: number;
    initialTime?: number;
    extraRounds?: number;
  }
) {
  const form = new FormData();
  form.append("image", payload.image);
  if (payload.userId !== undefined) form.append("userId", String(payload.userId));
  if (payload.role) form.append("role", payload.role);
  if (payload.mapType) form.append("mapType", payload.mapType);
  if (payload.waitTime !== undefined) form.append("waitTime", String(payload.waitTime));
  if (payload.initialTime !== undefined) form.append("initialTime", String(payload.initialTime));
  if (payload.extraRounds !== undefined) form.append("extraRounds", String(payload.extraRounds));

  return apiRequest<{ stat: PlayerStat; ocrPreview: string }>("/playerStat/upload", {
    method: "POST",
    token,
    formData: form,
  });
}
