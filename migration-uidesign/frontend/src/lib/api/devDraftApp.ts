import { apiRequest } from "@/lib/api/client";
import type { AdminGameMap, AdminHero } from "@/lib/api/admin";
import type { MapType, Match, Team } from "@/lib/api/types";

export interface DevDraftAppState {
  teams: Team[];
  maps: AdminGameMap[];
  heroes: AdminHero[];
  match: (Match & { teamA?: Team; teamB?: Team }) | null;
  bans: { teamA: number[]; teamB: number[] };
}

export interface DevMatchPayload {
  teamAId: number;
  teamBId: number;
  mapIds: number[];
}

export interface DevOverlayFocusPayload {
  focusType: MapType | null;
  focusMapId?: number | null;
}

export function getDevDraftAppState(token: string) {
  return apiRequest<DevDraftAppState>("/dev/draft-app", { token, cache: "no-store" });
}

export function createDevTeam(token: string, payload: { name: string; logo: string }) {
  return apiRequest<DevDraftAppState>("/dev/draft-app/teams", {
    method: "POST",
    token,
    body: payload,
  });
}

export function deleteDevTeam(token: string, teamId: number) {
  return apiRequest<DevDraftAppState>(`/dev/draft-app/teams/${teamId}`, {
    method: "DELETE",
    token,
  });
}

export function createDevMatch(token: string, payload: DevMatchPayload) {
  return apiRequest<DevDraftAppState>("/dev/draft-app/match", {
    method: "POST",
    token,
    body: payload,
  });
}

export function deleteDevMatch(token: string) {
  return apiRequest<DevDraftAppState>("/dev/draft-app/match", {
    method: "DELETE",
    token,
  });
}

export function setDevOverlayFocus(token: string, payload: DevOverlayFocusPayload) {
  return apiRequest<DevDraftAppState>("/dev/draft-app/match/overlay", {
    method: "PATCH",
    token,
    body: payload,
  });
}

export function setDevScores(token: string, payload: { mapWinsTeamA: number; mapWinsTeamB: number }) {
  return apiRequest<DevDraftAppState>("/dev/draft-app/match/score", {
    method: "PATCH",
    token,
    body: payload,
  });
}

export function setDevBans(
  token: string,
  payload: { teamABans: number[]; teamBBans: number[] }
) {
  return apiRequest<DevDraftAppState>("/dev/draft-app/match/bans", {
    method: "PUT",
    token,
    body: payload,
  });
}
