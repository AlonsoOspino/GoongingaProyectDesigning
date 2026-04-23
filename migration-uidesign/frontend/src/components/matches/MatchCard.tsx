"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { formatDateEST } from "@/lib/dateUtils";
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
  const hasDate = Boolean(match.startDate);
  const matchDate = hasDate ? new Date(match.startDate) : null;
  const isLive = match.status === "ACTIVE";
  const isFinished = match.status === "FINISHED";
  const teamAWon = isFinished && match.mapWinsTeamA > match.mapWinsTeamB;
  const teamBWon = isFinished && match.mapWinsTeamB > match.mapWinsTeamA;
  const isWeeklyMatch = match.type === "ROUNDROBIN" && match.semanas !== null;

  return (
    <Link href={`/schedule/${match.id}`}>
      <Card
        variant="featured"
        className={clsx(
          "overflow-hidden border-l-4 hover:scale-[1.02]",
          isLive && "border-primary animate-pulse-glow",
          isFinished && "border-l-success",
          match.status === "SCHEDULED" && "border-l-primary/50",
          match.status === "PENDINGREGISTERS" && "border-l-warning",
          !isLive && !isFinished && match.status !== "PENDINGREGISTERS" && "border-l-accent"
        )}
      >
        {/* Colored top accent bar based on status */}
        <div className={clsx(
          "h-1",
          isLive && "bg-gradient-to-r from-primary via-accent to-primary",
          isFinished && "bg-gradient-to-r from-success/50 via-success to-success/50",
          match.status === "SCHEDULED" && "bg-gradient-to-r from-border via-primary/30 to-border",
          match.status === "PENDINGREGISTERS" && "bg-gradient-to-r from-warning/50 via-warning to-warning/50"
        )} />
        
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <Badge variant={status.variant}>
              {isLive && (
                <span className="w-2 h-2 bg-current rounded-full mr-1.5 animate-pulse" />
              )}
              {status.label}
            </Badge>
            <div className="flex items-center gap-2">
              <span className={clsx(
                "text-xs px-2 py-0.5 rounded-full",
                match.type === "FINALS" && "bg-amber-500/10 text-amber-500 font-medium",
                match.type === "SEMIFINALS" && "bg-purple-500/10 text-purple-500 font-medium",
                match.type === "PLAYOFFS" && "bg-blue-500/10 text-blue-500 font-medium",
                match.type === "PLAYINS" && "bg-cyan-500/10 text-cyan-500 font-medium",
                match.type === "ROUNDROBIN" && "text-muted",
                match.type === "PRACTICE" && "text-muted/50"
              )}>
                {typeLabels[match.type]}
              </span>
            </div>
          </div>

          {/* Teams */}
          <div className="flex items-center justify-between gap-4">
            {/* Team A */}
            <div className={clsx(
              "flex-1 flex items-center gap-3 p-2 rounded-lg transition-colors",
              teamAWon && "bg-success/5 ring-1 ring-success/20"
            )}>
              <div className="relative">
                <Avatar size="lg" src={teamA?.logo || undefined} fallback={teamA?.name || "A"} />
                {teamAWon && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-success flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className={clsx(
                  "font-semibold truncate",
                  teamAWon ? "text-success" : "text-foreground"
                )}>
                  {teamA?.name || `Team ${match.teamAId}`}
                </p>
                {teamA && (
                  <p className="text-xs text-muted">
                    <span className="text-primary">{teamA.victories}W</span> - <span className="text-accent">{teamA.mapWins}MW</span>
                  </p>
                )}
              </div>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center px-4">
              {match.status === "FINISHED" || match.status === "ACTIVE" ? (
                <div className="flex items-center gap-3">
                  <span
                    className={clsx(
                      "text-2xl font-bold font-mono",
                      match.mapWinsTeamA > match.mapWinsTeamB ? "text-success" : "text-foreground/60"
                    )}
                  >
                    {match.mapWinsTeamA}
                  </span>
                  <div className="flex flex-col items-center">
                    <span className="text-muted text-xs">vs</span>
                  </div>
                  <span
                    className={clsx(
                      "text-2xl font-bold font-mono",
                      match.mapWinsTeamB > match.mapWinsTeamA ? "text-success" : "text-foreground/60"
                    )}
                  >
                    {match.mapWinsTeamB}
                  </span>
                </div>
              ) : (
                <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                  <span className="text-sm font-medium text-primary">VS</span>
                </div>
              )}
              <span className="text-xs text-muted mt-1.5 px-2 py-0.5 rounded-full bg-surface-elevated">BO{match.bestOf}</span>
            </div>

            {/* Team B */}
            <div className={clsx(
              "flex-1 flex items-center gap-3 justify-end p-2 rounded-lg transition-colors",
              teamBWon && "bg-success/5 ring-1 ring-success/20"
            )}>
              <div className="min-w-0 text-right">
                <p className={clsx(
                  "font-semibold truncate",
                  teamBWon ? "text-success" : "text-foreground"
                )}>
                  {teamB?.name || `Team ${match.teamBId}`}
                </p>
                {teamB && (
                  <p className="text-xs text-muted">
                    <span className="text-primary">{teamB.victories}W</span> - <span className="text-accent">{teamB.mapWins}MW</span>
                  </p>
                )}
              </div>
              <div className="relative">
                <Avatar size="lg" src={teamB?.logo || undefined} fallback={teamB?.name || "B"} />
                {teamBWon && (
                  <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-success flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Date or Week */}
          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-sm">
            {hasDate ? (
              <>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-muted">
                    {formatDateEST(match.startDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-accent/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-foreground font-medium">
                    {matchDate!.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "America/New_York",
                    })} EST
                  </span>
                </div>
              </>
            ) : isWeeklyMatch ? (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-accent/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-accent">{match.semanas}</span>
                </div>
                <span className="text-muted">Week {match.semanas}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary">STG</span>
                </div>
                <span className="text-muted">
                  {match.type === "PLAYINS"
                    ? "Play-ins"
                    : match.type === "PLAYOFFS"
                    ? "Playoffs"
                    : match.type === "SEMIFINALS"
                    ? "Semifinals"
                    : match.type === "FINALS"
                    ? "Finals"
                    : "Match"}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
