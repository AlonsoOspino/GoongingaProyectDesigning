"use client";

import { clsx } from "clsx";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { DraftAction, Team, Hero, GameMap } from "@/lib/api/types";
import { resolveHeroImageUrl, resolveMapImageUrl } from "@/lib/assetUrls";

interface DraftBoardProps {
  actions: DraftAction[];
  teamA?: Team;
  teamB?: Team;
  heroes?: Hero[];
  maps?: GameMap[];
  currentGameNumber?: number;
}

export function DraftBoard({ actions, teamA, teamB, heroes, maps, currentGameNumber }: DraftBoardProps) {
  // Group actions by game number
  const actionsByGame = actions.reduce((acc, action) => {
    if (!acc[action.gameNumber]) {
      acc[action.gameNumber] = [];
    }
    acc[action.gameNumber].push(action);
    return acc;
  }, {} as Record<number, DraftAction[]>);

  const getTeamName = (teamId: number) => {
    if (teamA && teamA.id === teamId) return teamA.name;
    if (teamB && teamB.id === teamId) return teamB.name;
    return `Team ${teamId}`;
  };

  const isTeamA = (teamId: number) => teamA?.id === teamId;

  const getHeroById = (heroId: number | null) => {
    if (!heroId) return null;
    return heroes?.find((h) => h.id === heroId);
  };

  const getMapById = (mapId: number | null) => {
    if (!mapId) return null;
    return maps?.find((m) => m.id === mapId);
  };

  const getActionDisplay = (action: DraftAction) => {
    if (action.action === "SKIP") {
      return { label: "Skipped", sublabel: null };
    }
    if (action.action === "PICK" && action.value) {
      const map = getMapById(action.value);
      return { label: map?.description || `Map #${action.value}`, sublabel: map?.type };
    }
    if (action.action === "BAN" && action.value) {
      const hero = getHeroById(action.value);
      return { label: hero?.name || `Hero #${action.value}`, sublabel: hero?.role };
    }
    return { label: action.action, sublabel: null };
  };

  return (
    <Card variant="featured" className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Draft History</CardTitle>
      </CardHeader>
      <CardContent className="max-h-80 overflow-y-auto">
        {Object.keys(actionsByGame).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(actionsByGame)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([gameNumber, gameActions]) => {
                const isCurrent = currentGameNumber === parseInt(gameNumber);
                
                return (
                  <div key={gameNumber}>
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="text-xs font-medium text-muted uppercase tracking-wide">
                        Game {gameNumber}
                      </h4>
                      {isCurrent && (
                        <Badge variant="primary" className="text-[10px]">Current</Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      {gameActions
                        .sort((a, b) => a.order - b.order)
                        .map((action) => {
                          const { label, sublabel } = getActionDisplay(action);
                          const teamAAction = isTeamA(action.teamId);

                          return (
                            <div
                              key={action.id}
                              className={clsx(
                                "flex items-center justify-between p-2 rounded text-sm",
                                action.action === "BAN" && "bg-danger/10",
                                action.action === "PICK" && "bg-primary/10",
                                action.action === "SKIP" && "bg-surface-elevated"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    action.action === "BAN" ? "danger" :
                                    action.action === "PICK" ? "success" : "default"
                                  }
                                  className="text-[10px]"
                                >
                                  {action.action}
                                </Badge>
                                <span className={clsx(
                                  "font-medium text-xs",
                                  teamAAction ? "text-[color:var(--color-team-a)]" : "text-[color:var(--color-team-b)]"
                                )}>
                                  {getTeamName(action.teamId)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted">{label}</span>
                                {sublabel && (
                                  <Badge variant="outline" className="text-[9px]">{sublabel}</Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted">
            <p className="text-sm">No draft actions yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
