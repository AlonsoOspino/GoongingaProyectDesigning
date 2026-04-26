"use client";

import { memo, useCallback, useState } from "react";
import { clsx } from "clsx";
import { resolveHeroImageUrl } from "@/lib/assetUrls";

export type HeroRole = "TANK" | "DPS" | "SUPPORT";

export type HeroCardProps = {
  heroId: number;
  heroName: string;
  heroImgPath: string | null | undefined;
  heroRole: HeroRole;
  canSelect: boolean;
  banned: boolean;
  isCaptain: boolean;
  isManager: boolean;
  isMyTurn: boolean;
  actionLoading: boolean;
  roleAtLimit: boolean;
  teamDone: boolean;
  myTeamBannedBefore: boolean;
  prevBannedByTeamA: boolean;
  prevBannedByTeamB: boolean;
  teamAName: string;
  teamBName: string;
  /** Current game - hero banned by team A */
  bannedByTeamA: boolean;
  /** Current game - hero banned by team B */
  bannedByTeamB: boolean;
  onClick: (heroId: number, heroRole: HeroRole) => void;
  onRoleLimitWarning: (heroRole: HeroRole) => void;
};

function HeroCardImpl({
  heroId,
  heroName,
  heroImgPath,
  heroRole,
  canSelect,
  banned,
  isCaptain,
  isManager,
  isMyTurn,
  actionLoading,
  roleAtLimit,
  teamDone,
  myTeamBannedBefore,
  prevBannedByTeamA,
  prevBannedByTeamB,
  teamAName,
  teamBName,
  bannedByTeamA,
  bannedByTeamB,
  onClick,
  onRoleLimitWarning,
}: HeroCardProps) {
  // Local hover state: keeps hover re-renders isolated to this card
  // instead of re-rendering all ~30 cards whenever the hovered hero changes.
  const [isHovered, setIsHovered] = useState(false);

  const wasBannedBefore = prevBannedByTeamA || prevBannedByTeamB;
  const prevBannedByBoth = prevBannedByTeamA && prevBannedByTeamB;

  // Manager view with exactly ONE team having banned this hero in a previous
  // game: show only the red frame (border), no red name label. The name label
  // stays red for captains seeing their own prior ban and for the both-teams
  // case in the manager view, where the extra visual weight is warranted.
  const managerSingleTeamPrevBan =
    isManager && wasBannedBefore && !prevBannedByBoth;
  const showRedNameLabel =
    !banned && wasBannedBefore && !managerSingleTeamPrevBan;

  const isDisabled =
    banned ||
    actionLoading ||
    roleAtLimit ||
    teamDone ||
    (isCaptain && myTeamBannedBefore);

  const handleCardClick = () => {
    if (banned) return;
    if (!isCaptain || !isMyTurn) return;

    // Role limit warning takes precedence (preserves original behavior)
    if (roleAtLimit) {
      onRoleLimitWarning(heroRole);
      return;
    }

    if (!isDisabled) {
      onClick(heroId, heroRole);
    }
  };

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const prevBanTeamNames: string[] = [];
  if (prevBannedByTeamA) prevBanTeamNames.push(teamAName);
  if (prevBannedByTeamB) prevBanTeamNames.push(teamBName);

  return (
    <div className="relative">
      <button
        onClick={handleCardClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={clsx(
          "relative rounded-xl overflow-hidden border-2 transition-all flex flex-col group w-full",
          // Current game banned - team color border based on who banned
          banned
            ? clsx(
                "cursor-not-allowed",
                bannedByTeamA && bannedByTeamB 
                  ? "border-black grayscale" // Both teams - full grayscale, black border
                  : bannedByTeamA 
                    ? "border-[color:var(--color-team-a)] grayscale-[50%]" // Team A only - 50% grayscale, red border
                    : bannedByTeamB 
                      ? "border-[color:var(--color-team-b)] grayscale-[50%]" // Team B only - 50% grayscale, blue border
                      : "border-muted/50 grayscale-[50%]"
              )
            : // Previous game banned by my team (captain view) - RED tones
            isCaptain && myTeamBannedBefore
            ? "border-danger/70 cursor-not-allowed"
            : // Previous game banned (manager view)
            isManager && wasBannedBefore
            ? prevBannedByBoth
              ? "border-danger cursor-not-allowed"
              : "border-danger/50 cursor-not-allowed"
            : teamDone
            ? "border-border cursor-not-allowed opacity-40"
            : roleAtLimit && isCaptain
            ? "border-warning/50 cursor-pointer opacity-60"
            : canSelect
            ? "border-border hover:border-danger hover:ring-2 hover:ring-danger/30 cursor-pointer hover:scale-110 hover:z-10"
            : "border-border cursor-default opacity-60",
        )}
      >
        <div className="aspect-square bg-surface w-full relative">
          {heroImgPath ? (
            <img
              src={resolveHeroImageUrl(heroImgPath)}
              alt={heroName}
              loading="lazy"
              decoding="async"
              className={clsx(
                "w-full h-full object-cover",
                // Current game banned - grayscale based on who banned
                banned && (bannedByTeamA && bannedByTeamB 
                  ? "grayscale opacity-40" // Both teams - 100% grayscale
                  : "grayscale-[50%] opacity-60" // Single team - 50% grayscale
                ),
                !banned && isCaptain && myTeamBannedBefore && "opacity-60",
                !banned &&
                  isManager &&
                  wasBannedBefore &&
                  (prevBannedByBoth ? "opacity-50" : "opacity-70"),
                canSelect && "group-hover:brightness-110",
              )}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-elevated">
              <span className="text-sm font-bold text-muted">
                {heroRole.charAt(0)}
                {heroId}
              </span>
            </div>
          )}
          {/* Red overlay for previous game bans - Manager view */}
          {isManager && wasBannedBefore && prevBannedByBoth && (
            <div className="absolute inset-0 bg-danger/40" />
          )}
          {/* Red overlay for captain - previous game ban by their team */}
          {!banned && isCaptain && myTeamBannedBefore && (
            <div className="absolute inset-0 bg-danger/30" />
          )}
        </div>
        <div
          className={clsx(
            "px-1 py-1 text-center",
            showRedNameLabel ? "bg-danger/20" : "bg-background",
          )}
        >
          <span
            className={clsx(
              "text-[10px] truncate block font-medium",
              showRedNameLabel ? "text-danger" : "text-foreground",
            )}
          >
            {heroName}
          </span>
        </div>
        {/* Current game banned overlay with team color marks */}
        {banned && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Gray overlay - 50% for single team, 100% for both teams */}
            <div 
              className={clsx(
                "absolute inset-0",
                bannedByTeamA && bannedByTeamB 
                  ? "bg-black/80" 
                  : "bg-black/50"
              )} 
            />
            {/* Team color marks - doubled width (8px each) */}
            <div className="absolute left-0 top-0 bottom-0 flex">
              {bannedByTeamA && (
                <div className="w-4 h-full bg-[color:var(--color-team-a)]" />
              )}
            </div>
            <div className="absolute right-0 top-0 bottom-0 flex">
              {bannedByTeamB && (
                <div className="w-4 h-full bg-[color:var(--color-team-b)]" />
              )}
            </div>
            {/* Both teams banned - black center mark */}
            {bannedByTeamA && bannedByTeamB && (
              <div className="absolute inset-x-4 top-0 bottom-0 bg-black/40" />
            )}
            <span className="relative z-10 text-white font-semibold text-[10px] uppercase">
              Banned
            </span>
          </div>
        )}
        {/* Previous game banned overlay for captain - red X indicator */}
        {!banned && isCaptain && myTeamBannedBefore && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-full h-full flex items-center justify-center">
              <svg
                className="absolute w-6 h-6 text-danger"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  opacity="0.8"
                />
                <path
                  d="M8 8l8 8M16 8l-8 8"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        )}
      </button>
      {/* Tooltip for manager showing which team banned (local hover state) */}
      {isManager && wasBannedBefore && !banned && isHovered && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface-elevated border border-danger/50 rounded text-[10px] whitespace-nowrap shadow-lg">
          <span className="text-danger font-medium">Banned by: </span>
          <span className="text-foreground">
            {prevBanTeamNames.join(" & ")}
          </span>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-elevated" />
        </div>
      )}
    </div>
  );
}

export const HeroCard = memo(HeroCardImpl);
HeroCard.displayName = "HeroCard";
