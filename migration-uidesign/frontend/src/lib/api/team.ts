import { apiRequest } from "@/lib/api/client";
import type { Team } from "@/lib/api/types";

export async function getTeams(options: { includeDev?: boolean } = {}) {
  const query = options.includeDev ? "?includeDev=true" : "";
  return apiRequest<Team[]>(`/team${query}`);
}

export interface PublicTeamPlayer {
  id: number;
  memberId: number;
  role: "CAPTAIN" | "PLAYER";
  member: { id: number; username: string; nickname: string | null; avatarUrl: string | null };
}

export async function getTeamPlayers(teamId: number) {
  return apiRequest<PublicTeamPlayer[]>(`/team/${teamId}/players`, { cache: "no-store" });
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
