import { apiRequest, ApiError } from "@/lib/api/client";
import type { Match, Team, MatchType, MatchStatus, Tournament, GenerateRoundRobinPayload } from "@/lib/api/types";

export type { Tournament };

// ==================== TOURNAMENT ====================

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
  semanas?: number | null;
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
  payload: GenerateRoundRobinPayload
) {
  return apiRequest<Match[]>("/match/admin/generate-round-robin", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function adminUpdateWeekMaps(
  token: string,
  payload: { tournamentId: number; semanas: number; mapsAllowedByRound: Record<string, number[]> }
) {
  return apiRequest<{ message: string; matches: Match[] }>("/match/admin/week-maps", {
    method: "PUT",
    token,
    body: payload,
  });
}

export async function adminGetWeekMapsConfig(
  token: string,
  tournamentId: number,
  semanas: number
) {
  return apiRequest<{ mapsAllowedByRound: Record<string, number[]> | null }>(
    `/match/admin/week-maps/${tournamentId}/${semanas}`,
    { token }
  );
}

export async function getMatchById(matchId: number) {
  return apiRequest<Match>(`/match/${matchId}`);
}

// ==================== TEAMS (Admin) ====================
export interface CreateTeamPayload {
  name: string;
  logo?: string;
  roster?: string;
  discordRoleId?: string;
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

export async function adminBulkImportUsers(
  token: string,
  script: string
): Promise<{ created: number; errors: number; results: Member[]; errorDetails: string[] }> {
  return apiRequest("/member/bulk-import", {
    method: "POST",
    token,
    body: { script },
  });
}

// ==================== MAPS & HEROES ====================
export interface AdminGameMap {
  id: number;
  type: "CONTROL" | "HYBRID" | "PAYLOAD" | "PUSH" | "FLASHPOINT";
  description: string;
  imgPath: string;
}

export interface AdminHero {
  id: number;
  name: string;
  role: "TANK" | "DPS" | "SUPPORT";
  imgPath: string;
}

export async function getMaps() {
  return apiRequest<AdminGameMap[]>("/map");
}

export async function getHeroes() {
  return apiRequest<AdminHero[]>("/hero");
}

export async function adminCreateMap(
  token: string,
  payload: {
    name: string;
    type: AdminGameMap["type"];
    image: File;
  }
) {
  const form = new FormData();
  form.append("name", payload.name);
  form.append("type", payload.type);
  form.append("image", payload.image);

  return apiRequest<AdminGameMap>("/map/create", {
    method: "POST",
    token,
    formData: form,
  });
}

export async function adminCreateHero(
  token: string,
  payload: {
    name: string;
    role: AdminHero["role"];
    image: File;
  }
) {
  const form = new FormData();
  form.append("name", payload.name);
  form.append("role", payload.role);
  form.append("image", payload.image);

  return apiRequest<AdminHero>("/hero/create", {
    method: "POST",
    token,
    formData: form,
  });
}

// ==================== DATABASE TOOLS (Admin) ====================
export async function adminDownloadBackupSql(token: string) {
  return apiRequest<string>("/system-db/backup", {
    token,
  });
}

export async function adminRestoreBackupSql(
  token: string,
  payload: { confirmationText: string; script: string }
) {
  return apiRequest<{ message: string; executedStatements: number }>("/system-db/restore", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function adminWipeDatabase(token: string, payload: { confirmationText: string }) {
  try {
    return await apiRequest<{ message: string }>("/system-db/wipe", {
      method: "POST",
      token,
      body: payload,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      if (payload.confirmationText !== "DELETE DATABASE") {
        throw error;
      }

      const fallback = await adminRestoreBackupSql(token, {
        confirmationText: "RESTORE DATABASE",
        script:
          'TRUNCATE TABLE "PlayerStat", "DraftAction", "DraftTable", "News", "Match", "Member", "Team", "Tournament", "_AllowedMaps" RESTART IDENTITY CASCADE;',
      });

      return {
        message: `${fallback.message} (compatibility mode)` ,
      };
    }
    throw error;
  }
}
