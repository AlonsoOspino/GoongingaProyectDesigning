import { apiRequest } from "@/lib/api/client";
import type { Team } from "@/lib/api/types";

export async function getTeams() {
  return apiRequest<Team[]>("/team");
}

export async function getLeaderboard(tournamentId?: number) {
  const query = tournamentId ? `?tournamentId=${tournamentId}` : "";
  return apiRequest<Team[]>(`/team/leaderboard${query}`);
}

export async function updateCaptainTeam(
  token: string,
  teamId: number,
  payload: { name?: string; logo?: string; roster?: string }
) {
  return apiRequest<Team>(`/team/update/${teamId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}
