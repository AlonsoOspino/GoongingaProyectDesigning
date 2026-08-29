"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { getMaps, getMatchById, type AdminGameMap } from "@/lib/api/admin";
import type { MapType, Match } from "@/lib/api/types";
import { resolveMapImageUrl } from "@/lib/assetUrls";
import styles from "./map-pool-overlay.module.css";

type OverlayVariant = "classic" | "clean";

interface MapPoolOverlayProps {
  matchId: number;
  variant?: OverlayVariant;
}

interface ColumnDefinition {
  key: "CONTROL" | "HYBRID" | "ESCORT" | "PUSH_FLASH";
  title: string;
  /** The value the manager writes when focusing this column. */
  focusType: MapType;
  accepts: (type: AdminGameMap["type"]) => boolean;
}

/*
 * The manager drives this overlay from the dashboard, so the poll has to feel
 * like a click rather than a refresh. The map catalogue never changes during a
 * broadcast, so it is fetched once and only the match row is polled.
 */
const MATCH_POLL_INTERVAL_MS = 1200;

const COLUMNS: ColumnDefinition[] = [
  { key: "CONTROL", title: "CONTROL", focusType: "CONTROL", accepts: (type) => type === "CONTROL" },
  { key: "HYBRID", title: "HYBRID", focusType: "HYBRID", accepts: (type) => type === "HYBRID" },
  { key: "ESCORT", title: "ESCORT", focusType: "PAYLOAD", accepts: (type) => type === "PAYLOAD" },
  {
    key: "PUSH_FLASH",
    title: "PUSH / FLASH",
    focusType: "PUSH",
    accepts: (type) => type === "PUSH" || type === "FLASHPOINT",
  },
];

/** A focused PUSH or FLASHPOINT both light up the shared fourth column. */
function columnMatchesFocus(column: ColumnDefinition, focusType: MapType | null | undefined) {
  if (!focusType) return false;
  if (column.key === "PUSH_FLASH") return focusType === "PUSH" || focusType === "FLASHPOINT";
  return column.focusType === focusType;
}

