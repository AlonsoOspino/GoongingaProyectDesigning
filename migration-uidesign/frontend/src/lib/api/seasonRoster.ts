import { apiRequest } from "@/lib/api/client";
import type { Tournament } from "@/lib/api/types";

export type SeasonRole = "CAPTAIN" | "PLAYER";

export interface RosterMember {
  id: number;
  username: string;
  nickname: string | null;
  avatarUrl: string | null;
}

export interface SeasonRosterPlayer {
  id: number;
  memberId: number;
  member: RosterMember;
  teamId: number | null;
  role: SeasonRole;
  joinedAt: string;
}

export interface SeasonRosterTeam {
  id: number;
  name: string;
  playoffSeed: number | null;
}

export interface SeasonRoster {
  tournament: Pick<Tournament, "id" | "name" | "startDate" | "state">;
  teams: SeasonRosterTeam[];
  assigned: SeasonRosterPlayer[];
  unassigned: RosterMember[];
}

export function getSeasonRosterTournaments(token: string) {
  return apiRequest<Array<Pick<Tournament, "id" | "name" | "startDate" | "state">>>(
    "/season-roster/tournaments",
    { token, cache: "no-store" }
  );
}

export function getSeasonRoster(token: string, tournamentId: number) {
  return apiRequest<SeasonRoster>(`/season-roster/${tournamentId}`, { token, cache: "no-store" });
}

export function updateSeasonRosterMember(
  token: string,
  tournamentId: number,
  memberId: number,
  payload: { teamId: number | null; role: SeasonRole }
) {
  return apiRequest<{
    seasonPlayer: SeasonRosterPlayer;
    demoted: { memberId: number; username: string } | null;
  }>(`/season-roster/${tournamentId}/members/${memberId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export function removeSeasonRosterMember(token: string, tournamentId: number, memberId: number) {
  return apiRequest<{ memberId: number }>(`/season-roster/${tournamentId}/members/${memberId}`, {
    method: "DELETE",
    token,
  });
}
