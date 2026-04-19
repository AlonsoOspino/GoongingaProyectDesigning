import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeams } from "@/lib/api/team";
import { getMatches } from "@/lib/api/match";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MatchCard } from "@/components/matches/MatchCard";
import type { Team, Match } from "@/lib/api/types";

interface TeamPageProps {
  params: Promise<{ teamId: string }>;
}

async function getTeamData(teamId: number) {
  try {
    const [teams, matches] = await Promise.all([
      getTeams(),
      getMatches().catch(() => [] as Match[]),
    ]);

    const team = teams.find((t) => t.id === teamId);
    if (!team) return null;

    const teamsById = new Map(teams.map((t) => [t.id, t]));

    // Get team's matches
    const teamMatches = matches
      .filter((m) => m.teamAId === teamId || m.teamBId === teamId)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    const upcomingMatches = teamMatches
      .filter((m) => m.status === "SCHEDULED" || m.status === "ACTIVE")
      .slice(0, 5);

    const recentMatches = teamMatches
      .filter((m) => m.status === "FINISHED")
      .slice(0, 5);

    // Calculate stats
    const matchResults = recentMatches.map((m) => {
      const isTeamA = m.teamAId === teamId;
      const teamMaps = isTeamA ? m.mapWinsTeamA : m.mapWinsTeamB;
      const oppMaps = isTeamA ? m.mapWinsTeamB : m.mapWinsTeamA;
      return {
        match: m,
        won: teamMaps > oppMaps,
        draw: teamMaps === oppMaps && m.status === "FINISHED",
      };
    });

    const winStreak = matchResults.reduce((streak, r, idx) => {
      if (idx === 0 && r.won) return 1;
      if (r.won && idx > 0 && matchResults[idx - 1].won) return streak + 1;
      return streak;
    }, 0);

    return {
      team,
      teamsById,
      upcomingMatches,
      recentMatches,
      winStreak,
    };
  } catch (error) {
    console.error("Failed to fetch team data:", error);
    return null;
  }
}

export async function generateMetadata({ params }: TeamPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const teamId = parseInt(resolvedParams.teamId, 10);
  const data = await getTeamData(teamId);

  if (!data) {
    return { title: "Team Not Found" };
  }

  return {
    title: data.team.name,
    description: `View stats and matches for ${data.team.name} in the Goonginga League`,
  };
}

export default async function TeamPage({ params }: TeamPageProps) {
  const resolvedParams = await params;
  const teamId = parseInt(resolvedParams.teamId, 10);

  if (isNaN(teamId)) {
    notFound();
  }

  const data = await getTeamData(teamId);

  if (!data) {
    notFound();
  }

  const { team, teamsById, upcomingMatches, recentMatches, winStreak } = data;
  const mapDiff = team.mapWins - team.mapLoses;
  const totalMaps = team.mapWins + team.mapLoses;
  const winRate = totalMaps > 0 ? Math.round((team.mapWins / totalMaps) * 100) : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Link */}
      <Link
        href="/teams"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Teams
      </Link>

      {/* Team Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8">
        <Avatar size="xl" src={team.logo || undefined} fallback={team.name} className="w-24 h-24 text-2xl" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-foreground">{team.name}</h1>
            <Badge variant={mapDiff >= 0 ? "success" : "danger"}>
              {mapDiff > 0 ? "+" : ""}{mapDiff} Map Diff
            </Badge>
            {winStreak >= 3 && (
              <Badge variant="primary">
                {winStreak} Win Streak
              </Badge>
            )}
          </div>
          <p className="text-muted">Tournament #{team.tournamentId} • Founded 2023</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card variant="bordered">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-success font-mono">{team.victories}</p>
            <p className="text-sm text-muted">Match Victories</p>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary font-mono">{team.mapWins}</p>
            <p className="text-sm text-muted">Maps Won</p>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-danger font-mono">{team.mapLoses}</p>
            <p className="text-sm text-muted">Maps Lost</p>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-accent font-mono">{winRate}%</p>
            <p className="text-sm text-muted">Map Win Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Upcoming Matches */}
        <Card variant="bordered">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Matches</CardTitle>
            <Link href="/schedule">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingMatches.length > 0 ? (
              upcomingMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  teamA={teamsById.get(match.teamAId)}
                  teamB={teamsById.get(match.teamBId)}
                />
              ))
            ) : (
              <div className="text-center py-8 text-muted">
                <p>No upcoming matches scheduled</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Results */}
        <Card variant="bordered">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Results</CardTitle>
            <Link href="/schedule">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentMatches.length > 0 ? (
              recentMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  teamA={teamsById.get(match.teamAId)}
                  teamB={teamsById.get(match.teamBId)}
                />
              ))
            ) : (
              <div className="text-center py-8 text-muted">
                <p>No recent matches</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Roster Section (if available) */}
      {team.roster && (
        <Card variant="bordered" className="mt-8">
          <CardHeader>
            <CardTitle>Roster</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted whitespace-pre-wrap">{team.roster}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
