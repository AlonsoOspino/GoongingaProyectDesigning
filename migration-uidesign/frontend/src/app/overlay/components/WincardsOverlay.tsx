"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getMaps, getMatchById, type AdminGameMap } from "@/lib/api/admin";
import { getTeams } from "@/lib/api/team";
import { isDevMatchReference } from "@/lib/matchReference";
import type { DraftState, Match, Team } from "@/lib/api/types";
import { resolveGenericBackendAsset, resolveMapImageUrl } from "@/lib/assetUrls";
import { winnerCardRounds } from "@/lib/casting/model";
import BrandField from "@/components/landing/atmosphere/BrandField";
import styles from "./wincards-overlay.module.css";

interface WincardsOverlayProps {
  matchId: number;
}

type DraftPickState = Pick<DraftState, "actions">;
type MatchWithDraft = Match & { draft?: DraftPickState | null };

const POLL_INTERVAL_MS = 2500;

function teamAssetUrl(pathValue?: string | null) {
  if (!pathValue) return "";
  return resolveGenericBackendAsset(pathValue);
}

export function WincardsOverlay({ matchId }: WincardsOverlayProps) {
  const [match, setMatch] = useState<Match | null>(null);
  const [maps, setMaps] = useState<AdminGameMap[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [draft, setDraft] = useState<DraftPickState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedLogos, setFailedLogos] = useState<ReadonlySet<string>>(() => new Set());

  const markLogoFailed = useCallback((url: string) => {
    setFailedLogos((current) => (current.has(url) ? current : new Set(current).add(url)));
  }, []);

  useEffect(() => {
    if (!Number.isInteger(matchId) || matchId <= 0) {
      setLoading(false);
      setError("Invalid match id.");
      return;
    }

    let cancelled = false;

    // The map catalogue and the team list do not change during a broadcast, so
    // they are fetched once. Only the match row is polled, which is what the
    // ready pips and the winner badges are actually watching.
    const loadStatic = async () => {
      try {
        const [loadedMaps, loadedTeams] = await Promise.all([getMaps(), getTeams({ includeDev: isDevMatchReference(matchId) })]);
        if (cancelled) return;
        setMaps(loadedMaps);
        setTeams(loadedTeams);
      } catch {
        // The match poll reports the outage; a missing catalogue degrades to
        // empty cards rather than a second error screen.
      }
    };

    const loadMatch = async () => {
      try {
        const loadedMatch = await getMatchById(matchId);

        if (cancelled) return;
        setMatch(loadedMatch);
        setDraft((loadedMatch as MatchWithDraft).draft ?? null);
        setError(null);
      } catch (fetchError) {
        if (cancelled) return;
        const message =
          fetchError instanceof Error ? fetchError.message : "Failed to load wincards overlay data.";
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    void loadStatic();
    void loadMatch();
    const pollId = window.setInterval(() => {
      void loadMatch();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [matchId]);

  const mapsById = useMemo(() => {
    const result = new Map<number, AdminGameMap>();
    for (const map of maps) {
      result.set(map.id, map);
    }
    return result;
  }, [maps]);

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

  const bestOf = match?.bestOf ?? 5;
  const rounds = useMemo(
    () => winnerCardRounds(bestOf, draft?.actions, match?.mapResults),
    [bestOf, draft, match?.mapResults]
  );

  const weekText = match?.semanas && match.semanas > 0 ? String(match.semanas) : "?";
  const teamAReady = match?.teamAready === 1;
  const teamBReady = match?.teamBready === 1;
  const bothReady = teamAReady && teamBReady;
  const completedGames = match?.gameNumber || 0;
  const currentGame = completedGames + 1;
  const isFinished = match?.status === "FINISHED";

  const seriesLeader =
    !match || match.mapWinsTeamA === match.mapWinsTeamB
      ? null
      : match.mapWinsTeamA > match.mapWinsTeamB
        ? match.teamAId
        : match.teamBId;

  if (loading && !match) {
    return (
      <div className={styles.statusScreen}>
        <BrandField variant="zone" intensity={0.85} motion="calm" />
        <div className={styles.statusInner}>
          <p className={styles.statusKicker}>Overtime Productions</p>
          <p className={styles.statusTitle}>Loading Wincards</p>
          <p className={styles.statusHint}>Match {matchId}</p>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className={styles.statusScreen}>
        <BrandField variant="zone" intensity={0.85} motion="calm" />
        <div className={styles.statusInner}>
          <p className={styles.statusKicker}>Overtime Productions</p>
          <p className={styles.statusTitle}>Wincards Unavailable</p>
          <p className={styles.statusHint}>{error || `Match ${matchId} was not found.`}</p>
        </div>
      </div>
    );
  }

  const winSide = (winnerTeam: Team | undefined) =>
    winnerTeam ? (winnerTeam.id === match.teamAId ? "a" : "b") : "none";

  const teamInitial = (team: Team | null | undefined) =>
    (team?.name || "?").charAt(0).toUpperCase();

  /*
   * Team logos are absolute URLs stored per team, so a host that is briefly
   * unreachable would otherwise put a broken-image icon on the broadcast. A
   * logo that fails to load falls back to the initial for the rest of the
   * session rather than retrying on every poll.
   */
  const usableLogo = (team: Team | null | undefined) => {
    const url = teamAssetUrl(team?.logo);
    return url && !failedLogos.has(url) ? url : null;
  };

  const renderWinBadge = (winnerTeam: Team | undefined, gameNumber: number) => {
    if (!winnerTeam) return null;
    const side = winSide(winnerTeam);
    const logoUrl = usableLogo(winnerTeam);

    return (
      <div className={styles.winBadge} data-side={side}>
        <div className={styles.winBadgeRing}>
          {logoUrl ? (
            <img
              className={styles.winBadgeLogo}
              src={logoUrl}
              alt={`${winnerTeam.name} won game ${gameNumber}`}
              onError={() => markLogoFailed(logoUrl)}
            />
          ) : (
            <span className={styles.winBadgeInitial}>{teamInitial(winnerTeam)}</span>
          )}
        </div>
        <span className={styles.winBadgeCheck} aria-hidden>
          ✓
        </span>
      </div>
    );
  };

  const renderWinRibbon = (winnerTeam: Team | undefined) => {
    if (!winnerTeam) return null;
    const side = winSide(winnerTeam);

    return (
      <span className={styles.winRibbon} data-side={side}>
        Map win · {winnerTeam.name}
      </span>
    );
  };

  const renderTeamMark = (team: Team | null, side: "a" | "b") => {
    const logoUrl = usableLogo(team);

    return (
    <div className={styles.scoreTeam} data-side={side}>
      <div className={styles.scoreLogoFrame}>
        {logoUrl ? (
          <img
            className={styles.scoreLogo}
            src={logoUrl}
            alt=""
            onError={() => markLogoFailed(logoUrl)}
          />
        ) : (
          <span className={styles.scoreLogoFallback}>{teamInitial(team)}</span>
        )}
      </div>
      <span className={styles.scoreTeamName}>{team?.name || (side === "a" ? "Team A" : "Team B")}</span>
      {seriesLeader && team ? (
        <span className={styles.scoreTag} data-lead={seriesLeader === team.id ? "true" : "false"}>
          {seriesLeader === team.id ? (isFinished ? "Victory" : "Ahead") : isFinished ? "Defeat" : "Behind"}
        </span>
      ) : (
        <span className={styles.scoreTag} data-lead="false">
          {isFinished ? "Draw" : "Level"}
        </span>
      )}
    </div>
    );
  };

  return (
    <div className={styles.root}>
      <BrandField variant="zone" intensity={0.85} motion="calm" />

      <aside className={styles.rail}>
        <span className={styles.kicker}>Overtime Productions</span>
        <h1 className={styles.title}>
          Week <span className={styles.titleNumber}>{weekText}</span>
        </h1>
        <div className={styles.rule} aria-hidden />

        <div className={styles.resultBlock}>
          <span className={styles.resultLabel}>Match result</span>
          <div className={styles.scoreRow}>
            {renderTeamMark(teamA, "a")}
            <div className={styles.scoreValue}>
              <span className={styles.scoreNumber} data-side="a">
                {match.mapWinsTeamA}
              </span>
              <span className={styles.scoreDash} aria-hidden />
              <span className={styles.scoreNumber} data-side="b">
                {match.mapWinsTeamB}
              </span>
            </div>
            {renderTeamMark(teamB, "b")}
          </div>
        </div>

        <div className={styles.waitStrip} data-ready={bothReady ? "true" : "false"}>
          <span className={styles.waitLabel}>
            {isFinished
              ? "Series complete"
              : bothReady
                ? `Game ${currentGame} · captains ready`
                : "Waiting for captains"}
          </span>
          {!isFinished && (
            <div className={styles.pips}>
              <span className={styles.pip} data-side="a" data-on={teamAReady ? "true" : "false"} />
              <span className={styles.pip} data-side="b" data-on={teamBReady ? "true" : "false"} />
            </div>
          )}
        </div>
      </aside>

      <section
        className={styles.fan}
        style={{ "--wincards-columns": rounds.length } as React.CSSProperties}
      >
        {rounds.map(({ gameNumber, mapId, winnerId }) => {
          const map = mapId === null ? undefined : mapsById.get(mapId);
          const winner = winnerId === null ? undefined : teamsById.get(winnerId);
          const isCurrent = !isFinished && gameNumber === currentGame;
          const isPlayed = gameNumber <= completedGames;

          return (
            <article
              key={gameNumber}
              className={styles.column}
              data-state={isCurrent ? "current" : isPlayed ? "played" : "pending"}
            >
              <header className={styles.columnHeader}>
                <span className={styles.columnGame}>Game {gameNumber}</span>
                {map && (
                  <span className={styles.columnTitle}>{map.type === "PAYLOAD" ? "ESCORT" : map.type}</span>
                )}
              </header>
              <div className={styles.stack}>
                <div className={styles.cardFrame} data-won={winSide(winner)}>
                  <div className={styles.cardInner}>
                    {mapId === null ? (
                      <div className={styles.pendingInner}>
                        <span className={styles.pendingMark} aria-hidden>?</span>
                        <span className={styles.pendingText}>Incognito</span>
                      </div>
                    ) : (
                      <>
                        {map?.imgPath && (
                          <img className={styles.cardImage} src={resolveMapImageUrl(map.imgPath)} alt="" />
                        )}
                        <div className={styles.cardShade} aria-hidden />
                        <span className={styles.cardLabel}>{map?.description ?? `Map ${mapId}`}</span>
                      </>
                    )}
                    {renderWinBadge(winner, gameNumber)}
                    {renderWinRibbon(winner)}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <footer className={styles.footer}>
        <span className={styles.footerTicks} aria-hidden />
        <span className={styles.footerText}>
          Best of {match.bestOf} · {completedGames} of {rounds.length} played
        </span>
      </footer>
    </div>
  );
}
