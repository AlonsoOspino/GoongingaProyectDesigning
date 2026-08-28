"use client";

import { clsx } from "clsx";
import type { CSSProperties } from "react";
import type { MapType } from "@/lib/api";
import { teamVars, type TeamSide } from "./DraftStage";
import styles from "./draft-stage.module.css";

/** Official in-game mode glyphs, used as alpha masks so they can be tinted. */
export const MAP_TYPE_ICON: Record<MapType, string> = {
  CONTROL: "/icons/map-types/control.png",
  HYBRID: "/icons/map-types/hybrid.png",
  PAYLOAD: "/icons/map-types/payload.png",
  PUSH: "/icons/map-types/push.png",
  FLASHPOINT: "/icons/map-types/flashpoint.png",
};

export const MAP_TYPE_LABEL: Record<MapType, string> = {
  CONTROL: "Control",
  HYBRID: "Hybrid",
  PAYLOAD: "Payload",
  PUSH: "Push",
  FLASHPOINT: "Flashpoint",
};

export function MapTypeIcon({
  mapType,
  className,
  style,
}: {
  mapType: MapType;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={clsx(styles.plateIcon, className)}
      style={{ ["--icon" as string]: `url(${MAP_TYPE_ICON[mapType]})`, ...style }}
      aria-hidden="true"
    />
  );
}

export function MapTypePlate({
  mapType,
  mapCount,
  side,
  selectable,
  chosen,
  dismissed,
  onSelect,
}: {
  mapType: MapType;
  /** How many maps in this match's pool are still unplayed under this mode. */
  mapCount: number;
  /** Colors the plate in the choosing team's tone. */
  side: TeamSide;
  selectable: boolean;
  chosen?: boolean;
  dismissed?: boolean;
  onSelect: (mapType: MapType) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => selectable && onSelect(mapType)}
      disabled={!selectable}
      style={teamVars(side)}
      className={clsx(
        styles.plate,
        selectable && styles.plateSelectable,
        chosen && styles.plateChosen,
        dismissed && styles.plateDismissed
      )}
    >
      <MapTypeIcon mapType={mapType} />
      <span className={styles.plateName}>{MAP_TYPE_LABEL[mapType]}</span>
      <span className={styles.plateMeta}>
        {mapCount} {mapCount === 1 ? "map" : "maps"}
      </span>
    </button>
  );
}
