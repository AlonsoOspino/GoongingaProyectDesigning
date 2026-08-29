"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { getMaps, getMatchById, type AdminGameMap } from "@/lib/api/admin";
import { getTeams } from "@/lib/api/team";
import type { DraftState, Match, Team } from "@/lib/api/types";
import { resolveGenericBackendAsset, resolveMapImageUrl } from "@/lib/assetUrls";
import styles from "./wincards-overlay.module.css";

interface WincardsOverlayProps {
  matchId: number;
}

type ColumnKey = "1" | "2" | "3" | "4" | "5" | "6" | "7";

interface ColumnDefinition {
  key: ColumnKey;
  title: string;
  accepts: (type: AdminGameMap["type"]) => boolean;
  includeIncognito?: boolean;
}

type DraftPickState = Pick<DraftState, "actions">;
type MatchWithDraft = Match & { draft?: DraftPickState | null };

// Between maps this overlay reports which captains have checked in, so the
// poll has to keep up with a captain clicking ready rather than with a
// scoreboard that changes twice an hour.
const POLL_INTERVAL_MS = 2500;

const isControl = (type: AdminGameMap["type"]) => type === "CONTROL";
const isHybrid = (type: AdminGameMap["type"]) => type === "HYBRID";
const isPayload = (type: AdminGameMap["type"]) => type === "PAYLOAD";
const isPushOrFlash = (type: AdminGameMap["type"]) =>
  type === "PUSH" || type === "FLASHPOINT";
const isPush = (type: AdminGameMap["type"]) => type === "PUSH";
const isFlashpoint = (type: AdminGameMap["type"]) => type === "FLASHPOINT";

// Best of 5: round robin and playoff rounds 1-2.
const COLUMNS: ColumnDefinition[] = [
  { key: "1", title: "CONTROL", accepts: isControl },
  { key: "2", title: "HYBRID", accepts: isHybrid },
  { key: "3", title: "PAYLOAD", accepts: isPayload },
  { key: "4", title: "PUSH/FLASH", accepts: isPushOrFlash },
  { key: "5", title: "CONTROL", accepts: isControl, includeIncognito: true },
];

// Best of 7 cycle for the Grand Final:
// control, hybrid, payload, push, flashpoint, control, hybrid.
const FINALS_COLUMNS: ColumnDefinition[] = [
  { key: "1", title: "CONTROL", accepts: isControl },
  { key: "2", title: "HYBRID", accepts: isHybrid },
  { key: "3", title: "PAYLOAD", accepts: isPayload },
  { key: "4", title: "PUSH", accepts: isPush },
  { key: "5", title: "FLASHPOINT", accepts: isFlashpoint },
  { key: "6", title: "CONTROL", accepts: isControl },
  { key: "7", title: "HYBRID", accepts: isHybrid },
];

const isBracketMatchType = (type?: Match["type"]) =>
  type === "PLAYOFFS" || type === "FINALS";

const getColumnsForMatch = (type?: Match["type"]) =>
  type === "FINALS" ? FINALS_COLUMNS : COLUMNS;

const emptyRecord = <T,>(columns: ColumnDefinition[], value: () => T) => {
  const result = {} as Record<ColumnKey, T>;
  for (const column of columns) {
    result[column.key] = value();
  }
  return result;
};

function parseRoundMapIds(match: Match | null, roundKey: ColumnKey): number[] {
  const source = match?.mapsAllowedByRound;
  if (!source || typeof source !== "object") return [];
  const rawIds = source[roundKey];
  if (!Array.isArray(rawIds)) return [];

  const ids: number[] = [];
  const seen = new Set<number>();

  for (const rawId of rawIds) {
    const parsedId = Number(rawId);
    if (!Number.isInteger(parsedId) || parsedId <= 0 || seen.has(parsedId)) {
      continue;
    }
    seen.add(parsedId);
    ids.push(parsedId);
  }

  return ids;
}

function getGameOnePick(draft: DraftPickState | null): number | null {
  const gameOnePick = draft?.actions?.find(
    (action) => action.action === "PICK" && action.gameNumber === 1
  );
  if (!gameOnePick) return null;
  const mapId = Number(gameOnePick.value);
  return Number.isInteger(mapId) && mapId > 0 ? mapId : null;
}

