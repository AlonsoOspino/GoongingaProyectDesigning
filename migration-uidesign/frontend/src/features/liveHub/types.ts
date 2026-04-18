import type { DraftState, Match, PlayerStat, Team } from "@/lib/api/types";

export interface LiveHubSnapshot {
  generatedAt: string;
  leaderboard: Team[];
  upcomingMatch: Match | null;
  activeMatches: Match[];
  draftStates: DraftState[];
  myStats: PlayerStat[];
}

export interface LiveHubParams {
  token: string;
  draftIds?: number[];
  tournamentId?: number;
}
