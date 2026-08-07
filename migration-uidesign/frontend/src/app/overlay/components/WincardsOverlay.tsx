"use client";

import { useEffect, useMemo, useState } from "react";
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

const POLL_INTERVAL_MS = 10000;

const isControl = (type: AdminGameMap["type"]) => type === "CONTROL";
const isHybrid = (type: AdminGameMap["type"]) => type === "HYBRID";
const isPayload = (type: AdminGameMap["type"]) => type === "PAYLOAD";
const isPushOrFlash = (type: AdminGameMap["type"]) =>
  type === "PUSH" || type === "FLASHPOINT";

// Best of 5: round robin and playoff rounds 1-2.
const COLUMNS: ColumnDefinition[] = [
  { key: "1", title: "CONTROL", accepts: isControl },
  { key: "2", title: "HYBRID", accepts: isHybrid },
  { key: "3", title: "PAYLOAD", accepts: isPayload },
  { key: "4", title: "PUSH/FLASH", accepts: isPushOrFlash },
  { key: "5", title: "CONTROL", accepts: isControl, includeIncognito: true },
];

// Best of 7 cycle for the Grand Final:
// control, hybrid, payload, push/flash, control, hybrid, push/flash.
const FINALS_COLUMNS: ColumnDefinition[] = [
  { key: "1", title: "CONTROL", accepts: isControl },
  { key: "2", title: "HYBRID", accepts: isHybrid },
  { key: "3", title: "PAYLOAD", accepts: isPayload },
  { key: "4", title: "PUSH/FLASH", accepts: isPushOrFlash },
  { key: "5", title: "CONTROL", accepts: isControl },
  { key: "6", title: "HYBRID", accepts: isHybrid },
  { key: "7", title: "PUSH/FLASH", accepts: isPushOrFlash },
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

  useEffect(() => {
    if (!Number.isInteger(matchId) || matchId <= 0) {
      setLoading(false);
      setError("Invalid match id.");
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const [loadedMatch, loadedMaps, loadedTeams] = await Promise.all([
          getMatchById(matchId),
          getMaps(),
          getTeams(),
        ]);

        if (cancelled) return;
        setMatch(loadedMatch);
        setMaps(loadedMaps);
        setTeams(loadedTeams);
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
    void load();
    const pollId = window.setInterval(() => {
      void load();
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

  if (loading) {
    return (
      <div className={styles.statusScreen}>
        <div>
          <p className={styles.statusTitle}>Loading Wincards</p>
          <p className={styles.statusHint}>Match {matchId}</p>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className={styles.statusScreen}>
        <div>
          <p className={styles.statusTitle}>Wincards Unavailable</p>
          <p className={styles.statusHint}>{error || `Match ${matchId} was not found.`}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <header className={styles.titleBar}>
        <div className={styles.decorTop} aria-hidden />

        <div className={styles.scoreRow}>
          <div className={styles.teamSide}>
            <div className={styles.bannerFrame}>
              {teamA?.bannerLeft ? (
                <img className={styles.teamBanner} src={teamAssetUrl(teamA.bannerLeft)} alt="" />
              ) : (
                <div className={styles.assetFallback}>BANNER</div>
              )}
            </div>
          </div>

          <div className={styles.scoreBlock}>
            <span className={styles.scoreText}>{match.mapWinsTeamA}</span>
            <span className={styles.vsText}>VS</span>
            <span className={styles.scoreText}>{match.mapWinsTeamB}</span>
          </div>

          <div className={styles.teamSide}>
            <div className={styles.bannerFrame}>
              {teamB?.bannerRight ? (
                <img className={styles.teamBanner} src={teamAssetUrl(teamB.bannerRight)} alt="" />
              ) : (
                <div className={styles.assetFallback}>BANNER</div>
              )}
            </div>
          </div>
        </div>
      </header>

      <section
        className={clsx(styles.grid, isBracket && styles.playoffGrid)}
        style={{ "--wincards-columns": columns.length } as React.CSSProperties}
      >
        {columns.map((column) => {
          if (isBracket) {
            const gameNumber = Number(column.key);
            const pickedMap = playoffMaps[column.key];
            const winnerTeamId = winnerByGame.get(gameNumber);
            const winnerTeam = winnerTeamId ? teamsById.get(winnerTeamId) : undefined;

            return (
              <article key={column.key} className={clsx(styles.column, styles.playoffColumn)}>
                <h2 className={styles.columnHeader}>{column.title}</h2>
                <div className={styles.mapStack}>
                  <div
                    className={clsx(
                      styles.mapTile,
                      styles.playoffMapTile,
                      !pickedMap && styles.playoffPendingTile
                    )}
                  >
                    {pickedMap ? (
                      <>
                        <img
                          className={styles.mapImage}
                          src={resolveMapImageUrl(pickedMap.imgPath)}
                          alt={pickedMap.description}
                        />
                        <span className={styles.mapLabel}>{pickedMap.description}</span>
                      </>
                    ) : (
                      <div className={styles.playoffPendingInner}>
                        <span className={styles.playoffGameLabel}>GAME {gameNumber}</span>
                        <span className={styles.questionMark}>?</span>
                        <span className={styles.incognitoText}>Map pick pending</span>
                      </div>
                    )}

                    {winnerTeam?.logo ? (
                      <div className={styles.winnerLogoWrap}>
                        <img
                          className={styles.winnerLogo}
                          src={teamAssetUrl(winnerTeam.logo)}
                          alt={`${winnerTeam.name} won game ${gameNumber}`}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          }

          const columnMaps = roundMaps[column.key];
          return (
            <article key={column.key} className={styles.column}>
              <h2 className={styles.columnHeader}>{column.title}</h2>

              <div className={styles.mapStack}>
                {columnMaps.length > 0 ? (
                  columnMaps.map((map) => {
                    const winnerTeamId = winnerByMapId.get(map.id);
                    const winnerTeam = winnerTeamId ? teamsById.get(winnerTeamId) : undefined;

                    return (
                      <div key={`${column.key}-${map.id}`} className={styles.mapTile}>
                        <img
                          className={styles.mapImage}
                          src={resolveMapImageUrl(map.imgPath)}
                          alt={map.description}
                        />
                        <span className={styles.mapLabel}>{map.description}</span>
                        {winnerTeam?.logo ? (
                          <div className={styles.winnerLogoWrap}>
                            <img
                              className={styles.winnerLogo}
                              src={teamAssetUrl(winnerTeam.logo)}
                              alt=""
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.emptyState}>No maps</div>
                )}

                {column.includeIncognito ? (
                  <div className={clsx(styles.mapTile, styles.incognitoTile)}>
                    {incognitoRevealMap ? (
                      <>
                        <img
                          className={styles.mapImage}
                          src={resolveMapImageUrl(incognitoRevealMap.imgPath)}
                          alt={incognitoRevealMap.description}
                        />
                        <span className={styles.mapLabel}>{incognitoRevealMap.description}</span>
                      </>
                    ) : (
                      <div className={styles.incognitoInner}>
                        <span className={styles.questionMark}>?</span>
                        <span className={styles.incognitoText}>Pending Game 1 Pick</span>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
