"use client";

import { clsx } from "clsx";
import { useMemo, useState, type CSSProperties } from "react";
import type { GameMap, MapType } from "@/lib/api";
import { resolveMapImageUrl } from "@/lib/assetUrls";
import { teamVars, type TeamSide } from "./DraftStage";
import { MapImage } from "./MapImage";
import { MapTypeIcon, MAP_TYPE_LABEL } from "./MapTypePlate";
import styles from "./draft-stage.module.css";

/**
 * The map pool wall is one continuous surface shared by both map phases.
 *
 * In the type phase the whole pool is laid out and the active captain focuses a
 * mode to light up its maps (dimming the rest), then commits it. In the map
 * phase the same wall carries over with the chosen mode already lit, and the
 * maps inside it become individually pickable. Rendering the same wall across
 * both phases is what keeps the board from snapping between two layouts.
 */
export interface MapPoolWallProps {
  mode: "type" | "map";
  allMaps: GameMap[];
  /** Ordered map types that still have an unplayed map in this match. */
  mapTypes: MapType[];
  mapTypeCounts: Partial<Record<MapType, number>>;
  /** Tints the focus glow in the choosing team's tone. */
  side: TeamSide;
  broadcast: boolean;

  // Type phase
  canLockType?: boolean;
  /** Held between the lock click and the next poll so the wall reacts at once. */
  committedType?: MapType | null;
  onLockType?: (mapType: MapType) => void;

  // Map phase
  selectedMapType?: MapType | null;
  availableMaps?: GameMap[];
  canPickMap?: boolean;
  isMapPicked?: (mapId: number) => boolean;
  onPickMap?: (mapId: number) => void;
  /** Held between the pick click and the next poll. */
  pickedMapId?: number | null;
}

