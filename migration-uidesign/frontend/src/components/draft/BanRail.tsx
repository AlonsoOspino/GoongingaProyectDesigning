"use client";

import { resolveHeroImageUrl } from "@/lib/assetUrls";
import type { Hero } from "@/lib/api";
import type { TeamSide } from "./DraftStage";
import { BrushStrike } from "./BrushStrike";
import styles from "./draft-stage.module.css";

/**
 * A landed ban in the team rail: the hero, greyed out, marked, and named,
 * inside the team's color. The drama already happened center stage — this is
 * the record of it, so it stays quiet and readable.
 */
export function BanSlot({
  hero,
  heroId,
  side,
  index,
  teamId,
}: {
  /** Resolved hero, or null if the ban was skipped OR the hero is unknown. */
  hero: Hero | null;
  /** The banned hero's id — null only when the captain actually skipped. */
  heroId: number | null;
  side: TeamSide;
  index: number;
  teamId: number;
}) {
  // A skipped turn and a hero we failed to look up are different facts, and a
  // broadcast must not print one as the other.
  const skipped = heroId === null;

  return (
    <div className={styles.banSlot} data-ban-slot={`${teamId}-${index}`}>
      {skipped ? (
        <span className={styles.banSlotSkip}>&mdash;</span>
      ) : (
        <span className={styles.banSlotFigure}>
          {hero?.imgPath ? (
            <img src={resolveHeroImageUrl(hero.imgPath)} alt="" />
          ) : (
            <span className={styles.banSlotSkip}>#{heroId}</span>
          )}
          <BrushStrike className={styles.banSlotMark} />
        </span>
      )}
      <span className={styles.banSlotName}>
        {skipped ? "Skipped" : hero?.name || `Hero ${heroId}`}
      </span>
      <span className="sr-only">{`${side === "A" ? "Left" : "Right"} team ban ${index + 1}`}</span>
    </div>
  );
}

/** An unspent ban turn. */
export function EmptyBanSlot({ slotNumber, teamId }: { slotNumber: number; teamId: number }) {
  return (
    <div className={styles.banSlotEmpty} data-ban-slot={`${teamId}-${slotNumber - 1}`}>
      {slotNumber}
    </div>
  );
}
