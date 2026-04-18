import Link from "next/link";
import { getMatches, getSoonestMatch, getActiveMatches } from "@/lib/api/match";
import { getLeaderboard } from "@/lib/api/team";
import { getNews } from "@/lib/api/news";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MatchCard } from "@/components/matches/MatchCard";
import { TeamCard } from "@/components/teams/TeamCard";
import { NewsCard } from "@/components/news/NewsCard";
import type { Match, Team, NewsItem } from "@/lib/api/types";

async function getHomeData() {
  try {
    const [matches, teams, news] = await Promise.all([
      getMatches().catch(() => [] as Match[]),
      getLeaderboard().catch(() => [] as Team[]),
      getNews().catch(() => [] as NewsItem[]),
    ]);

    // Get active matches
    const activeMatches = matches.filter((m) => m.status === "ACTIVE");

    // Get upcoming matches (scheduled and in the future)
    const now = new Date();
    const upcomingMatches = matches
      .filter((m) => m.status === "SCHEDULED" && new Date(m.startDate) > now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 3);

    // Get recent matches (finished)
    const recentMatches = matches
      .filter((m) => m.status === "FINISHED")
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .slice(0, 3);

    // Top 5 teams
    const topTeams = teams.slice(0, 5);

    // Create team lookup
    const teamsById = new Map(teams.map((t) => [t.id, t]));

    // Recent news
    const recentNews = news.slice(0, 4);

    return {
      activeMatches,
      upcomingMatches,
      recentMatches,
      topTeams,
      teamsById,
      recentNews,
    };
  } catch (error) {
    console.error("Failed to fetch home data:", error);
    return {
      activeMatches: [],
      upcomingMatches: [],
      recentMatches: [],
      topTeams: [],
      teamsById: new Map(),
      recentNews: [],
    };
  }
}

export default async function HomePage() {
  const data = await getHomeData();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="primary" className="mb-4">
              Season 2026
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 text-balance">
              Welcome to the Goonginga League
            </h1>
            <p className="text-lg text-muted mb-8 text-pretty max-w-2xl mx-auto">
              The premier competitive Overwatch league. Track teams, follow matches, 
              and watch the best players compete for glory.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/schedule">
                <Button size="lg">View Schedule</Button>
              </Link>
              <Link href="/standings">
                <Button variant="outline" size="lg">
                  Standings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Live/Active Matches */}
      {data.activeMatches.length > 0 && (
        <section className="py-8 bg-primary/5 border-y border-primary/20">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-3 h-3 bg-danger rounded-full animate-pulse" />
              <h2 className="text-xl font-bold text-foreground">Live Now</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.activeMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  teamA={data.teamsById.get(match.teamAId)}
                  teamB={data.teamsById.get(match.teamBId)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main Content Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Upcoming Matches */}
            <div className="lg:col-span-2">
              <Card variant="bordered">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Upcoming Matches</CardTitle>
                  <Link href="/schedule">
                    <Button variant="ghost" size="sm">
                      View All
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.upcomingMatches.length > 0 ? (
                    data.upcomingMatches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        teamA={data.teamsById.get(match.teamAId)}
                        teamB={data.teamsById.get(match.teamBId)}
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
              {data.recentMatches.length > 0 && (
                <Card variant="bordered" className="mt-8">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Recent Results</CardTitle>
                    <Link href="/schedule">
                      <Button variant="ghost" size="sm">
                        View All
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {data.recentMatches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        teamA={data.teamsById.get(match.teamAId)}
                        teamB={data.teamsById.get(match.teamBId)}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              {/* Standings Preview */}
              <Card variant="bordered">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Standings</CardTitle>
                  <Link href="/standings">
                    <Button variant="ghost" size="sm">
                      Full Table
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.topTeams.length > 0 ? (
                    data.topTeams.map((team, idx) => (
                      <TeamCard key={team.id} team={team} rank={idx + 1} />
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted">
                      <p>No teams available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Links */}
              <Card variant="bordered">
                <CardHeader>
                  <CardTitle>Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link
                    href="/stats"
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-elevated transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-accent"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Stats Center</p>
                      <p className="text-xs text-muted">Player performance data</p>
                    </div>
                  </Link>
                  <Link
                    href="/teams"
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-elevated transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-success"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">All Teams</p>
                      <p className="text-xs text-muted">View all league teams</p>
                    </div>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* News Section */}
      {data.recentNews.length > 0 && (
        <section className="py-12 bg-surface">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-foreground">Latest News</h2>
              <Link href="/news">
                <Button variant="ghost">View All News</Button>
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {data.recentNews.map((article) => (
                <NewsCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
