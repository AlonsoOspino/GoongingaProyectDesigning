"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Radio, RotateCcw } from "lucide-react";
import { getMaps, type AdminGameMap } from "@/lib/api/admin";
import { managerSetOverlayFocus } from "@/lib/api/match";
import type { MapType, Match } from "@/lib/api/types";
import { resolveMapImageUrl } from "@/lib/assetUrls";
import styles from "./map-pool-control.module.css";

interface MapPoolControlProps {
  match: Match;
  token: string;
}

interface ColumnDefinition {
  key: "CONTROL" | "HYBRID" | "ESCORT" | "PUSH_FLASH";
  title: string;
  /** What gets written when the header itself is clicked. */
  focusType: MapType;
  accepts: (type: MapType) => boolean;
}

interface Focus {
  type: MapType | null;
  mapId: number | null;
}

const COLUMNS: ColumnDefinition[] = [
  { key: "CONTROL", title: "Control", focusType: "CONTROL", accepts: (type) => type === "CONTROL" },
  { key: "HYBRID", title: "Hybrid", focusType: "HYBRID", accepts: (type) => type === "HYBRID" },
  { key: "ESCORT", title: "Escort", focusType: "PAYLOAD", accepts: (type) => type === "PAYLOAD" },
  {
    key: "PUSH_FLASH",
    title: "Push / Flash",
    focusType: "PUSH",
    accepts: (type) => type === "PUSH" || type === "FLASHPOINT",
  },
];

/*
 * Every control on the page needs the same map catalogue and it never changes
 * during a session, so one in-flight request is shared rather than one per
 * active match.
 */
let mapCatalogue: Promise<AdminGameMap[]> | null = null;
const loadMapCatalogue = () => {
  if (!mapCatalogue) {
    mapCatalogue = getMaps().catch((error) => {
      mapCatalogue = null;
      throw error;
    });
  }
  return mapCatalogue;
};

function columnMatchesFocus(column: ColumnDefinition, focusType: MapType | null) {
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

function extractMapPoolIds(match: Match) {
  const source = match.mapsAllowedByRound;
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

const sameFocus = (a: Focus, b: Focus) => a.type === b.type && a.mapId === b.mapId;

export function MapPoolControl({ match, token }: MapPoolControlProps) {
  const [maps, setMaps] = useState<AdminGameMap[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /*
   * The dashboard polls every 12 seconds. Without a local override a click
   * would visibly snap back to the old state until the next poll landed, so
   * the override holds the optimistic answer until the server agrees.
   */
  const [override, setOverride] = useState<Focus | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMapCatalogue()
      .then((loaded) => {
        if (!cancelled) setMaps(loaded);
      })
      .catch(() => {
        if (!cancelled) setError("Map catalogue could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const serverFocus = useMemo<Focus>(
    () => ({ type: match.overlayFocusType ?? null, mapId: match.overlayFocusMapId ?? null }),
    [match.overlayFocusType, match.overlayFocusMapId]
  );

  useEffect(() => {
    setOverride((current) => (current && sameFocus(current, serverFocus) ? null : current));
  }, [serverFocus]);

  const focus = override ?? serverFocus;

  const mapsById = useMemo(() => {
    const result = new Map<number, AdminGameMap>();
    for (const map of maps) result.set(map.id, map);
    return result;
  }, [maps]);

  const poolMaps = useMemo(
    () =>
      extractMapPoolIds(match)
        .map((id) => mapsById.get(id))
        .filter((map): map is AdminGameMap => Boolean(map)),
    [match, mapsById]
  );

  const columns = useMemo(
    () =>
      COLUMNS.map((column) => ({
        ...column,
        maps: poolMaps.filter((map) => column.accepts(map.type)),
        focused: columnMatchesFocus(column, focus.type),
      })),
    [poolMaps, focus.type]
  );

  const apply = useCallback(
    async (next: Focus) => {
      setOverride(next);
      setSaving(true);
      setError(null);
      try {
        await managerSetOverlayFocus(token, match.id, {
          focusType: next.type,
          focusMapId: next.mapId,
        });
      } catch (requestError) {
        // Roll back to whatever the server last told us rather than leaving a
        // control that claims something the overlay is not showing.
        setOverride(null);
        setError(
          requestError instanceof Error ? requestError.message : "The overlay could not be updated."
        );
      } finally {
        setSaving(false);
      }
    },
    [match.id, token]
  );

  const overlayUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/overlay/map-pool/${match.id}`;

  const handleCopy = useCallback(async () => {
    if (!overlayUrl) return;
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Clipboard is unavailable in this browser.");
    }
  }, [overlayUrl]);

  const focusedColumn = columns.find((column) => column.focused) ?? null;

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <span className={styles.eyebrow}>
            <Radio size={12} className={saving ? styles.livePulse : undefined} aria-hidden />
            Map pool on air
          </span>
          <p className={styles.headNote}>
            {focusedColumn
              ? `Showing ${focusedColumn.title}${
                  focus.mapId ? ` · ${mapsById.get(focus.mapId)?.description ?? "map"}` : ""
                }`
              : "Showing the full weekly pool"}
          </p>
        </div>

        <div className={styles.headActions}>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => void apply({ type: null, mapId: null })}
            disabled={saving || !focus.type}
          >
            <RotateCcw size={13} aria-hidden />
            Clear
          </button>
          <button type="button" className={styles.ghostButton} onClick={() => void handleCopy()}>
            {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
            {copied ? "Copied" : "Overlay URL"}
          </button>
        </div>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      {poolMaps.length === 0 ? (
        <p className={styles.empty}>
          No map pool is configured for this week, so there is nothing to put on screen yet.
        </p>
      ) : (
        <div className={styles.grid}>
          {columns.map((column) => (
            <section
              key={column.key}
              className={styles.column}
              data-state={!focusedColumn ? "idle" : column.focused ? "active" : "dim"}
            >
              <button
                type="button"
                className={styles.columnHeader}
                onClick={() =>
                  void apply(
                    column.focused && !focus.mapId
                      ? { type: null, mapId: null }
                      : { type: column.focusType, mapId: null }
                  )
                }
                disabled={saving || column.maps.length === 0}
                aria-pressed={column.focused}
              >
                <span className={styles.columnTitle}>{column.title}</span>
                <span className={styles.columnCount}>{column.maps.length}</span>
              </button>

              <div className={styles.stack}>
                {column.maps.map((map) => {
                  const isHero = focus.mapId === map.id;
                  return (
                    <button
                      key={map.id}
                      type="button"
                      className={styles.tile}
                      data-hero={isHero ? "true" : "false"}
                      onClick={() =>
                        void apply(
                          isHero
                            ? { type: map.type, mapId: null }
                            : { type: map.type, mapId: map.id }
                        )
                      }
                      disabled={saving}
                      aria-pressed={isHero}
                    >
                      <img
                        className={styles.tileImage}
                        src={resolveMapImageUrl(map.imgPath)}
                        alt=""
                      />
                      <span className={styles.tileLabel}>{map.description}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
