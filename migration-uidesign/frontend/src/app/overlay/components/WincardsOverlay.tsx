"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { getMaps, getMatchById, type AdminGameMap } from "@/lib/api/admin";
import { getDraftByMatchId } from "@/lib/api/draft";
import { getTeams } from "@/lib/api/team";
import type { DraftState, Match, Team } from "@/lib/api/types";
import { resolveGenericBackendAsset, resolveMapImageUrl } from "@/lib/assetUrls";
import styles from "./wincards-overlay.module.css";

interface WincardsOverlayProps {
  matchId: number;
}

type ColumnKey = "1" | "2" | "3" | "4" | "5";

interface ColumnDefinition {
  key: ColumnKey;
  title: string;
  accepts: (type: AdminGameMap["type"]) => boolean;
  includeIncognito?: boolean;
}

const POLL_INTERVAL_MS = 10000;

const COLUMNS: ColumnDefinition[] = [
  {
    key: "1",
    title: "CONTROL",
    accepts: (type) => type === "CONTROL",
  },
  {
    key: "2",
    title: "HYBRID",
    accepts: (type) => type === "HYBRID",
  },
  {
    key: "3",
    title: "ESCORT",
    accepts: (type) => type === "PAYLOAD",
  },
  {
    key: "4",
    title: "PUSH/FLASH",
    accepts: (type) => type === "PUSH" || type === "FLASHPOINT",
  },
  {
    key: "5",
    title: "CONTROL",
    accepts: (type) => type === "CONTROL",
    includeIncognito: true,
  },
];

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

function getGameOnePick(draft: DraftState | null): number | null {
  const gameOnePick = draft?.actions?.find(
    (action) => action.action === "PICK" && action.gameNumber === 1
  );
  if (!gameOnePick) return null;
  const mapId = Number(gameOnePick.value);
  return Number.isInteger(mapId) && mapId > 0 ? mapId : null;
}

function buildWinnerMap(match: Match | null): Map<number, number> {
  const winners = new Map<number, number>();
  if (!Array.isArray(match?.mapResults)) return winners;

  for (const result of match.mapResults) {
    const gameNumber = Number(result.gameNumber);
    const mapId = Number(result.mapId);
    const winnerTeamId = Number(result.winnerTeamId);
    if (!Number.isInteger(gameNumber) || gameNumber < 1 || gameNumber > 5) continue;
    if (!Number.isInteger(mapId) || mapId <= 0) continue;
    if (!Number.isInteger(winnerTeamId) || winnerTeamId <= 0) continue;
    winners.set(mapId, winnerTeamId);
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
  const [draft, setDraft] = useState<DraftState | null>(null);
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
        const [loadedMatch, loadedMaps, loadedTeams, loadedDraft] = await Promise.all([
          getMatchById(matchId),
          getMaps(),
          getTeams(),
          getDraftByMatchId(matchId).catch(() => null),
        ]);

        if (cancelled) return;
        setMatch(loadedMatch);
        setMaps(loadedMaps);
        setTeams(loadedTeams);
        setDraft(loadedDraft);
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

  const winnerByMapId = useMemo(() => buildWinnerMap(match), [match]);

  const roundMaps = useMemo(() => {
    const result: Record<ColumnKey, AdminGameMap[]> = {
      "1": [],
      "2": [],
      "3": [],
      "4": [],
      "5": [],
    };

    for (const column of COLUMNS) {
      const ids = parseRoundMapIds(match, column.key);
      const filteredMaps = ids
        .map((id) => mapsById.get(id))
        .filter((map): map is AdminGameMap => Boolean(map))
        .filter((map) => column.accepts(map.type));

      result[column.key] =
        column.key === "5" && filteredMaps.length > 0
          ? [filteredMaps[0]]
          : filteredMaps;
    }

    return result;
  }, [match, mapsById]);

  const incognitoRevealMap = useMemo(() => {
    const gameOnePickId = getGameOnePick(draft);
    if (!gameOnePickId) return null;

    const designatedGameFiveMapId = roundMaps["5"][0]?.id ?? null;
    const gameOneControlPool = roundMaps["1"];
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
  }, [draft, maps, roundMaps]);

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

      <section className={styles.grid}>
        {COLUMNS.map((column) => {
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
