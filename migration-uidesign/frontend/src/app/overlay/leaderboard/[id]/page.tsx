"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  getLeaderboard,
  getLeaderboardOverlayAsset,
  getMatchById,
  getMatchesByWeek,
  getTeams,
  type Match,
  type Team,
} from "@/lib/api";
import { normalizeLeaderboardOverlaySettings } from "@/lib/overlay/leaderboardOverlay";
import {
  LeaderboardOverlayFromData,
  LeaderboardOverlayStatus,
} from "@/app/overlay/components/LeaderboardOverlay";

const POLL_INTERVAL_MS = 10000;

export default function LeaderboardOverlayPage() {
  const params = useParams<{ id: string }>();
  const matchId = useMemo(() => Number(params.id), [params.id]);

  const [match, setMatch] = useState<Match | null>(null);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [leaderboard, setLeaderboard] = useState<Team[]>([]);
  const [weekMatches, setWeekMatches] = useState<Match[]>([]);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState(normalizeLeaderboardOverlaySettings(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const prevWidth = root.style.getPropertyValue("--overlay-width");
    const prevHeight = root.style.getPropertyValue("--overlay-height");

    root.style.setProperty("--overlay-width", "1920px");
    root.style.setProperty("--overlay-height", "1080px");

    return () => {
      if (prevWidth) {
        root.style.setProperty("--overlay-width", prevWidth);
      } else {
        root.style.removeProperty("--overlay-width");
      }

      if (prevHeight) {
        root.style.setProperty("--overlay-height", prevHeight);
      } else {
        root.style.removeProperty("--overlay-height");
      }
    };
  }, []);

  useEffect(() => {
    if (!Number.isInteger(matchId) || matchId <= 0) {
      setLoading(false);
      setError("Invalid match id.");
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const loadedMatch = await getMatchById(matchId);
        const [teamsData, leaderboardData, overlayAsset] = await Promise.all([
          getTeams(),
          getLeaderboard(loadedMatch.tournamentId),
          getLeaderboardOverlayAsset(matchId),
        ]);
        const normalizedSettings = normalizeLeaderboardOverlaySettings(overlayAsset.settings);
        const weekToLoad = Number.isInteger(Number(normalizedSettings.weekNumber))
          ? Number(normalizedSettings.weekNumber)
          : Number.isInteger(Number(loadedMatch.semanas))
          ? Number(loadedMatch.semanas)
          : 1;
        const weekMatchesData = await getMatchesByWeek(loadedMatch.tournamentId, weekToLoad);

        if (cancelled) return;

        setMatch(loadedMatch);
        setAllTeams(teamsData);
        setLeaderboard(leaderboardData);
        setWeekMatches(weekMatchesData.sort((a, b) => a.id - b.id));
        setBackgroundImageUrl(overlayAsset.backgroundImageUrl);
        setSettings(normalizedSettings);
        setError(null);
      } catch (fetchError) {
        if (cancelled) return;
        const message = fetchError instanceof Error ? fetchError.message : "Failed to load overlay.";
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    void load();
    const pollId = window.setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [matchId]);

  if (loading) {
    return <LeaderboardOverlayStatus message="Loading leaderboard overlay" />;
  }

  if (error || !match) {
    return <LeaderboardOverlayStatus message={error || "Overlay unavailable"} />;
  }

  return (
    <LeaderboardOverlayFromData
      match={match}
      allTeams={allTeams}
      leaderboard={leaderboard}
      weekMatches={weekMatches}
      settings={settings}
      backgroundImageUrl={backgroundImageUrl}
    />
  );
}
