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
  bannedByTeamA: boolean;
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
  onClick,
  onRoleLimitWarning,
}: HeroCardProps) {
  // Local hover state: keeps hover re-renders isolated to this card
  // instead of re-rendering all ~30 cards whenever the hovered hero changes.
  const [isHovered, setIsHovered] = useState(false);

  const wasBannedBefore = prevBannedByTeamA || prevBannedByTeamB;
  const prevBannedByBoth = prevBannedByTeamA && prevBannedByTeamB;

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
          // Current game banned - GRAY tones
          banned
            ? "border-muted/50 cursor-not-allowed grayscale"
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
                banned && "grayscale opacity-50",
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
            !banned && wasBannedBefore ? "bg-danger/20" : "bg-background",
          )}
        >
          <span
            className={clsx(
              "text-[10px] truncate block font-medium",
              !banned && wasBannedBefore ? "text-danger" : "text-foreground",
            )}
          >
            {heroName}
          </span>
        </div>
        {/* Current game banned overlay - GRAY */}
        {banned && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white font-semibold text-[10px] uppercase">
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