function getGamePick(draft: DraftPickState | null, gameNumber: number): number | null {
  const pick = draft?.actions?.find(
    (action) => action.action === "PICK" && action.gameNumber === gameNumber
  );
  const mapId = Number(pick?.value);
  return Number.isInteger(mapId) && mapId > 0 ? mapId : null;
}

function buildWinnerMap(match: Match | null, maxGames: number): Map<number, number> {
  const winners = new Map<number, number>();
  if (!Array.isArray(match?.mapResults)) return winners;

  for (const result of match.mapResults) {
    const gameNumber = Number(result.gameNumber);
    const mapId = Number(result.mapId);
    const winnerTeamId = Number(result.winnerTeamId);
    if (!Number.isInteger(gameNumber) || gameNumber < 1 || gameNumber > maxGames) continue;
    if (!Number.isInteger(mapId) || mapId <= 0) continue;
    if (!Number.isInteger(winnerTeamId) || winnerTeamId <= 0) continue;
    winners.set(mapId, winnerTeamId);
  }

  return winners;
}

function buildWinnerByGame(match: Match | null, maxGames: number): Map<number, number> {
  const winners = new Map<number, number>();
  if (!Array.isArray(match?.mapResults)) return winners;

  for (const result of match.mapResults) {
    const gameNumber = Number(result.gameNumber);
    const winnerTeamId = Number(result.winnerTeamId);
    if (!Number.isInteger(gameNumber) || gameNumber < 1 || gameNumber > maxGames) continue;
    if (!Number.isInteger(winnerTeamId) || winnerTeamId <= 0) continue;
    winners.set(gameNumber, winnerTeamId);
  }

  return winners;
}

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
        const [loadedMaps, loadedTeams] = await Promise.all([getMaps(), getTeams()]);
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

  // The Grand Final is a best of 7, every other match is a best of 5.
  const columns = useMemo(() => getColumnsForMatch(match?.type), [match?.type]);
  const isBracket = isBracketMatchType(match?.type);

  const winnerByMapId = useMemo(
    () => buildWinnerMap(match, columns.length),
    [match, columns.length]
  );
  const winnerByGame = useMemo(
    () => buildWinnerByGame(match, columns.length),
    [match, columns.length]
  );

  const playoffMaps = useMemo(() => {
    const result = emptyRecord<AdminGameMap | null>(columns, () => null);
    if (!isBracket) return result;

    for (const column of columns) {
      const mapId = getGamePick(draft, Number(column.key));
      result[column.key] = mapId ? mapsById.get(mapId) ?? null : null;
    }
    return result;
  }, [draft, isBracket, mapsById, columns]);

  const roundMaps = useMemo(() => {
    const result = emptyRecord<AdminGameMap[]>(columns, () => []);

    for (const column of columns) {
      const ids = parseRoundMapIds(match, column.key);
      const filteredMaps = ids
        .map((id) => mapsById.get(id))
        .filter((map): map is AdminGameMap => Boolean(map))
        .filter((map) => column.accepts(map.type));

      result[column.key] =
        column.includeIncognito && filteredMaps.length > 0
          ? [filteredMaps[0]]
          : filteredMaps;
    }

    return result;
  }, [match, mapsById, columns]);

  // Only round robin hides a game 5 control map behind an incognito tile.
  const incognitoRevealMap = useMemo(() => {
    if (isBracket) return null;
    const gameOnePickId = getGameOnePick(draft);
    if (!gameOnePickId) return null;

    const designatedGameFiveMapId = roundMaps["5"]?.[0]?.id ?? null;
    const gameOneControlPool = roundMaps["1"] ?? [];
    const globalControlPool = maps.filter((map) => map.type === "CONTROL");
    const sourcePool = gameOneControlPool.length > 0 ? gameOneControlPool : globalControlPool;

    const notDraftedOnGameOne = sourcePool.filter((map) => map.id !== gameOnePickId);
    const notDuplicatingGameFive = notDraftedOnGameOne.find(
      (map) => map.id !== designatedGameFiveMapId
    );

    if (notDuplicatingGameFive) {
      return notDuplicatingGameFive;
    }

    return notDraftedOnGameOne[0] ?? null;
  }, [draft, maps, roundMaps, isBracket]);

  const weekText =
    match?.semanas && Number.isFinite(match.semanas) && match.semanas > 0
      ? String(match.semanas)
      : "?";

  // The strip that replaces the old standalone waiting screen. Between maps the
  // manager has marked a winner and the captains have not checked in yet, so
  // the cards stay on screen and this reports what everyone is waiting on.
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
      <div className={styles.field} aria-hidden />

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
        className={clsx(styles.fan, isBracket && styles.bracketFan)}
        style={{ "--wincards-columns": columns.length } as React.CSSProperties}
      >
        {columns.map((column) => {
          const gameNumber = Number(column.key);
          const isPlayed = Number.isFinite(gameNumber) && gameNumber <= completedGames;
          const isCurrent =
            !isFinished && Number.isFinite(gameNumber) && gameNumber === currentGame;

          if (isBracket) {
            const pickedMap = playoffMaps[column.key];
            const winnerTeamId = winnerByGame.get(gameNumber);
            const winnerTeam = winnerTeamId ? teamsById.get(winnerTeamId) : undefined;

            return (
              <article
                key={column.key}
                className={styles.column}
                data-state={isCurrent ? "current" : isPlayed ? "played" : "pending"}
              >
                <header className={styles.columnHeader}>
                  <span className={styles.columnGame}>Game {gameNumber}</span>
                  <span className={styles.columnTitle}>{column.title}</span>
                </header>

                <div className={styles.stack}>
                  <div className={styles.cardFrame} data-won={winSide(winnerTeam)}>
                    <div className={styles.cardInner}>
                      {pickedMap ? (
                        <>
                          <img
                            className={styles.cardImage}
                            src={resolveMapImageUrl(pickedMap.imgPath)}
                            alt={pickedMap.description}
                          />
                          <div className={styles.cardShade} aria-hidden />
                          <span className={styles.cardLabel}>{pickedMap.description}</span>
                        </>
                      ) : (
                        <div className={styles.pendingInner}>
                          <span className={styles.pendingMark}>?</span>
                          <span className={styles.pendingText}>Map pick pending</span>
                        </div>
                      )}

                      {renderWinBadge(winnerTeam, gameNumber)}
                      {renderWinRibbon(winnerTeam)}
                    </div>
                  </div>
                </div>
              </article>
            );
          }

          const columnMaps = roundMaps[column.key];

          return (
            <article
              key={column.key}
              className={styles.column}
              data-state={isCurrent ? "current" : isPlayed ? "played" : "pending"}
            >
              <header className={styles.columnHeader}>
                <span className={styles.columnGame}>Game {gameNumber}</span>
                <span className={styles.columnTitle}>{column.title}</span>
              </header>

              <div className={styles.stack}>
                {columnMaps.length > 0 ? (
                  columnMaps.map((map) => {
                    const winnerTeamId = winnerByMapId.get(map.id);
                    const winnerTeam = winnerTeamId ? teamsById.get(winnerTeamId) : undefined;

                    return (
                      <div
                        key={`${column.key}-${map.id}`}
                        className={styles.cardFrame}
                        data-won={winSide(winnerTeam)}
                      >
                        <div className={styles.cardInner}>
                          <img
                            className={styles.cardImage}
                            src={resolveMapImageUrl(map.imgPath)}
                            alt={map.description}
                          />
                          <div className={styles.cardShade} aria-hidden />
                          <span className={styles.cardLabel}>{map.description}</span>
                          {renderWinBadge(winnerTeam, gameNumber)}
                          {renderWinRibbon(winnerTeam)}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.emptyCard}>
                    <span>No maps</span>
                  </div>
                )}

                {column.includeIncognito ? (
                  <div className={styles.cardFrame} data-won="none">
                    <div className={styles.cardInner}>
                      {incognitoRevealMap ? (
                        <>
                          <img
                            className={styles.cardImage}
                            src={resolveMapImageUrl(incognitoRevealMap.imgPath)}
                            alt={incognitoRevealMap.description}
                          />
                          <div className={styles.cardShade} aria-hidden />
                          <span className={styles.cardLabel}>{incognitoRevealMap.description}</span>
                        </>
                      ) : (
                        <div className={styles.pendingInner}>
                          <span className={styles.pendingMark}>?</span>
                          <span className={styles.pendingText}>Pending game 1 pick</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      <footer className={styles.footer}>
        <span className={styles.footerTicks} aria-hidden />
        <span className={styles.footerText}>
          Best of {match.bestOf} · {completedGames} of {columns.length} played
        </span>
      </footer>
    </div>
  );
}