function sortRoundKeys(a: string, b: string) {
  const aNum = Number(a);
  const bNum = Number(b);

  const aIsNum = Number.isFinite(aNum);
  const bIsNum = Number.isFinite(bNum);

  if (aIsNum && bIsNum) return aNum - bNum;
  if (aIsNum) return -1;
  if (bIsNum) return 1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function extractMapPoolIds(match: Match | null) {
  const source = match?.mapsAllowedByRound;
  if (!source || typeof source !== "object") return [];

  const orderedEntries = Object.entries(source).sort(([a], [b]) => sortRoundKeys(a, b));
  const orderedIds: number[] = [];
  const seen = new Set<number>();

  for (const [, ids] of orderedEntries) {
    if (!Array.isArray(ids)) continue;
    for (const rawId of ids) {
      const parsedId = Number(rawId);
      if (!Number.isInteger(parsedId) || parsedId <= 0 || seen.has(parsedId)) continue;
      seen.add(parsedId);
      orderedIds.push(parsedId);
    }
  }

  return orderedIds;
}

export function MapPoolOverlay({ matchId, variant = "classic" }: MapPoolOverlayProps) {
  const [match, setMatch] = useState<Match | null>(null);
  const [maps, setMaps] = useState<AdminGameMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // A poll that fails mid-broadcast must not blank the screen: keep the last
  // good frame and only surface an error before anything has ever loaded.
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!Number.isInteger(matchId) || matchId <= 0) {
      setLoading(false);
      setError("Invalid match id.");
      return;
    }

    let cancelled = false;
    hasLoadedRef.current = false;

    const loadMatch = async () => {
      try {
        const loadedMatch = await getMatchById(matchId);
        if (cancelled) return;
        setMatch(loadedMatch);
        hasLoadedRef.current = true;
        setError(null);
      } catch (fetchError) {
        if (cancelled || hasLoadedRef.current) return;
        setError(
          fetchError instanceof Error ? fetchError.message : "Failed to load map pool overlay data."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const loadMaps = async () => {
      try {
        const loadedMaps = await getMaps();
        if (!cancelled) setMaps(loadedMaps);
      } catch {
        // The match poll surfaces the outage; a missing catalogue just renders
        // an empty pool rather than a second error screen.
      }
    };

    setLoading(true);
    void loadMaps();
    void loadMatch();

    const pollId = window.setInterval(() => {
      void loadMatch();
    }, MATCH_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [matchId]);

  const mapPoolIds = useMemo(() => extractMapPoolIds(match), [match]);

  const mapsById = useMemo(() => {
    const pairs = maps.map((map) => [map.id, map] as const);
    return new Map<number, AdminGameMap>(pairs);
  }, [maps]);

  const mapPoolMaps = useMemo(
    () =>
      mapPoolIds
        .map((id) => mapsById.get(id))
        .filter((map): map is AdminGameMap => Boolean(map)),
    [mapPoolIds, mapsById]
  );

  const focusType = match?.overlayFocusType ?? null;
  const focusMapId = match?.overlayFocusMapId ?? null;

  const columns = useMemo(
    () =>
      COLUMNS.map((column) => ({
        ...column,
        maps: mapPoolMaps.filter((map) => column.accepts(map.type)),
        focused: columnMatchesFocus(column, focusType),
      })),
    [mapPoolMaps, focusType]
  );

  const focusedColumn = columns.find((column) => column.focused) ?? null;
  const heroMap =
    focusMapId != null
      ? focusedColumn?.maps.find((map) => map.id === focusMapId) ?? null
      : null;

  /*
   * The expansion is a grid-template-columns transition, which Chromium
   * animates and OBS is Chromium. Weights rather than fixed widths, so the fan
   * keeps filling the frame whatever the pool looks like.
   */
  const templateColumns = focusedColumn
    ? columns.map((column) => (column.focused ? "2.2fr" : "0.6fr")).join(" ")
    : columns.map(() => "1fr").join(" ");

  const weekText =
    match?.semanas && Number.isFinite(match.semanas) && match.semanas > 0
      ? String(match.semanas)
      : "?";

  if (loading && !match) {
    return (
      <div className={styles.statusScreen}>
        <div className={styles.statusInner}>
          <p className={styles.statusKicker}>Overtime Productions</p>
          <p className={styles.statusTitle}>Loading Map Pool</p>
          <p className={styles.statusHint}>Match {matchId}</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className={styles.statusScreen}>
        <div className={styles.statusInner}>
          <p className={styles.statusKicker}>Overtime Productions</p>
          <p className={styles.statusTitle}>Map Pool Unavailable</p>
          <p className={styles.statusHint}>{error || `Match ${matchId} was not found.`}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(styles.root, variant === "clean" ? styles.clean : styles.classic)}
      data-focused={focusedColumn ? "true" : "false"}
    >
      <div className={styles.field} aria-hidden />

      <aside className={styles.rail}>
        <span className={styles.kicker}>Overtime Productions</span>
        <h1 className={styles.title}>
          Week <span className={styles.titleNumber}>{weekText}</span>
        </h1>
        <div className={styles.rule} aria-hidden />

        <div className={styles.railMeta}>
          <span className={styles.metaLabel}>Map pool</span>
          <span className={styles.metaValue}>
            {mapPoolMaps.length} {mapPoolMaps.length === 1 ? "map" : "maps"}
          </span>
        </div>

        {focusedColumn ? (
          <div className={styles.focusPlate} key={focusedColumn.key}>
            <span className={styles.focusLabel}>Now showing</span>
            <span className={styles.focusValue}>{focusedColumn.title}</span>
            {heroMap ? <span className={styles.focusMap}>{heroMap.description}</span> : null}
          </div>
        ) : (
          <div className={styles.idlePlate}>
            <span className={styles.focusLabel}>All modes</span>
            <span className={styles.idleValue}>In rotation</span>
          </div>
        )}

        <div className={styles.railTicks} aria-hidden>
          <span />
          <span />
          <span />
        </div>
      </aside>

      <section className={styles.fan} style={{ gridTemplateColumns: templateColumns }}>
        {columns.map((column) => (
          <article
            key={column.key}
            className={styles.column}
            data-state={!focusedColumn ? "idle" : column.focused ? "active" : "dim"}
          >
            <header className={styles.columnHeader}>
              <span className={styles.columnTitle}>{column.title}</span>
              <span className={styles.columnCount}>{column.maps.length}</span>
            </header>

            <div className={styles.stack}>
              {column.maps.length > 0 ? (
                column.maps.map((map) => {
                  const isHero = heroMap?.id === map.id;
                  const isMutedByHero = Boolean(heroMap) && column.focused && !isHero;

                  return (
                    <div
                      key={`${column.key}-${map.id}`}
                      className={styles.cardFrame}
                      data-hero={isHero ? "true" : "false"}
                      data-muted={isMutedByHero ? "true" : "false"}
                    >
                      <div className={styles.cardInner}>
                        <img
                          className={styles.cardImage}
                          src={resolveMapImageUrl(map.imgPath)}
                          alt={map.description}
                        />
                        <div className={styles.cardShade} aria-hidden />
                        <span className={styles.cardLabel}>{map.description}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className={styles.emptyCard}>
                  <span>No maps</span>
                </div>
              )}
            </div>
          </article>
        ))}
      </section>

      <footer className={styles.footer}>
        <span className={styles.footerTicks} aria-hidden />
        <span className={styles.footerText}>
          {focusedColumn ? `${focusedColumn.title} set` : "Weekly rotation"}
        </span>
      </footer>
    </div>
  );
}
