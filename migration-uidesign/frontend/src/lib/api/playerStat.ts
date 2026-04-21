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
    gameDuration?: number | string;
    damage?: number;
    healing?: number;
    mitigation?: number;
    kills?: number;
    assists?: number;
    deaths?: number;
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
  if (payload.gameDuration !== undefined) form.append("gameDuration", String(payload.gameDuration));
  if (payload.damage !== undefined) form.append("damage", String(payload.damage));
  if (payload.healing !== undefined) form.append("healing", String(payload.healing));
  if (payload.mitigation !== undefined) form.append("mitigation", String(payload.mitigation));
  if (payload.kills !== undefined) form.append("kills", String(payload.kills));
  if (payload.assists !== undefined) form.append("assists", String(payload.assists));
  if (payload.deaths !== undefined) form.append("deaths", String(payload.deaths));

  return apiRequest<{ stat: PlayerStat; ocrPreview: string }>("/playerStat/upload", {
    method: "POST",
    token,
    formData: form,
  });
}

export interface MatchStatPreviewRow {
  nickname: string;
  userId: number | null;
  role: "TANK" | "DPS" | "SUPPORT";
  kills: number;
  assists: number;
  deaths: number;
  damage: number;
  healing: number;
  mitigation: number;
  userFound: boolean;
}

export interface MatchStatPreviewPlayer {
  id: number;
  nickname: string;
  user: string;
  teamId: number | null;
}

export interface MatchStatPreviewResponse {
  mapType: "CONTROL" | "HYBRID" | "PAYLOAD" | "PUSH" | "FLASHPOINT";
  extraRounds: number;
  gameDuration: number;
  rows: MatchStatPreviewRow[];
  players: MatchStatPreviewPlayer[];
  ocrPreview: string;
}

export async function uploadMatchStatsScreenshotPreview(
  token: string,
  payload: {
    image: File;
    matchId: number;
    mapType: "CONTROL" | "HYBRID" | "PAYLOAD" | "PUSH" | "FLASHPOINT";
    extraRounds: number;
  }
) {
  const form = new FormData();
  form.append("image", payload.image);
  form.append("matchId", String(payload.matchId));
  form.append("mapType", payload.mapType);
  form.append("extraRounds", String(payload.extraRounds));

  return apiRequest<MatchStatPreviewResponse>("/playerStat/upload-match-preview", {
    method: "POST",
    token,
    formData: form,
  });
}

export async function confirmMatchStatsUpload(
  token: string,
  payload: {
    matchId: number;
    mapType: "CONTROL" | "HYBRID" | "PAYLOAD" | "PUSH" | "FLASHPOINT";
    extraRounds: number;
    gameDuration: number | string;
    rows: Array<{
      userId: number;
      role: "TANK" | "DPS" | "SUPPORT";
      kills: number;
      assists: number;
      deaths: number;
      damage: number;
      healing: number;
      mitigation: number;
    }>;
  }
) {
  return apiRequest<{ count: number; stats: PlayerStat[] }>("/playerStat/upload-match-confirm", {
    method: "POST",
    token,
    body: payload,
  });
}
