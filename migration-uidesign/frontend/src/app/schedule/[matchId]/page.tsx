import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatches } from "@/lib/api/match";
import { getTeams } from "@/lib/api/team";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Match, Team, MatchStatus, MatchType, MapType } from "@/lib/api/types";

interface MatchPageProps {
  params: Promise<{ matchId: string }>;
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

async function getMatchData(matchId: number) {
  try {
    const [matches, teams] = await Promise.all([getMatches(), getTeams()]);

    const match = matches.find((m) => m.id === matchId);
    if (!match) return null;

    const teamA = teams.find((t) => t.id === match.teamAId);
    const teamB = teams.find((t) => t.id === match.teamBId);

    return { match, teamA, teamB };
  } catch (error) {
    console.error("Failed to fetch match data:", error);
    return null;
  }
}

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const matchId = parseInt(resolvedParams.matchId, 10);
  const data = await getMatchData(matchId);

  if (!data) {
    return { title: "Match Not Found" };
  }

  const teamAName = data.teamA?.name || `Team ${data.match.teamAId}`;
  const teamBName = data.teamB?.name || `Team ${data.match.teamBId}`;

  return {
    title: `${teamAName} vs ${teamBName}`,
    description: `View details for the ${typeLabels[data.match.type]} match between ${teamAName} and ${teamBName}`,
  };
}

export default async function MatchPage({ params }: MatchPageProps) {
  const resolvedParams = await params;
  const matchId = parseInt(resolvedParams.matchId, 10);

  if (isNaN(matchId)) {
    notFound();
  }

  const data = await getMatchData(matchId);

  if (!data) {
    notFound();
  }

  const { match, teamA, teamB } = data;
  const status = statusVariants[match.status];
  const matchDate = new Date(match.startDate);
  const isLive = match.status === "ACTIVE";
  const isFinished = match.status === "FINISHED";

  const teamAName = teamA?.name || `Team ${match.teamAId}`;
  const teamBName = teamB?.name || `Team ${match.teamBId}`;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Link */}
      <Link
        href="/schedule"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Schedule
      </Link>

      {/* Match Header */}
      <Card variant="featured" className="mb-8">
        <CardContent className="p-8">
          {/* Status & Type */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <Badge variant={status.variant} className={isLive ? "animate-pulse" : ""}>
              {isLive && <span className="w-2 h-2 bg-current rounded-full mr-1.5" />}
              {status.label}
            </Badge>
            <Badge variant="outline">{typeLabels[match.type]}</Badge>
            <span className="text-sm text-muted">Best of {match.bestOf}</span>
          </div>

          {/* Teams & Score */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
            {/* Team A */}
            <Link href={`/teams/${match.teamAId}`} className="flex flex-col items-center gap-4 group">
              <Avatar
                size="xl"
                src={teamA?.logo || undefined}
                fallback={teamAName}
                className="w-24 h-24 text-2xl group-hover:ring-2 ring-primary transition-all"
              />
              <div className="text-center">
                <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  {teamAName}
                </h2>
                {teamA && (
                  <p className="text-sm text-muted">
                    {teamA.victories}W - {teamA.mapWins}MW
                  </p>
                )}
              </div>
            </Link>

            {/* Score */}
            <div className="flex flex-col items-center">
              {isFinished || isLive ? (
                <>
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-5xl font-bold font-mono ${
                        match.mapWinsTeamA > match.mapWinsTeamB
                          ? "text-success"
                          : "text-foreground"
                      }`}
                    >
                      {match.mapWinsTeamA}
                    </span>
                    <span className="text-2xl text-muted">-</span>
                    <span
                      className={`text-5xl font-bold font-mono ${
                        match.mapWinsTeamB > match.mapWinsTeamA
                          ? "text-success"
                          : "text-foreground"
                      }`}
                    >
                      {match.mapWinsTeamB}
                    </span>
                  </div>
                  <span className="text-sm text-muted mt-2">Maps</span>
                </>
              ) : (
                <span className="text-4xl font-bold text-muted">VS</span>
              )}
            </div>

            {/* Team B */}
            <Link href={`/teams/${match.teamBId}`} className="flex flex-col items-center gap-4 group">
              <Avatar
                size="xl"
                src={teamB?.logo || undefined}
                fallback={teamBName}
                className="w-24 h-24 text-2xl group-hover:ring-2 ring-primary transition-all"
              />
              <div className="text-center">
                <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  {teamBName}
                </h2>
                {teamB && (
                  <p className="text-sm text-muted">
                    {teamB.victories}W - {teamB.mapWins}MW
                  </p>
                )}
              </div>
            </Link>
          </div>

          {/* Match Info */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 pt-6 border-t border-border text-sm">
            <div className="text-center">
              <p className="text-muted">Date</p>
              <p className="font-medium text-foreground">
                {matchDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="text-center">
              <p className="text-muted">Time</p>
              <p className="font-medium text-foreground">
                {matchDate.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="text-center">
              <p className="text-muted">Week</p>
              <p className="font-medium text-foreground">{match.semanas}</p>
            </div>
            <div className="text-center">
              <p className="text-muted">Game</p>
              <p className="font-medium text-foreground">#{match.gameNumber}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Map Results */}
        {match.mapResults && match.mapResults.length > 0 && (
          <Card variant="featured">
            <CardHeader>
              <CardTitle>Map Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {match.mapResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-sm font-medium text-muted">
                        {result.gameNumber}
                      </span>
                      <span className="text-foreground">
                        {result.mapId ? `Map #${result.mapId}` : "TBD"}
                      </span>
                    </div>
                    <div>
                      {result.isDraw ? (
                        <Badge variant="default">Draw</Badge>
                      ) : result.winnerTeamId ? (
                        <Badge variant="success">
                          {result.winnerTeamId === match.teamAId ? teamAName : teamBName}
                        </Badge>
                      ) : (
                        <Badge variant="default">Pending</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ready Status */}
        <Card variant="featured">
          <CardHeader>
            <CardTitle>Team Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Avatar size="md" src={teamA?.logo || undefined} fallback={teamAName} />
                  <span className="font-medium text-foreground">{teamAName}</span>
                </div>
                {match.teamAready ? (
                  <Badge variant="success">Ready</Badge>
                ) : (
                  <Badge variant="default">Not Ready</Badge>
                )}
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Avatar size="md" src={teamB?.logo || undefined} fallback={teamBName} />
                  <span className="font-medium text-foreground">{teamBName}</span>
                </div>
                {match.teamBready ? (
                  <Badge variant="success">Ready</Badge>
                ) : (
                  <Badge variant="default">Not Ready</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {isLive && (
        <Card variant="featured" className="mt-8">
          <CardContent className="p-6 text-center">
            <p className="text-muted mb-4">This match is currently live!</p>
            <Link href="/draft">
              <Button>Go to Draft Room</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
