import { getDraftState } from "@/lib/api/draft";
import { getActiveMatches, getSoonestMatch } from "@/lib/api/match";
import { getMyPlayerStats } from "@/lib/api/playerStat";
import { getLeaderboard } from "@/lib/api/team";
import type { LiveHubParams, LiveHubSnapshot } from "@/features/liveHub/types";

export async function getLiveHubSnapshot(params: LiveHubParams): Promise<LiveHubSnapshot> {
  const [leaderboard, upcomingMatch, activeMatches, myStats, draftStates] = await Promise.all([
    getLeaderboard(params.tournamentId),
    getSoonestMatch().catch(() => null),
    getActiveMatches().catch(() => []),
    getMyPlayerStats(params.token).catch(() => []),
    Promise.all((params.draftIds ?? []).map((id) => getDraftState(id, { token: params.token }))),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    leaderboard,
    upcomingMatch,
    activeMatches,
    draftStates,
    myStats,
  };
}
