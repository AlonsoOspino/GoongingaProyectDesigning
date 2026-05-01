"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getDraftByMatchId } from "@/lib/api/draft";
import { getTeams, getLeaderboard, getMatchesByWeek } from "@/lib/api";
import type { DraftState, Team, Match } from "@/lib/api/types";
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

  const getTeamAbbr = (name: string) => name.substring(0, 3).toUpperCase();

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

  if (loading || !draftState) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingText}>Loading overlay...</div>
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
