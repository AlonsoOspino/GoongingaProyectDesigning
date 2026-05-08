"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { getMaps, getMatchById, type AdminGameMap } from "@/lib/api/admin";
import type { Match } from "@/lib/api/types";
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
  accepts: (type: AdminGameMap["type"]) => boolean;
}

const POLL_INTERVAL_MS = 10000;

const COLUMNS: ColumnDefinition[] = [
  {
    key: "CONTROL",
    title: "CONTROL",
    accepts: (type) => type === "CONTROL",
  },
  {
    key: "HYBRID",
    title: "HYBRID",
    accepts: (type) => type === "HYBRID",
  },
  {
    key: "ESCORT",
    title: "ESCORT",
    accepts: (type) => type === "PAYLOAD",
  },
  {
    key: "PUSH_FLASH",
    title: "PUSH/FLASH",
    accepts: (type) => type === "PUSH" || type === "FLASHPOINT",
  },
];

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

  useEffect(() => {
    if (!Number.isInteger(matchId) || matchId <= 0) {
      setLoading(false);
      setError("Invalid match id.");
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const [loadedMatch, loadedMaps] = await Promise.all([
          getMatchById(matchId),
          getMaps(),
        ]);

        if (cancelled) return;
        setMatch(loadedMatch);
        setMaps(loadedMaps);
        setError(null);
      } catch (fetchError) {
        if (cancelled) return;
        const message =
          fetchError instanceof Error ? fetchError.message : "Failed to load map pool overlay data.";
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

  const columns = useMemo(
    () =>
      COLUMNS.map((column) => ({
        ...column,
        maps: mapPoolMaps.filter((map) => column.accepts(map.type)),
      })),
    [mapPoolMaps]
  );

  const weekText =
    match?.semanas && Number.isFinite(match.semanas) && match.semanas > 0
      ? String(match.semanas)
      : "?";

  if (loading) {
    return (
      <div className={styles.statusScreen}>
        <div>
          <p className={styles.statusTitle}>Loading Map Pool</p>
          <p className={styles.statusHint}>Match {matchId}</p>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className={styles.statusScreen}>
        <div>
          <p className={styles.statusTitle}>Map Pool Unavailable</p>
          <p className={styles.statusHint}>{error || `Match ${matchId} was not found.`}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(styles.root, variant === "clean" ? styles.clean : styles.classic)}>
      <header className={styles.titleBar}>
        <h1 className={styles.titleText}>Week {weekText} - Map Pool</h1>
      </header>

      <section className={styles.grid}>
        {columns.map((column) => (
          <article key={column.key} className={styles.column}>
            <h2 className={styles.columnHeader}>{column.title}</h2>

            <div className={styles.mapStack}>
              {column.maps.length > 0 ? (
                column.maps.map((map) => (
                  <div key={`${column.key}-${map.id}`} className={styles.mapTile}>
                    <img
                      className={styles.mapImage}
                      src={resolveMapImageUrl(map.imgPath)}
                      alt={map.description}
                    />
                    <span className={styles.mapLabel}>{map.description}</span>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>No maps</div>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
