"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";
import { resolveHeroImageUrl } from "@/lib/assetUrls";
import type { Hero } from "@/lib/api";
import { teamVars, type TeamSide } from "./DraftStage";
import { BrushStrike } from "./BrushStrike";
import styles from "./draft-stage.module.css";

/**
 * How a hero reads in the grid right now. These are visually distinct on
 * purpose — a captain scanning the board needs to tell "gone for good" from
 * "my quota is spent" without reading a single word.
 */
export type HeroTileState =
  /** This captain's turn and the hero is legal to ban. */
  | "selectable"
  /** Legal, but nobody is waiting on this viewer. */
  | "idle"
  /** Another captain is on the clock. */
  | "dimmed"
  /** Two bans already spent on this role this game. */
  | "locked"
  /** Banned in an earlier game of the series. */
  | "spent"
  /** Banned in this game. */
  | "struck";

export function BanTile({
  hero,
  state,
  strikeSide,
  marker,
  onClick,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  hero: Hero;
  state: HeroTileState;
  /** Which team landed the ban — themes the tile record around the red mark. */
  strikeSide?: TeamSide | null;
  marker?: ReactNode;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children?: ReactNode;
}) {
  const struck = state === "struck";
  const interactive = state === "selectable";

  return (
    <div className="relative" style={strikeSide ? teamVars(strikeSide) : undefined}>
      <button
        type="button"
        data-hero-tile={hero.id}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        disabled={!interactive}
        aria-label={struck ? `${hero.name} — banned` : hero.name}
        className={clsx(
          styles.heroTile,
          interactive && styles.heroTileSelectable,
          state === "dimmed" && styles.heroTileDimmed,
          state === "locked" && styles.heroTileLocked,
          state === "spent" && styles.heroTileSpent,
          struck && styles.heroTileStruck
        )}
      >
        <span className={styles.heroTilePortrait}>
          {hero.imgPath ? (
            <img src={resolveHeroImageUrl(hero.imgPath)} alt="" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-mono text-xs text-muted">
              {hero.role.charAt(0)}
              {hero.id}
            </span>
          )}

          {/* The animated X plays center stage when the ban lands. What stays
              on the tile afterwards is just the record of it. */}
          {struck && <BrushStrike className={styles.strike} />}

          {/* A previous-game ban gets one quiet slash, so the two states never
              read as the same thing. */}
          {state === "spent" && (
            <svg className={styles.strike} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <line className={styles.spentSlashStroke} x1="20" y1="80" x2="80" y2="20" />
            </svg>
          )}

          {marker}

          {/* Confirmation on hover, not a permanent caption. */}
          <span className={styles.heroTileName}>{hero.name}</span>
        </span>
      </button>
      {children}
    </div>
  );
}
