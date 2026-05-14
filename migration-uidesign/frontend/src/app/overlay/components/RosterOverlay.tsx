"use client";

import { useEffect, useMemo, useState } from "react";
import { getMatchById, getTeams, type Match, type Team } from "@/lib/api";
import { resolveGenericBackendAsset } from "@/lib/assetUrls";
import { teamAbbreviation } from "@/lib/overlay/leaderboardOverlay";
import styles from "./roster-overlay.module.css";

const POLL_INTERVAL_MS = 10000;

type Side = "A" | "B";

interface RosterOverlayProps {
  matchId: number;
  side: Side;
}

function parseRoster(raw?: string | null) {
  if (!raw) return [] as string[];

  return raw
    .split(/\r?\n|,|;|\|/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function teamLogo(url?: string | null) {
  if (!url) return "";
  return resolveGenericBackendAsset(url);
}

export function RosterOverlay({ matchId, side }: RosterOverlayProps) {
  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(matchId) || matchId <= 0) {
      setLoading(false);
      setError("Invalid match id.");
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const [loadedMatch, loadedTeams] = await Promise.all([getMatchById(matchId), getTeams()]);
        if (cancelled) return;
        setMatch(loadedMatch);
        setTeams(loadedTeams);
        setError(null);
      } catch (fetchError) {
        if (cancelled) return;
        const message = fetchError instanceof Error ? fetchError.message : "Failed to load roster overlay.";
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

  const team = useMemo(() => {
    if (!match) return null;
    const targetTeamId = side === "A" ? match.teamAId : match.teamBId;
    return teams.find((item) => item.id === targetTeamId) ?? null;
  }, [match, teams, side]);

  const roster = useMemo(() => parseRoster(team?.roster), [team]);

  if (loading) {
    return (
      <div className={styles.statusScreen}>
        <p>Loading roster overlay</p>
      </div>
    );
  }

  if (error || !match || !team) {
    return (
      <div className={styles.statusScreen}>
        <p>{error || "Roster unavailable"}</p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <div className={styles.teamHeader}>
          {team.logo ? (
            <img src={teamLogo(team.logo)} alt={team.name} className={styles.logo} />
          ) : (
            <div className={styles.fallbackLogo}>{teamAbbreviation(team.name)}</div>
          )}
          <h1 className={styles.teamName}>{team.name}</h1>
        </div>

        <ul className={styles.rosterList}>
          {roster.length > 0 ? (
            roster.map((player, index) => (
              <li key={`${player}-${index}`} className={styles.rosterItem}>
                {player}
              </li>
            ))
          ) : (
            <li className={styles.rosterItem}>No roster configured</li>
          )}
        </ul>
      </div>
    </div>
  );
}
