import { apiRequest } from "@/lib/api/client";
import type { LeaderboardOverlayAsset } from "@/lib/api/types";

export async function getLeaderboardOverlayAsset(matchId: number) {
  return apiRequest<LeaderboardOverlayAsset>(`/overlay-assets/leaderboard/${matchId}`);
}
