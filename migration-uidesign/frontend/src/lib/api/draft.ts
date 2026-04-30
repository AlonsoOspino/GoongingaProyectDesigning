import { apiRequest } from "@/lib/api/client";
import type { DraftState } from "@/lib/api/types";

type DraftReadAccess =
  | string
  | {
      key?: string;
      token?: string;
    };

function resolveDraftReadAccess(access?: DraftReadAccess) {
  if (typeof access === "string") {
    return { key: access, token: undefined as string | undefined };
  }
  return {
    key: access?.key,
    token: access?.token,
  };
}

export async function createDraft(token: string, matchId: number) {
  return apiRequest<DraftState>(`/draft/${matchId}`, {
    method: "POST",
    token,
  });
}

export async function startMapPicking(token: string, draftId: number) {
  return apiRequest<DraftState>(`/draft/${draftId}/start-map-picking`, {
    method: "PATCH",
    token,
  });
}

export async function pickMap(token: string, draftId: number, payload: { mapId: number; teamId?: number }) {
  return apiRequest<DraftState>(`/draft/${draftId}/pick-map`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function startBan(token: string, draftId: number) {
  return apiRequest<DraftState>(`/draft/${draftId}/start-ban`, {
    method: "PATCH",
    token,
  });
}

export async function banHero(
  token: string,
  draftId: number,
  payload: { heroId: number | null; teamId?: number }
) {
  return apiRequest<DraftState>(`/draft/${draftId}/ban-hero`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function endMap(token: string, draftId: number) {
  return apiRequest<DraftState>(`/draft/${draftId}/end-map`, {
    method: "PATCH",
    token,
  });
}

export async function endGame(token: string, draftId: number) {
  return apiRequest<DraftState>(`/draft/${draftId}/end-game`, {
    method: "PATCH",
    token,
  });
}

export async function getDraftState(draftId: number, access?: DraftReadAccess) {
  const { key, token } = resolveDraftReadAccess(access);
  const suffix = key ? `?key=${encodeURIComponent(key)}` : "";
  return apiRequest<DraftState>(`/draft/${draftId}/state${suffix}`, { token });
}

export async function getDraftByMatchId(matchId: number, access?: DraftReadAccess) {
  const { key, token } = resolveDraftReadAccess(access);
  const suffix = key ? `?key=${encodeURIComponent(key)}` : "";
  return apiRequest<DraftState>(`/draft/by-match/${matchId}${suffix}`, { token });
}
