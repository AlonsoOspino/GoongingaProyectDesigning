"use client";

import { clsx } from "clsx";
import type { CSSProperties, ReactNode } from "react";
import { resolveGenericBackendAsset } from "@/lib/assetUrls";
import type { Team } from "@/lib/api";
import styles from "./draft-stage.module.css";

export type TeamSide = "A" | "B";

/**
 * Every rail is themed from two inline custom properties instead of side-
 * specific classes, so `draft-stage.module.css` never hardcodes a team color.
 */
export function teamVars(side: TeamSide): CSSProperties {
  return {
    "--team": side === "A" ? "var(--color-team-a)" : "var(--color-team-b)",
    "--team-bright": side === "A" ? "var(--color-team-a-bright)" : "var(--color-team-b-bright)",
  } as CSSProperties;
}

/**
 * The persistent three-column frame. Check-in, map type, map pick and bans all
 * render through this, so the team rails hold position for the whole draft and
 * only the decision surface in the middle changes.
 */
export function DraftStage({
  broadcast,
  left,
  right,
  children,
  className,
}: {
  broadcast?: boolean;
  left: ReactNode;
  right: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx(styles.stage, broadcast && styles.stageBroadcast, className)}>
      {left}
      <div className="min-w-0">{children}</div>
      {right}
    </div>
  );
}

const RING_RADIUS = 48;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * One team column: logo, name plate, and whatever the current phase hangs
 * below it (ready state during check-in, banned portraits during the draft).
 *
 * `ready` drives the check-in sweep. Passing `undefined` means the phase has
 * no readiness concept and the ring is omitted entirely.
 */
export function TeamRail({
  team,
  side,
  isTurn,
  status,
  ready,
  children,
}: {
  team?: Team;
  side: TeamSide;
  isTurn?: boolean;
  status?: string;
  ready?: boolean;
  children?: ReactNode;
}) {
  const hasRing = ready !== undefined;
  // Dim the mark until the captain checks in, so a half-ready lobby is
  // readable at a glance instead of needing the label to be parsed.
  const idle = hasRing && !ready;
  const fallback = team?.name?.trim().charAt(0).toUpperCase() || side;

  return (
    <div className={styles.rail} style={teamVars(side)}>
      <div
        className={clsx(
          styles.railLogo,
          idle && styles.railLogoIdle,
          isTurn && (side === "A" ? styles.railTurn : styles.railTurnB)
        )}
      >
        {team?.logo ? (
          <img src={resolveGenericBackendAsset(team.logo)} alt="" />
        ) : (
          <span className={styles.railLogoFallback}>{fallback}</span>
        )}
        {hasRing && (
          <svg className={styles.railRing} viewBox="0 0 104 104" aria-hidden="true">
            <circle className={styles.railRingTrack} cx="52" cy="52" r={RING_RADIUS} />
            <circle
              className={styles.railRingProgress}
              cx="52"
              cy="52"
              r={RING_RADIUS}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ready ? 0 : RING_CIRCUMFERENCE}
            />
          </svg>
        )}
      </div>

      <div className={styles.railPlate}>
        <span className={styles.railName}>{team?.name || `Team ${side}`}</span>
        {status && (
          <span className={clsx(styles.railStatus, idle && styles.railStatusIdle)}>{status}</span>
        )}
      </div>

      {children && <div className={styles.railBody}>{children}</div>}
    </div>
  );
}
