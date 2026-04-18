import { apiRequest } from "@/lib/api/client";
import type { Match, Team, MatchType, MatchStatus } from "@/lib/api/types";

// ==================== TOURNAMENT ====================
export interface Tournament {
  id: number;
  name: string;
  startDate: string;
  state: "SCHEDULED" | "ROUNDROBIN" | "PLAYOFFS" | "SEMIFINALS" | "FINALS" | "FINISHED";
}

export async function getTournaments() {
  return apiRequest<Tournament[]>("/tournament");
}

export async function getCurrentTournament() {
  return apiRequest<Tournament>("/tournament/current");
}

export async function createTournament(
  token: string,
  payload: { name: string; startDate: string }
) {
  return apiRequest<Tournament>("/tournament/create", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function updateTournament(
  token: string,
  id: number,
  payload: Partial<Tournament>
) {
  return apiRequest<Tournament>(`/tournament/update/${id}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export async function deleteTournament(token: string, id: number) {
  return apiRequest<void>(`/tournament/delete/${id}`, {
    method: "DELETE",
    token,
  });
}

// ==================== MATCHES (Admin) ====================
export interface CreateMatchPayload {
  type: MatchType;
  bestOf: number;
  startDate: string;
  teamAId: number;
  teamBId: number;
  tournamentId: number;
  semanas?: number;
  title?: string;
  mapsAllowedByRound?: Record<string, number[]>;
}

export async function adminCreateMatch(token: string, payload: CreateMatchPayload) {
  return apiRequest<Match>("/match/admin/create", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function adminUpdateMatch(
  token: string,
  matchId: number,
  payload: Partial<Match>
) {
  return apiRequest<Match>(`/match/admin/update/${matchId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export async function adminDeleteMatch(token: string, matchId: number) {
  return apiRequest<void>(`/match/admin/delete/${matchId}`, {
    method: "DELETE",
    token,
  });
}

export async function adminGenerateRoundRobin(
  token: string,
  payload: { tournamentId: number; bestOf: number; startDate: string }
) {
  return apiRequest<Match[]>("/match/admin/generate-round-robin", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function getMatchById(matchId: number) {
  return apiRequest<Match>(`/match/${matchId}`);
}

// ==================== TEAMS (Admin) ====================
export interface CreateTeamPayload {
  name: string;
  logo?: string;
  roster?: string;
  tournamentId: number;
}

export async function adminCreateTeam(token: string, payload: CreateTeamPayload) {
  return apiRequest<Team>("/team/create", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function adminUpdateTeam(
  token: string,
  teamId: number,
  payload: Partial<Team>
) {
  return apiRequest<Team>(`/team/admin/update/${teamId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export async function adminDeleteTeam(token: string, teamId: number) {
  return apiRequest<void>(`/team/delete/${teamId}`, {
    method: "DELETE",
    token,
  });
}

// ==================== MEMBERS (Admin) ====================
export interface Member {
  id: number;
  nickname: string;
  user: string;
  role: "ADMIN" | "MANAGER" | "CAPTAIN" | "EDITOR" | "DEFAULT";
  profilePic?: string | null;
  rank: number;
  teamId: number | null;
}

export async function getMembers() {
  return apiRequest<Member[]>("/member/all");
}

export async function getMemberById(id: number) {
  return apiRequest<Member>(`/member/${id}`);
}

export async function adminRegisterMember(
  token: string,
  payload: { nickname: string; user: string; password: string; role?: string; teamId?: number }
) {
  return apiRequest<Member>("/member/register", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function adminUpdateMember(
  token: string,
  memberId: number,
  payload: Partial<Member>
) {
  return apiRequest<Member>(`/member/admin/${memberId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

// ==================== MAPS & HEROES ====================
export interface GameMap {
  id: number;
  type: "CONTROL" | "HYBRID" | "PAYLOAD" | "PUSH" | "FLASHPOINT";
  description: string;
  imgPath: string;
}

export interface Hero {
  id: number;
  role: "TANK" | "DPS" | "SUPPORT";
  imgPath: string;
}

export async function getMaps() {
  return apiRequest<GameMap[]>("/map");
}

export async function getHeroes() {
  return apiRequest<Hero[]>("/hero");
}
