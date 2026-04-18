"use client";

import { clsx } from "clsx";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Hero, HeroRole } from "@/lib/api/types";
import { resolveHeroImageUrl } from "@/lib/assetUrls";

interface HeroBannerProps {
  heroes: Hero[];
  bannedHeroIds: number[];
  onSelectHero?: (heroId: number) => void;
  onSkip?: () => void;
  disabled?: boolean;
  isMyTurn?: boolean;
}

const roleColors: Record<HeroRole, string> = {
  TANK: "bg-primary/20 text-primary",
  DPS: "bg-danger/20 text-danger",
  SUPPORT: "bg-success/20 text-success",
};

export function HeroBanner({
  heroes,
  bannedHeroIds,
  onSelectHero,
  onSkip,
  disabled,
  isMyTurn,
}: HeroBannerProps) {
  // Group heroes by role
  const heroesByRole = heroes.reduce((acc, hero) => {
    if (!acc[hero.role]) {
      acc[hero.role] = [];
    }
    acc[hero.role].push(hero);
    return acc;
  }, {} as Record<HeroRole, Hero[]>);

  const roleOrder: HeroRole[] = ["TANK", "DPS", "SUPPORT"];

  return (
    <Card variant="bordered" className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Hero Bans</CardTitle>
        {isMyTurn && !disabled && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Skip Ban
          </button>
        )}
      </CardHeader>
      <CardContent className="max-h-[500px] overflow-y-auto">
        {roleOrder.map((role) => {
          const roleHeroes = heroesByRole[role] || [];

          return (
            <div key={role} className="mb-6 last:mb-0">
              <Badge className={clsx("mb-3", roleColors[role])}>{role}</Badge>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {roleHeroes.map((hero) => {
                  const isBanned = bannedHeroIds.includes(hero.id);
                  const isAvailable = !isBanned && !disabled;

                  return (
                    <button
                      key={hero.id}
                      type="button"
                      onClick={() => isAvailable && onSelectHero?.(hero.id)}
                      disabled={!isAvailable}
                      className={clsx(
                        "relative aspect-square rounded-lg overflow-hidden border transition-all",
                        isAvailable && isMyTurn
                          ? "border-danger/50 hover:border-danger cursor-pointer"
                          : "border-border",
                        isBanned && "opacity-40",
                        !isAvailable && "cursor-not-allowed"
                      )}
                    >
                      {/* Hero Image */}
                      {hero.imgPath ? (
                        <img
                          src={resolveHeroImageUrl(hero.imgPath)}
                          alt={`Hero ${hero.id}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-surface-elevated flex items-center justify-center">
                          <span className="text-xs text-muted font-mono">#{hero.id}</span>
                        </div>
                      )}

                      {/* Banned Overlay */}
                      {isBanned && (
                        <div className="absolute inset-0 bg-danger/40 flex items-center justify-center">
                          <svg
                            className="w-8 h-8 text-danger"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
