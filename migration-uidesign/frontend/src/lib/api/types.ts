export type MemberRole = "ADMIN" | "MANAGER" | "CAPTAIN" | "EDITOR" | "DEFAULT";

export type MatchStatus = "SCHEDULED" | "ACTIVE" | "PENDINGREGISTERS" | "FINISHED";
export type MatchType =
  | "ROUNDROBIN"
  | "PLAYINS"
  | "PLAYOFFS"
  | "SEMIFINALS"
  | "FINALS"
  | "PRACTICE";

export type MapType = "CONTROL" | "HYBRID" | "PAYLOAD" | "PUSH" | "FLASHPOINT";
export type HeroRole = "TANK" | "DPS" | "SUPPORT";

export interface AuthUser {
  id: number;
  nickname: string;
  role: MemberRole;
  teamId: number | null;
  profilePic?: string | null;
}

export interface MemberProfile {
  id: number;
  nickname: string;
  user: string;
  role: MemberRole;
  profilePic?: string | null;
  rank: number;
  teamId: number | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface Team {
  id: number;
  name: string;
  logo?: string | null;
  roster?: string | null;
  discordRoleId?: string | null;
  victories: number;
  mapWins: number;
  mapLoses: number;
  tournamentId: number;
}

export interface Match {
  id: number;
  type: MatchType;
  status: MatchStatus;
  bestOf: number;
  startDate: string;
  tournamentId: number;
  teamAId: number;
  teamBId: number;
  teamAready: number;
  teamBready: number;
  mapWinsTeamA: number;
  mapWinsTeamB: number;
  gameNumber: number;
  semanas: number | null;
  title?: string | null;
  mapsAllowedByRound?: Record<string, number[]> | null;
  mapResults?: Array<{
    gameNumber: number;
    mapId: number | null;
    winnerTeamId: number | null;
    isDraw: boolean;
  }> | null;
  mapStartedAt?: string | null;
  mapTimerPaused?: boolean;
  mapTimerPausedAt?: string | null;
  pauseRequestedBy?: number | null;
  pauseRequestedAt?: string | null;
}

export interface DraftAction {
  id: number;
  draftId: number;
  teamId: number;
  action: "BAN" | "PICK" | "SKIP";
  value: number | null;
  gameNumber: number;
  order: number;
  createdAt: string;
}

export interface DraftState {
  id: number;
  matchId: number;
  currentTurnTeamId: number | null;
  phase: string;
  phaseStartedAt: string;
  actions: DraftAction[];
  bannedHeroes: number[];
  pickedMaps: number[];
  currentMapId: number | null;
  allowedMapTypes?: MapType[];
  availableMaps?: GameMap[];
  allMaps?: GameMap[];
  heroes?: Hero[];
  match: Match;
}

export interface GameMap {
  id: number;
  type: MapType;
  description: string;
  imgPath: string;
}

export interface Hero {
  id: number;
  name: string;
  role: HeroRole;
  imgPath: string;
}

export interface NewsItem {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerStat {
  id: number;
  userId: number;
  damage: number;
  healing: number;
  mitigation: number;
  kills: number;
  assists: number;
  deaths: number;
  gameDuration: number;
  waitTime: number;
  initialTime: number;
  extraRounds: number;
  effectiveDuration: number;
  damagePer10: number;
  healingPer10: number;
  mitigationPer10: number;
  killsPer10: number;
  assistsPer10: number;
  deathsPer10: number;
  mapType: MapType;
  role: HeroRole;
  createdAt: string;
  user?: {
    id: number;
    nickname: string;
    role?: MemberRole;
  };
}

// Payload for adminGenerateRoundRobin API
export interface GenerateRoundRobinPayload {
  tournamentId: number;
  bestOf: number;
  confirmationText: string;
}

export interface Tournament {
  id: number;
  name: string;
  startDate: string;
  state: "SCHEDULED" | "ROUNDROBIN" | "PLAYOFFS" | "SEMIFINALS" | "FINALS" | "FINISHED";
  teams?: Team[];
  matches?: Match[];
}
