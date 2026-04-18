"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import type { Match, Team, MatchStatus, MatchType } from "@/lib/api/types";

interface MatchCardProps {
  match: Match;
  teamA?: Team;
  teamB?: Team;
}

const statusVariants: Record<MatchStatus, { label: string; variant: "default" | "primary" | "success" | "warning" }> = {
  SCHEDULED: { label: "Scheduled", variant: "default" },
  ACTIVE: { label: "Live", variant: "primary" },
  PENDINGREGISTERS: { label: "Pending", variant: "warning" },
  FINISHED: { label: "Finished", variant: "success" },
};

const typeLabels: Record<MatchType, string> = {
  ROUNDROBIN: "Round Robin",
  PLAYINS: "Play-ins",
  PLAYOFFS: "Playoffs",
  SEMIFINALS: "Semifinals",
  FINALS: "Finals",
  PRACTICE: "Practice",
};

export function MatchCard({ match, teamA, teamB }: MatchCardProps) {
  const status = statusVariants[match.status];
  const matchDate = new Date(match.startDate);
  const isLive = match.status === "ACTIVE";

  return (
    <Link href={`/schedule/${match.id}`}>
      <Card
        variant="bordered"
        className={clsx(
          "transition-all duration-200 hover:border-primary/50 hover:bg-surface-elevated/50",
          isLive && "border-primary/50 animate-pulse-glow"
        )}
      >
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <Badge variant={status.variant}>
              {isLive && (
                <span className="w-2 h-2 bg-current rounded-full mr-1.5 animate-pulse" />
              )}
              {status.label}
            </Badge>
            <span className="text-xs text-muted">{typeLabels[match.type]}</span>
          </div>

          {/* Teams */}
          <div className="flex items-center justify-between gap-4">
            {/* Team A */}
            <div className="flex-1 flex items-center gap-3">
              <Avatar size="lg" src={teamA?.logo || undefined} fallback={teamA?.name || "A"} />
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {teamA?.name || `Team ${match.teamAId}`}
                </p>
                {teamA && (
                  <p className="text-xs text-muted">
                    {teamA.victories}W - {teamA.mapWins}MW
                  </p>
                )}
              </div>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center">
              {match.status === "FINISHED" || match.status === "ACTIVE" ? (
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      "text-2xl font-bold font-mono",
                      match.mapWinsTeamA > match.mapWinsTeamB ? "text-success" : "text-foreground"
                    )}
                  >
                    {match.mapWinsTeamA}
                  </span>
                  <span className="text-muted">-</span>
                  <span
                    className={clsx(
                      "text-2xl font-bold font-mono",
                      match.mapWinsTeamB > match.mapWinsTeamA ? "text-success" : "text-foreground"
                    )}
                  >
                    {match.mapWinsTeamB}
                  </span>
                </div>
              ) : (
                <span className="text-lg font-medium text-muted">VS</span>
              )}
              <span className="text-xs text-muted mt-1">BO{match.bestOf}</span>
            </div>

            {/* Team B */}
            <div className="flex-1 flex items-center gap-3 justify-end">
              <div className="min-w-0 text-right">
                <p className="font-semibold text-foreground truncate">
                  {teamB?.name || `Team ${match.teamBId}`}
                </p>
                {teamB && (
                  <p className="text-xs text-muted">
                    {teamB.victories}W - {teamB.mapWins}MW
                  </p>
                )}
              </div>
              <Avatar size="lg" src={teamB?.logo || undefined} fallback={teamB?.name || "B"} />
            </div>
          </div>

          {/* Date */}
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-sm">
            <span className="text-muted">
              {matchDate.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="text-foreground font-medium">
              {matchDate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
