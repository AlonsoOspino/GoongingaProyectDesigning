import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import type { Team } from "@/lib/api/types";

interface TeamCardProps {
  team: Team;
  rank?: number;
}

export function TeamCard({ team, rank }: TeamCardProps) {
  const mapDiff = team.mapWins - team.mapLoses;

  return (
    <Link href={`/teams/${team.id}`}>
      <Card
        variant="bordered"
        className="transition-all duration-200 hover:border-primary/50 hover:bg-surface-elevated/50 hover-lift"
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Rank */}
            {rank !== undefined && (
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center">
                <span className="text-sm font-bold text-muted">#{rank}</span>
              </div>
            )}

            {/* Logo */}
            <Avatar size="lg" src={team.logo || undefined} fallback={team.name} />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{team.name}</h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-success font-medium">{team.victories}W</span>
                <span className="text-sm text-muted">
                  {team.mapWins}-{team.mapLoses} Maps
                </span>
              </div>
            </div>

            {/* Map Diff */}
            <div className="flex-shrink-0 text-right">
              <p
                className={`text-lg font-bold font-mono ${
                  mapDiff > 0 ? "text-success" : mapDiff < 0 ? "text-danger" : "text-muted"
                }`}
              >
                {mapDiff > 0 ? "+" : ""}
                {mapDiff}
              </p>
              <p className="text-xs text-muted">Map Diff</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
