import type { Metadata } from "next";
import { getTeams } from "@/lib/api/team";
import { Card, CardContent } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import type { Team } from "@/lib/api/types";

export const metadata: Metadata = {
  title: "Teams",
  description: "View all teams competing in the Goonginga League",
};

async function getTeamsData() {
  try {
    const teams = await getTeams();
    return teams.sort((a, b) => b.victories - a.victories);
  } catch (error) {
    console.error("Failed to fetch teams:", error);
    return [];
  }
}

export default async function TeamsPage() {
  const teams = await getTeamsData();

  return (
    <div className="container mx-auto px-4 py-8 relative">
      {/* Decorative background */}
      <div className="fixed top-24 right-1/4 w-72 h-72 bg-success/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/3 left-1/4 w-56 h-56 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Header */}
      <div className="mb-8 relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-8 bg-gradient-to-b from-success to-primary rounded-full" />
          <h1 className="text-3xl font-bold text-foreground">Teams</h1>
        </div>
        <p className="text-muted pl-4">
          All teams competing in the Goonginga League this season
        </p>
      </div>

      {/* Teams Grid */}
      {teams.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team, idx) => (
            <TeamCardLarge key={team.id} team={team} rank={idx + 1} />
          ))}
        </div>
      ) : (
        <Card variant="bordered">
          <CardContent className="py-12 text-center">
            <p className="text-muted">No teams found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TeamCardLarge({ team, rank }: { team: Team; rank: number }) {
  const mapDiff = team.mapWins - team.mapLoses;
  const winRate = team.mapWins + team.mapLoses > 0
    ? Math.round((team.mapWins / (team.mapWins + team.mapLoses)) * 100)
    : 0;

  return (
    <Link href={`/teams/${team.id}`}>
      <Card
        variant="bordered"
        className="h-full transition-all duration-200 hover:border-primary/50 hover:bg-surface-elevated/50"
      >
        <CardContent className="p-6">
          {/* Rank Badge */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              {rank <= 3 && (
                <Badge
                  variant={rank === 1 ? "primary" : rank === 2 ? "default" : "outline"}
                >
                  #{rank}
                </Badge>
              )}
              {rank > 3 && (
                <span className="text-sm text-muted font-medium">#{rank}</span>
              )}
            </div>
            <Badge
              variant={mapDiff > 0 ? "success" : mapDiff < 0 ? "danger" : "default"}
            >
              {mapDiff > 0 ? "+" : ""}{mapDiff} diff
            </Badge>
          </div>

          {/* Team Info */}
          <div className="flex items-center gap-4 mb-6">
            <Avatar size="xl" src={team.logo || undefined} fallback={team.name} />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-foreground truncate">
                {team.name}
              </h3>
              <p className="text-sm text-muted">Tournament #{team.tournamentId} • Founded 2023</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
            <div className="text-center">
              <p className="text-2xl font-bold text-success font-mono">{team.victories}</p>
              <p className="text-xs text-muted">Victories</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground font-mono">
                {team.mapWins}-{team.mapLoses}
              </p>
              <p className="text-xs text-muted">Maps W-L</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-accent font-mono">{winRate}%</p>
              <p className="text-xs text-muted">Win Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
