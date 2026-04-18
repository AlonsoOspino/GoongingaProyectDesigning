"use client";

import { clsx } from "clsx";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { DraftAction, Team, Hero, GameMap } from "@/lib/api/types";

interface DraftBoardProps {
  actions: DraftAction[];
  teamA?: Team;
  teamB?: Team;
  heroes?: Hero[];
  maps?: GameMap[];
}

const actionTypeColors = {
  BAN: "danger",
  PICK: "success",
  SKIP: "default",
} as const;

export function DraftBoard({ actions, teamA, teamB, heroes, maps }: DraftBoardProps) {
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

  const getHeroName = (heroId: number | null) => {
    if (!heroId) return "Skipped";
    const hero = heroes?.find((h) => h.id === heroId);
    return hero ? `Hero #${hero.id} (${hero.role})` : `Hero #${heroId}`;
  };

  const getMapName = (mapId: number | null) => {
    if (!mapId) return "Unknown Map";
    const map = maps?.find((m) => m.id === mapId);
    return map ? map.description : `Map #${mapId}`;
  };

  return (
    <Card variant="bordered" className="h-full">
      <CardHeader>
        <CardTitle>Draft History</CardTitle>
      </CardHeader>
      <CardContent className="max-h-96 overflow-y-auto">
        {Object.keys(actionsByGame).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(actionsByGame)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([gameNumber, gameActions]) => (
                <div key={gameNumber}>
                  <h4 className="text-sm font-medium text-muted mb-3">
                    Game {gameNumber}
                  </h4>
                  <div className="space-y-2">
                    {gameActions
                      .sort((a, b) => a.order - b.order)
                      .map((action) => (
                        <div
                          key={action.id}
                          className={clsx(
                            "flex items-center gap-3 p-2 rounded-md",
                            action.action === "BAN" && "bg-danger/10",
                            action.action === "PICK" && "bg-success/10",
                            action.action === "SKIP" && "bg-surface-elevated"
                          )}
                        >
                          <Badge variant={actionTypeColors[action.action]}>
                            {action.action}
                          </Badge>
                          <span className="text-sm text-foreground font-medium">
                            {getTeamName(action.teamId)}
                          </span>
                          <span className="text-sm text-muted">
                            {action.action === "PICK" && action.value
                              ? getMapName(action.value)
                              : getHeroName(action.value)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted">
            <p>No draft actions yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
