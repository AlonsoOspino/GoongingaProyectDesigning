"use client";

import { useEffect, useMemo, useState } from "react";
import { getMatchById } from "@/lib/api/admin";
import { getDraftByMatchId } from "@/lib/api/draft";
import { getTeams } from "@/lib/api/team";
import type { DraftState, Hero, Match, Team } from "@/lib/api/types";
import { resolveGenericBackendAsset, resolveHeroImageUrl } from "@/lib/assetUrls";
import styles from "./match-header-overlay.module.css";

interface MatchHeaderOverlayProps {
  matchId: number;
  reverseSides?: boolean;
}

const POLL_INTERVAL_MS = 10000;

function teamAssetUrl(pathValue?: string | null) {
  if (!pathValue) return "";
  return resolveGenericBackendAsset(pathValue);
}

export function MatchHeaderOverlay({ matchId, reverseSides = false }: MatchHeaderOverlayProps) {
  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [draft, setDraft] = useState<DraftState | null>(null);

  useEffect(() => {
    if (!Number.isInteger(matchId) || matchId <= 0) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const [loadedMatch, loadedTeams] = await Promise.all([
          getMatchById(matchId),
          getTeams(),
        ]);
        const loadedDraft = await getDraftByMatchId(matchId).catch(() => undefined);

        if (cancelled) return;
        setMatch(loadedMatch);
        setTeams(loadedTeams);
        if (loadedDraft !== undefined) setDraft(loadedDraft);
      } catch {
        if (cancelled) return;
        // Keep the last confirmed program frame during recoverable failures.
      }
    };

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

  const currentGameNumber = useMemo(() => {
    if (!match) return null;
    const nextGame = (match.gameNumber ?? 0) + 1;
    return nextGame < 1 ? 1 : nextGame;
  }, [match]);

  const heroesById = useMemo(() => {
    const result = new Map<number, Hero>();
    for (const hero of draft?.heroes ?? []) {
      result.set(hero.id, hero);
    }
    return result;
  }, [draft?.heroes]);

  const bansByTeam = useMemo(() => {
    const result = new Map<number, Array<number | null>>();
    if (!draft || !currentGameNumber) return result;

    const actions = Array.isArray(draft.actions) ? draft.actions : [];
    for (const action of actions) {
      if (action.action !== "BAN" || action.gameNumber !== currentGameNumber) continue;
      const list = result.get(action.teamId) ?? [];
      if (list.length >= 2) continue;
      list.push(action.value ?? null);
      result.set(action.teamId, list);
    }

    return result;
  }, [draft, currentGameNumber]);

  const teamABans = useMemo(() => {
    const list = match ? bansByTeam.get(match.teamAId) ?? [] : [];
    const filled = [...list];
    while (filled.length < 2) filled.push(null);
    return filled.slice(0, 2);
  }, [bansByTeam, match]);

  const teamBBans = useMemo(() => {
    const list = match ? bansByTeam.get(match.teamBId) ?? [] : [];
    const filled = [...list];
    while (filled.length < 2) filled.push(null);
    return filled.slice(0, 2);
  }, [bansByTeam, match]);

  const leftTeam = reverseSides ? teamB : teamA;
  const rightTeam = reverseSides ? teamA : teamB;
  const leftTeamBans = reverseSides ? teamBBans : teamABans;
  const rightTeamBans = reverseSides ? teamABans : teamBBans;
  const leftScore = reverseSides ? match?.mapWinsTeamB ?? 0 : match?.mapWinsTeamA ?? 0;
  const rightScore = reverseSides ? match?.mapWinsTeamA ?? 0 : match?.mapWinsTeamB ?? 0;

  if (!match) {
    return <div className={styles.root}><div className={styles.standby} role="status">Match header · stand by</div></div>;
  }

  return (
    <div className={styles.root}>
      <header className={styles.headerBar}>
        <div className={styles.decor} aria-hidden />

        <div className={styles.content}>
          <section className={styles.lane}>
            <div className={styles.bannerFrame}>
              {leftTeam?.bannerLeft ? (
                <img
                  className={styles.bannerImage}
                  src={teamAssetUrl(leftTeam.bannerLeft)}
                  alt=""
                />
              ) : (
                <div className={styles.fallback}>BANNER</div>
              )}
              <div className={`${styles.banStack} ${styles.banStackOverlay} ${styles.banStackRight}`}>
                {leftTeamBans.map((heroId, index) => {
                  const hero = heroId ? heroesById.get(heroId) : null;
                  return (
                    <div
                      key={`left-team-ban-${index}`}
                      className={`${styles.banSlot} ${index === 0 ? styles.banSlotTop : styles.banSlotBottom}`}
                    >
                      {hero?.imgPath ? (
                        <img
                          className={styles.banImage}
                          src={resolveHeroImageUrl(hero.imgPath)}
                          alt={hero.name || ""}
                        />
                      ) : (
                        <div className={styles.banFallback}>-</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={styles.scoreValue}>{leftScore}</div>
          </section>

          <section className={styles.centerBlank} />

          <section className={styles.laneRight}>
            <div className={styles.scoreValue}>{rightScore}</div>
            <div className={styles.bannerFrame}>
              {rightTeam?.bannerRight ? (
                <img
                  className={styles.bannerImage}
                  src={teamAssetUrl(rightTeam.bannerRight)}
                  alt=""
                />
              ) : (
                <div className={styles.fallback}>BANNER</div>
              )}
              <div className={`${styles.banStack} ${styles.banStackOverlay} ${styles.banStackLeft}`}>
                {rightTeamBans.map((heroId, index) => {
                  const hero = heroId ? heroesById.get(heroId) : null;
                  return (
                    <div
                      key={`right-team-ban-${index}`}
                      className={`${styles.banSlot} ${index === 0 ? styles.banSlotTop : styles.banSlotBottom}`}
                    >
                      {hero?.imgPath ? (
                        <img
                          className={styles.banImage}
                          src={resolveHeroImageUrl(hero.imgPath)}
                          alt={hero.name || ""}
                        />
                      ) : (
                        <div className={styles.banFallback}>-</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </header>
    </div>
  );
}
