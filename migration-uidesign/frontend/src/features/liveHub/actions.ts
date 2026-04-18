import { banHero, endMap, pickMap, startBan, startMapPicking } from "@/lib/api/draft";
import { submitMatchResult, updateCaptainMatch } from "@/lib/api/match";
import { createPlayerStat, uploadPlayerStatImage, type PlayerStatPayload } from "@/lib/api/playerStat";

export async function setCaptainReady(
  token: string,
  matchId: number,
  payload: { teamAready?: 0 | 1; teamBready?: 0 | 1; startDate?: string }
) {
  return updateCaptainMatch(token, matchId, payload);
}

export async function runDraftMapPick(token: string, draftId: number, mapId: number, teamId?: number) {
  return pickMap(token, draftId, { mapId, teamId });
}

export async function runDraftBan(
  token: string,
  draftId: number,
  payload: { heroId: number | null; teamId?: number }
) {
  return banHero(token, draftId, payload);
}

export async function beginMapPicking(token: string, draftId: number) {
  return startMapPicking(token, draftId);
}

export async function beginBanPhase(token: string, draftId: number) {
  return startBan(token, draftId);
}

export async function closeMap(token: string, draftId: number) {
  return endMap(token, draftId);
}

export async function registerWinner(token: string, matchId: number, winnerTeamId: number) {
  return submitMatchResult(token, matchId, winnerTeamId);
}

export async function registerStatsManually(token: string, payload: PlayerStatPayload) {
  return createPlayerStat(token, payload);
}

export async function registerStatsByImage(
  token: string,
  payload: Parameters<typeof uploadPlayerStatImage>[1]
) {
  return uploadPlayerStatImage(token, payload);
}
