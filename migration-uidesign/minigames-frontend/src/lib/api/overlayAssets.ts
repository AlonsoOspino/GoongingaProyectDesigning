import { apiRequest } from "@/lib/api/client";
import type { LeaderboardOverlayAsset, LeaderboardOverlaySettings } from "@/lib/api/types";

export async function getLeaderboardOverlayAsset(matchId: number) {
  return apiRequest<LeaderboardOverlayAsset>(`/overlay-assets/leaderboard/${matchId}`);
}

export async function updateLeaderboardOverlayAsset(
  token: string,
  matchId: number,
  payload: {
    backgroundImageUrl?: string | null;
    settings?: LeaderboardOverlaySettings | null;
  }
) {
  return apiRequest<LeaderboardOverlayAsset>(`/overlay-assets/leaderboard/${matchId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}
