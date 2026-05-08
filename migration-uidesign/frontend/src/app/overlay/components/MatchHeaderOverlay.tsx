"use client";

import { useEffect, useMemo, useState } from "react";
import { getMatchById } from "@/lib/api/admin";
import { getTeams } from "@/lib/api/team";
import type { Match, Team } from "@/lib/api/types";
import { resolveGenericBackendAsset } from "@/lib/assetUrls";
import styles from "./match-header-overlay.module.css";

interface MatchHeaderOverlayProps {
  matchId: number;
}

const POLL_INTERVAL_MS = 10000;

function teamAssetUrl(pathValue?: string | null) {
  if (!pathValue) return "";
  return resolveGenericBackendAsset(pathValue);
}

export function MatchHeaderOverlay({ matchId }: MatchHeaderOverlayProps) {
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
        const [loadedMatch, loadedTeams] = await Promise.all([
          getMatchById(matchId),
          getTeams(),
        ]);

        if (cancelled) return;
        setMatch(loadedMatch);
        setTeams(loadedTeams);
        setError(null);
      } catch (fetchError) {
        if (cancelled) return;
        const message =
          fetchError instanceof Error ? fetchError.message : "Failed to load match header overlay data.";
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

  const teamsById = useMemo(() => {
    const result = new Map<number, Team>();
    for (const team of teams) {
      result.set(team.id, team);
    }
    return result;
  }, [teams]);

  const teamA = useMemo(
    () => (match ? teamsById.get(match.teamAId) ?? null : null),
    [match, teamsById]
  );

  const teamB = useMemo(
    () => (match ? teamsById.get(match.teamBId) ?? null : null),
    [match, teamsById]
  );

  if (loading) {
    return null;
  }

  if (error || !match) {
    return null;
  }

  return (
    <div className={styles.root}>
      <header className={styles.headerBar}>
        <div className={styles.decor} aria-hidden />

        <div className={styles.content}>
          <section className={styles.lane}>
            <div className={styles.bannerFrame}>
              {teamA?.bannerURL ? (
                <img className={styles.bannerImage} src={teamAssetUrl(teamA.bannerURL)} alt="" />
              ) : (
                <div className={styles.fallback}>BANNER</div>
              )}
            </div>
            <div className={styles.logoFrame}>
              {teamA?.logo ? (
                <img className={styles.logoImage} src={teamAssetUrl(teamA.logo)} alt="" />
              ) : (
                <div className={styles.fallback}>A</div>
              )}
            </div>
            <div className={styles.scoreValue}>{match.mapWinsTeamA}</div>
          </section>

          <section className={styles.centerBlank} />

          <section className={styles.laneRight}>
            <div className={styles.scoreValue}>{match.mapWinsTeamB}</div>
            <div className={styles.logoFrame}>
              {teamB?.logo ? (
                <img className={styles.logoImage} src={teamAssetUrl(teamB.logo)} alt="" />
              ) : (
                <div className={styles.fallback}>B</div>
              )}
            </div>
            <div className={styles.bannerFrame}>
              {teamB?.bannerURL ? (
                <img className={styles.bannerImage} src={teamAssetUrl(teamB.bannerURL)} alt="" />
              ) : (
                <div className={styles.fallback}>BANNER</div>
              )}
            </div>
          </section>
        </div>
      </header>
    </div>
  );
}
