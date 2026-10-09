import { apiRequest } from "@/lib/api/client";
import type { Match, Team, Tournament, GenerateRoundRobinPayload } from "@/lib/api/types";
import type { MatchReference } from "@/lib/matchReference";

export type { Tournament };

export async function getCurrentTournament(options: { cache?: RequestCache } = {}) {
  return apiRequest<Tournament>("/tournament/current", { cache: options.cache });
}

export async function createTournament(
  token: string,
  payload: {
    name: string;
    startDate?: string | null;
    divisionNames?: string[];
    teamFormation?: "DRAFT" | "COMMITTEE";
    targetTeamCount?: number | null;
  }
) {
  return apiRequest<Tournament>("/tournament/create", {
    method: "POST",
    token,
    body: payload,
  });
}

export interface DivisionAssignment {
  id?: number;
  name: string;
  teamIds: number[];
}

export async function updateTournamentDivisions(
  token: string,
  tournamentId: number,
  divisions: DivisionAssignment[]
) {
  return apiRequest<Tournament>(`/tournament/${tournamentId}/divisions`, {
    method: "PUT",
    token,
    body: { divisions },
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

export async function startTournamentPlayoffs(
  token: string,
  id: number,
  teamIds: number[]
) {
  return apiRequest<Tournament>(`/tournament/${id}/start-playoffs`, {
    method: "POST",
    token,
    body: { teamIds },
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

export async function getMatchById(matchId: MatchReference) {
  return apiRequest<Match>(`/match/${matchId}`);
}

// ==================== TEAMS (Admin) ====================
export interface CreateTeamPayload {
  name: string;
  logo?: string;
  bannerLeft?: string;
  bannerRight?: string;
  roster?: string;
  discordRoleId?: string;
  tournamentId: number;
  divisionId?: number | null;
}

export async function adminCreateTeam(token: string, payload: CreateTeamPayload) {
  return apiRequest<Team>("/team/create", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function adminCreateTeams(token: string, payload: { count: number; tournamentId: number; namePrefix?: string }) {
  return apiRequest<{ created: number; names: string[] }>("/team/create-many", {
    method: "POST",
    token,
    body: payload,
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
  heroVideoFolderPath?: string | null;
  obsWebsocketUrl?: string | null;
  obsWebsocketPassword?: string | null;
}

export async function getMembers() {
  return apiRequest<Member[]>("/network-members/players");
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
  heroGift?: string | null;
}

export async function getMaps() {
  return apiRequest<AdminGameMap[]>("/map");
}

export async function getHeroes() {
  return apiRequest<AdminHero[]>("/hero");
}

export async function adminDeleteMap(token: string, id: number) {
  return apiRequest<AdminGameMap>(`/map/delete/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function adminDeleteHero(token: string, id: number) {
  return apiRequest<AdminHero>(`/hero/delete/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function adminCreateMap(
  token: string,
  payload: {
    name: string;
    type: AdminGameMap["type"];
    image?: File;
    imageUrl?: string;
  }
) {
  if (payload.imageUrl) {
    return apiRequest<AdminGameMap>("/map/create", {
      method: "POST",
      token,
      body: {
        name: payload.name,
        type: payload.type,
        imageUrl: payload.imageUrl,
      },
    });
  }

  const form = new FormData();
  form.append("name", payload.name);
  form.append("type", payload.type);
  if (payload.image) {
    form.append("image", payload.image);
  }

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
    image?: File;
    imageUrl?: string;
    heroGift?: string | null;
  }
) {
  if (payload.imageUrl) {
    return apiRequest<AdminHero>("/hero/create", {
      method: "POST",
      token,
      body: {
        name: payload.name,
        role: payload.role,
        imageUrl: payload.imageUrl,
        heroGift: payload.heroGift,
      },
    });
  }

  const form = new FormData();
  form.append("name", payload.name);
  form.append("role", payload.role);
  if (payload.image) {
    form.append("image", payload.image);
  }
  if (payload.heroGift) {
    form.append("heroGift", payload.heroGift);
  }

  return apiRequest<AdminHero>("/hero/create", {
    method: "POST",
    token,
    formData: form,
  });
}