export function MapPoolWall({
  mode,
  allMaps,
  mapTypes,
  mapTypeCounts,
  side,
  broadcast,
  canLockType = false,
  committedType = null,
  onLockType,
  selectedMapType = null,
  availableMaps = [],
  canPickMap = false,
  isMapPicked,
  onPickMap,
  pickedMapId = null,
}: MapPoolWallProps) {
  // In the type phase, focus follows the browsing user until they commit. In
  // the map phase it is pinned to whatever mode the server locked.
  const [previewType, setPreviewType] = useState<MapType | null>(null);
  const focusedType: MapType | null =
    mode === "map" ? selectedMapType : committedType ?? previewType;
  const locking = mode === "type" && committedType !== null;

  const availableMapIds = useMemo(
    () => new Set(availableMaps.map((m) => m.id)),
    [availableMaps]
  );

  // Cluster the pool by type in the order the modes are offered, so focusing a
  // mode lights up an adjacent block rather than scattered tiles.
  const orderedMaps = useMemo(() => {
    const rank = new Map(mapTypes.map((t, i) => [t, i]));
    return [...allMaps].sort((a, b) => {
      const ra = rank.has(a.type) ? (rank.get(a.type) as number) : mapTypes.length;
      const rb = rank.has(b.type) ? (rank.get(b.type) as number) : mapTypes.length;
      if (ra !== rb) return ra - rb;
      return a.description.localeCompare(b.description);
    });
  }, [allMaps, mapTypes]);

  const focusMode = (mapType: MapType) => {
    if (locking) return;
    if (mode === "type") setPreviewType((current) => (current === mapType ? null : mapType));
  };

  return (
    <div
      className={clsx(styles.wall, broadcast && styles.wallBroadcast)}
      style={teamVars(side)}
      data-focused={focusedType ? "true" : "false"}
    >
      <span className={styles.wallSweep} aria-hidden />
      <div className={styles.wallTypeBar} role="group" aria-label="Map modes">
        {mapTypes.map((mapType, index) => {
          const count = mapTypeCounts[mapType] ?? 0;
          const isFocused = focusedType === mapType;
          const isDim = focusedType !== null && !isFocused;
          const isCommitted = committedType === mapType;
          const interactive = mode === "type" && !locking;

          return (
            <button
              key={mapType}
              type="button"
              onClick={() => focusMode(mapType)}
              disabled={!interactive}
              aria-pressed={isFocused}
              style={{ ["--chip-index" as string]: index }}
              className={clsx(
                styles.wallChip,
                interactive && styles.wallChipInteractive,
                isFocused && styles.wallChipActive,
                isDim && styles.wallChipDim,
                isCommitted && styles.wallChipLocked
              )}
            >
              <MapTypeIcon mapType={mapType} className={styles.wallChipIcon} />
              <span className={styles.wallChipText}>
                <span className={styles.wallChipName}>{MAP_TYPE_LABEL[mapType]}</span>
                <span className={styles.wallChipCount}>
                  {count} {count === 1 ? "map" : "maps"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={clsx(styles.wallGrid, broadcast && styles.wallGridBroadcast)}
        role="list"
      >
        {orderedMaps.map((map, index) => {
          const isFocusType = focusedType !== null && map.type === focusedType;
          const recede = focusedType !== null && !isFocusType;

          const pickable =
            mode === "map" &&
            canPickMap &&
            !locking &&
            map.type === selectedMapType &&
            availableMapIds.has(map.id) &&
            !(isMapPicked?.(map.id) ?? false);

          const played =
            mode === "map" &&
            map.type === selectedMapType &&
            (isMapPicked?.(map.id) ?? false);

          const justPicked = pickedMapId === map.id;

          const content = (
            <div className={styles.wallTileInner}>
              <MapImage
                src={map.imgPath ? resolveMapImageUrl(map.imgPath) : null}
                alt={map.description}
                fallbackInitial={map.description.charAt(0)}
                className={clsx("aspect-video w-full", styles.wallTileImg)}
              />
              <span className={styles.wallTileScrim} aria-hidden />
              <span className={styles.wallTileLabel}>
                <MapTypeIcon mapType={map.type} className={styles.wallTileType} />
                <span className={styles.wallTileName}>{map.description}</span>
              </span>
              {played && <span className={styles.wallTilePlayedTag}>Played</span>}
            </div>
          );

          const className = clsx(
            styles.wallTile,
            isFocusType && styles.wallTileFocus,
            recede && styles.wallTileRecede,
            played && styles.wallTilePlayed,
            justPicked && styles.wallTilePicked
          );
          const style = { ["--tile-index" as string]: index } as CSSProperties;

          if (pickable) {
            return (
              <button
                key={map.id}
                type="button"
                role="listitem"
                onClick={() => onPickMap?.(map.id)}
                style={style}
                className={clsx(className, styles.wallTilePickable)}
              >
                {content}
              </button>
            );
          }

          return (
            <div key={map.id} role="listitem" style={style} className={className}>
              {content}
            </div>
          );
        })}
      </div>

      {mode === "type" && canLockType && (
        <div className={styles.wallLockBar} aria-live="polite">
          {focusedType ? (
            <>
              <span className={styles.wallLockLabel}>
                {locking ? "Locking " : "Ready to lock "}
                <strong>{MAP_TYPE_LABEL[focusedType]}</strong>
                <span className={styles.wallLockCount}>
                  {" · "}
                  {mapTypeCounts[focusedType] ?? 0}{" "}
                  {(mapTypeCounts[focusedType] ?? 0) === 1 ? "map" : "maps"}
                </span>
              </span>
              <button
                type="button"
                className={styles.wallLockButton}
                disabled={locking}
                onClick={() => focusedType && onLockType?.(focusedType)}
              >
                {locking ? "Locking\u2026" : `Lock ${MAP_TYPE_LABEL[focusedType]}`}
              </button>
            </>
          ) : (
            <span className={styles.wallLockHint}>Focus a mode to reveal its maps, then lock it in.</span>
          )}
        </div>
      )}
    </div>
  );
}
