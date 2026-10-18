import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTeams, getTeamPlayers } from "@/lib/api/team";
import { getMatches } from "@/lib/api/match";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MatchCard } from "@/components/matches/MatchCard";
import type { Match } from "@/lib/api/types";
import { resolveGenericBackendAsset } from "@/lib/assetUrls";

export const dynamic = "force-dynamic";

interface TeamPageProps {
  params: Promise<{ teamId: string }>;
}

async function getTeamData(teamId: number) {
  try {
    const [teams, matches, players] = await Promise.all([
      getTeams(),
      getMatches().catch(() => [] as Match[]),
      getTeamPlayers(teamId),
    ]);

    const team = teams.find((t) => t.id === teamId);
    if (!team) return null;

    const teamsById = new Map(teams.map((t) => [t.id, t]));

    // Get team's matches
    const teamMatches = matches
      .filter((m) => m.tournamentId === team.tournamentId && m.type !== "PRACTICE" && (m.teamAId === teamId || m.teamBId === teamId));

    const upcomingMatches = teamMatches
      .filter((m) => m.status === "SCHEDULED" || m.status === "ACTIVE")
      .sort((a, b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") ||
        (a.semanas ?? Infinity) - (b.semanas ?? Infinity) ||
        (a.startDate ? Date.parse(a.startDate) : Infinity) - (b.startDate ? Date.parse(b.startDate) : Infinity) || a.id - b.id)
      .slice(0, 5);

    const recentMatches = teamMatches
      .filter((m) => m.status === "FINISHED")
      .sort((a, b) => (b.semanas ?? 0) - (a.semanas ?? 0) ||
        (b.startDate ? Date.parse(b.startDate) : 0) - (a.startDate ? Date.parse(a.startDate) : 0) || b.id - a.id)
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

    const firstLoss = matchResults.findIndex((result) => !result.won);
    const winStreak = firstLoss === -1 ? matchResults.length : firstLoss;

    const teamMembers = players.map((player) => ({
      id: player.memberId, nickname: player.member.nickname || player.member.username,
      profilePic: player.member.avatarUrl, role: player.role,
    }));

    return {
      team,
      teamsById,
      upcomingMatches,
      recentMatches,
      winStreak,
      teamMembers,
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
    description: `View stats and matches for ${data.team.name} in the GGL`,
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

  const { team, teamsById, upcomingMatches, recentMatches, winStreak, teamMembers } = data;
  const mapDiff = team.mapWins - team.mapLoses;
  const totalMaps = team.mapWins + team.mapLoses;
  const winRate = totalMaps > 0 ? Math.round((team.mapWins / totalMaps) * 100) : 0;
  const profileCount = teamMembers?.length ?? 0;

  const rosterSrc = resolveGenericBackendAsset(team.roster);

  const resolveProfilePic = (value?: string | null) => {
    if (!value) return null;
    const cleaned = value.trim();
    if (!cleaned) return null;
    return resolveGenericBackendAsset(cleaned);
  };

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
        <div className="flex flex-wrap items-center gap-4">
          <Avatar size="xl" src={resolveGenericBackendAsset(team.logo) || undefined} alt={`${team.name} logo`} fallback={team.name} className="w-24 h-24 rounded-sm text-2xl [&_img]:object-contain" />
          {profileCount > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {teamMembers.slice(0, 6).map((member, index) => (
                  <Link
                    key={member.id}
                    href={`/stats/${member.id}`}
                    className="relative group"
                    style={{ zIndex: 6 - index }}
                  >
                    <div className="w-10 h-10 rounded-full border-2 border-card bg-card overflow-hidden transition-transform group-hover:scale-105">
                      {resolveProfilePic(member.profilePic) ? (
                        <img
                          src={resolveProfilePic(member.profilePic) || ""}
                          alt={member.nickname}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-primary/15 text-primary text-sm font-semibold">
                          {member.nickname.charAt(0)}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
              {profileCount > 6 && (
                <span className="text-xs text-muted-foreground">+{profileCount - 6}</span>
              )}
            </div>
          )}
        </div>
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
          <p className="text-muted">Team roster and match record</p>
          {team.divisionName && <p className="mt-2 text-sm text-accent">{team.divisionName}</p>}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground font-mono">{team.victories}</p>
            <p className="text-sm text-muted">Match Victories</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground font-mono">{team.mapWins}</p>
            <p className="text-sm text-muted">Maps Won</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground font-mono">{team.mapLoses}</p>
            <p className="text-sm text-muted">Maps Lost</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground font-mono">{winRate}%</p>
            <p className="text-sm text-muted">Map Win Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Roster Section (if available) */}
      {rosterSrc && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Roster</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative w-full overflow-hidden rounded-lg border border-border bg-surface">
              <Image
                src={rosterSrc}
                alt={`${team.name} roster`}
                width={1400}
                height={900}
                className="h-auto w-full object-contain"
                unoptimized
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Grid */}
      <Card className="mb-8">
        <CardHeader><CardTitle>Players & Captain</CardTitle></CardHeader>
        <CardContent>
          {teamMembers.length ? <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teamMembers.map((member) => <li key={member.id} className="flex items-center gap-3 border border-border p-3">
              <Avatar src={resolveProfilePic(member.profilePic) || undefined} fallback={member.nickname} alt={member.nickname} />
              <Link href={`/stats/${member.id}?tournamentId=${team.tournamentId}`} className="min-w-0 flex-1 break-words font-medium hover:text-accent">{member.nickname}</Link>
              {member.role === "CAPTAIN" && <Badge variant="primary">Captain</Badge>}
            </li>)}
          </ul> : <p className="text-sm text-muted">The roster will be announced here.</p>}
        </CardContent>
      </Card>
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Upcoming Matches, limited to 2 */ }
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Matches</CardTitle>
            <Link href="/schedule">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingMatches.length > 0 ? (
              upcomingMatches.slice(0, 2).map((match) => (
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Results</CardTitle>
            <Link href="/schedule">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentMatches.length > 0 ? (
              recentMatches.slice(0, 2).map((match) => (
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

    </div>
  );
}
