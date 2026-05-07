"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getDraftByMatchId } from "@/lib/api/draft";
import { getTeams, getLeaderboard, getMatchesByWeek } from "@/lib/api";
import type { DraftState, Team, Match } from "@/lib/api/types";
import { resolveMapImageUrl } from "@/lib/assetUrls";
import { useImageReady, preloadImages } from "@/components/draft/MapImage";
import { useHeroVideoSwitcher } from "@/hooks/useHeroVideoSwitcher";
import { getMemberProfileById } from "@/lib/api";
import { StartingPhase } from "../phases/StartingPhase";
import { BanPhase } from "../phases/BanPhase";
import { PlayingPhase } from "../phases/PlayingPhase";
import { EndMapPhase } from "../phases/EndMapPhase";
import { FinishedPhase } from "../phases/FinishedPhase";
import styles from "../overlay.module.css";

const POLL_INTERVAL = 3000;

export default function BansOverlayPage() {
  const params = useParams();
  const matchId = Number(params.matchId);
  const searchParams = useSearchParams();
  const urlKey = searchParams?.get("key");

  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [leaderboard, setLeaderboard] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroVideoFolderPath, setHeroVideoFolderPath] = useState<string>("");

  const prevPhaseRef = useRef<string | null>(null);
  
  const videoSwitcher = useHeroVideoSwitcher({
    enabled: true,
    heroVideoFolderPath,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [draft, teamsList] = await Promise.all([
          getDraftByMatchId(matchId, { key: urlKey ?? undefined }),
          getTeams(),
        ]);
        setDraftState(draft);
        setTeams(teamsList);

        // Fetch leaderboard and matches based on tournament phase
        if (draft && draft.match?.tournamentId) {
          const isPlayoffs = draft.match.type === "PLAYOFFS";
          const isPlayins = draft.match.type === "PLAYINS";
          const week = draft.match.semanas || 1;

          // Build query parameters based on match type
          const matchType = isPlayoffs ? "PLAYOFFS" : isPlayins ? "PLAYINS" : null;
          const apiPromise = matchType
            ? fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/match?tournamentId=${draft.match.tournamentId}&type=${matchType}`).then((r) => r.json())
            : getMatchesByWeek(draft.match.tournamentId, week);

          const [leaderboardData, matchesData] = await Promise.all([
            getLeaderboard(draft.match.tournamentId),
            apiPromise,
          ]);
          setLeaderboard(leaderboardData);
          setMatches(matchesData);
        }
      } catch (err) {
        console.error("Failed to load overlay data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [matchId, urlKey]);

  const getTeamAbbr = (name: string) => name.substring(0, 3).toUpperCase();

  // Load hero video folder path from manager profile
  useEffect(() => {
    const loadHeroVideoFolder = async () => {
      try {
        // Get user profile from sessionStorage or backend
        const token = sessionStorage.getItem("auth_token");
        const userId = sessionStorage.getItem("user_id");
        
        if (token && userId) {
          const profile = await getMemberProfileById(Number(userId), token);
          setHeroVideoFolderPath(profile.heroVideoFolderPath ?? "");
          console.log("[v0] Hero video folder loaded:", profile.heroVideoFolderPath);
        }
      } catch (err) {
        console.error("[v0] Failed to load hero video folder path:", err);
      }
    };

    loadHeroVideoFolder();
  }, []);

  // Handle phase transitions with double-buffered video switching
  useEffect(() => {
    if (!draftState?.phase) return;

    // Only switch videos on specific phase transitions
    const shouldSwitchVideo = draftState.phase !== prevPhaseRef.current;

    if (shouldSwitchVideo) {
      console.log("[v0] Phase changed:", prevPhaseRef.current, "->", draftState.phase);
      
      // Map phases to video file names (using double-buffer naming: hero_video_a and hero_video_b)
      let videoFileName: string | null = null;
      
      switch (draftState.phase) {
        case "STARTING":
          videoFileName = "hero_video_a.mp4";
          break;
        case "MAPPICKING":
        case "BAN":
          videoFileName = "hero_video_b.mp4";
          break;
        case "PLAYING":
          videoFileName = "hero_video_a.mp4";
          break;
        case "ENDMAP":
          videoFileName = "hero_video_b.mp4";
          break;
        case "FINISHED":
          videoFileName = "hero_video_a.mp4";
          break;
        default:
          videoFileName = null;
      }

      if (videoFileName && videoSwitcher.isConnected && heroVideoFolderPath) {
        videoSwitcher.switchToVideo(videoFileName);
      }

      prevPhaseRef.current = draftState.phase;
    }
  }, [draftState?.phase, videoSwitcher, heroVideoFolderPath]);
  // If the caster opens the page right at the BAN phase the artwork has
  // not been fetched yet, and we don't want the bans to render on top of
  // a half-loaded backdrop. We wait until the bytes are decoded, then
  // swap to the real BanPhase.
  const currentMap = draftState?.allMaps?.find((m) => m.id === draftState.currentMapId);
  const mapBgUrl = currentMap?.imgPath ? resolveMapImageUrl(currentMap.imgPath) : null;
  const mapBgReady = useImageReady(mapBgUrl);

  // Warm the image cache for every map in the pool the moment we get
  // draft state. This means later phase transitions (BAN, PLAYING,
  // ENDMAP, ...) never have to re-fetch the map artwork — it's already
  // decoded and `useImageReady` returns true synchronously.
  useEffect(() => {
    if (!draftState?.allMaps?.length) return;
    const urls = draftState.allMaps
      .map((m) => (m.imgPath ? resolveMapImageUrl(m.imgPath) : null))
      .filter((u): u is string => !!u);
    if (urls.length) preloadImages(urls);
  }, [draftState?.allMaps]);

  if (loading || !draftState) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingText}>Loading overlay...</div>
      </div>
    );
  }

  // Hold the UI on a loading screen if we're entering BAN/MAPPICKING but
  // the map artwork hasn't decoded yet.
  const isMapPhase = draftState.phase === "BAN" || draftState.phase === "MAPPICKING";
  if (isMapPhase && mapBgUrl && !mapBgReady) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingText}>Loading...</div>
      </div>
    );
  }

  // Route to appropriate phase component
  switch (draftState.phase) {
    case "STARTING":
      return <StartingPhase draftState={draftState} teams={teams} leaderboard={leaderboard} matches={matches} getTeamAbbr={getTeamAbbr} />;

    case "MAPPICKING":
    case "BAN":
      return <BanPhase draftState={draftState} teams={teams} getTeamAbbr={getTeamAbbr} />;

    case "PLAYING":
      return <PlayingPhase draftState={draftState} />;

    case "ENDMAP":
      return <EndMapPhase draftState={draftState} />;

    case "FINISHED":
      return <FinishedPhase draftState={draftState} teams={teams} />;

    default:
      return (
        <div className={styles.loading}>
          <div className={styles.loadingText}>Unknown phase: {draftState.phase}</div>
        </div>
      );
  }
}
