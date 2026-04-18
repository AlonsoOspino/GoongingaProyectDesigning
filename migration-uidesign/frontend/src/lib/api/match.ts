import { apiRequest } from "@/lib/api/client";
import type { Match } from "@/lib/api/types";

export async function getMatches() {
  return apiRequest<Match[]>("/match");
}

export async function getSoonestMatch() {
  return apiRequest<Match>("/match/soonest");
}

export async function getActiveMatches() {
  return apiRequest<Match[]>("/match/active");
}

export async function updateCaptainMatch(
  token: string,
  matchId: number,
  payload: { teamAready?: 0 | 1; teamBready?: 0 | 1; startDate?: string }
) {
  return apiRequest<Match>(`/match/captain/update/${matchId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export async function updateManagerMatch(token: string, matchId: number, payload: Partial<Match>) {
  return apiRequest<Match>(`/match/manager/update/${matchId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export async function submitMatchResult(token: string, matchId: number, winnerTeamId: number | null) {
  return apiRequest<Match>(`/match/${matchId}/result`, {
    method: "POST",
    token,
    body: { winnerTeamId },
  });
}
