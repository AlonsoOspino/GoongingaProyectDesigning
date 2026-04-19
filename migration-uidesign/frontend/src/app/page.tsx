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
    <div className="min-h-screen relative">
      {/* Global decorative elements */}
      <div className="fixed inset-0 bg-grid-pattern-subtle pointer-events-none" />
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-80 h-80 bg-accent/15 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden">
        {/* Hero background effects */}
        <div className="absolute inset-0 bg-gradient-radial" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="absolute top-10 left-10 w-2 h-2 bg-primary rounded-full animate-pulse" />
        <div className="absolute top-20 right-20 w-1.5 h-1.5 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-20 left-1/4 w-1 h-1 bg-primary rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-accent rounded-full animate-pulse" style={{ animationDelay: '1.5s' }} />
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="primary" className="mb-4 glow-teal">
              Season 2026
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 text-balance text-glow">
              Welcome to the Goonginga League
            </h1>
            <p className="text-lg text-muted mb-8 text-pretty max-w-2xl mx-auto">
              The premier competitive Overwatch league. Track teams, follow matches, 
              and watch the best players compete for glory.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/schedule">
                <Button size="lg" className="glow-teal">View Schedule</Button>
              </Link>
              <Link href="/standings">
                <Button variant="outline" size="lg" className="animate-border-pulse">
                  Standings
                </Button>
              </Link>
            </div>
            
            {/* Decorative line */}
            <div className="mt-12 flex items-center justify-center gap-2">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-primary/50" />
              <div className="w-2 h-2 rotate-45 border border-primary/50" />
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-primary/50" />
            </div>
          </div>
        </div>
      </section>

      {/* Live/Active Matches */}
      {data.activeMatches.length > 0 && (
        <section className="py-8 bg-primary/5 border-y border-primary/20 relative overflow-hidden">
          {/* Animated background for live section */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          
          <div className="container mx-auto px-4 relative">
            <div className="flex items-center gap-3 mb-6">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-danger" />
              </span>
              <h2 className="text-xl font-bold text-foreground">Live Now</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-danger/30 to-transparent" />
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

      {/* About the League Section */}
      <section className="py-16 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 bg-gradient-to-b from-surface/50 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute -top-32 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 right-1/4 w-56 h-56 bg-accent/10 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="container mx-auto px-4 relative">
          {/* Section Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              About Us
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
              The Goonginga League Story
            </h2>
            <p className="text-muted max-w-2xl mx-auto text-pretty">
              Building a community of passionate Overwatch players since 2023
            </p>
          </div>

          {/* Content Grid with Images */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Column - Text Content */}
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-card border border-border relative overflow-hidden group hover:border-primary/30 transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-accent" />
                <div className="pl-4">
                  <h3 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Our Beginning
                  </h3>
                  <p className="text-muted leading-relaxed">
                    The Goonginga League was founded in 2023 by a group of friends who shared a passion for competitive Overwatch. What started as casual scrims among friends quickly grew into a full-fledged competitive league with teams from across the community.
                  </p>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-card border border-border relative overflow-hidden group hover:border-primary/30 transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-accent to-success" />
                <div className="pl-4">
                  <h3 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Live on Twitch
                  </h3>
                  <p className="text-muted leading-relaxed">
                    All our matches are streamed live on Twitch! Catch the action, watch player highlights, and experience the excitement of competitive Overwatch with our dedicated casting team and community chat.
                  </p>
                  <a 
                    href="https://www.twitch.tv/goongingatournament" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-3 text-[#9146FF] hover:text-[#9146FF]/80 font-medium text-sm transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                    </svg>
                    Watch our streams
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-card border border-border relative overflow-hidden group hover:border-primary/30 transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-success to-primary" />
                <div className="pl-4">
                  <h3 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Our Community
                  </h3>
                  <p className="text-muted leading-relaxed">
                    We pride ourselves on fostering a positive, welcoming environment. Our players range from aspiring pros to casual competitors, all united by their love for the game. Skill and sportsmanship go hand in hand here.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column - Images */}
            <div className="space-y-6">
              {/* Image 1 Placeholder */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-accent/50 rounded-2xl blur opacity-25 group-hover:opacity-50 transition-opacity" />
                <div className="relative aspect-video rounded-xl bg-surface-elevated border border-border overflow-hidden">
                  {/* Replace src with your actual image path */}
                  <img 
                    src="/emotionalsupport.png" 
                    alt="Goonginga League Match" 
                    className="w-full h-full object-cover"
                  />
                  <div className="hidden absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                    <svg className="w-12 h-12 text-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-muted">Match Highlight Image</span>
                  </div>
                </div>
                <div className="absolute bottom-3 left-3 px-3 py-1 rounded-md bg-background/80 backdrop-blur text-xs text-foreground font-medium">
                  Live Match Action
                </div>
              </div>

              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-accent/50 to-success/50 rounded-2xl blur opacity-25 group-hover:opacity-50 transition-opacity" />
                <div className="relative aspect-video rounded-xl bg-surface-elevated border border-border overflow-hidden">
                  <img 
                    src="/community.png" 
                    alt="Goonginga League Community" 
                    className="w-full h-full object-cover"
                  />
                  <div className="hidden absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-accent/20 to-success/20">
                    <svg className="w-12 h-12 text-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-muted">Community Image</span>
                  </div>
                </div>
                <div className="absolute bottom-3 left-3 px-3 py-1 rounded-md bg-background/80 backdrop-blur text-xs text-foreground font-medium">
                  Our Amazing Community
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-card border border-border text-center group hover:border-primary/30 transition-colors">
                  <div className="text-2xl font-bold text-primary mb-1">2024</div>
                  <div className="text-xs text-muted">Founded</div>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border text-center group hover:border-accent/30 transition-colors">
                  <div className="text-2xl font-bold text-accent mb-1">8+</div>
                  <div className="text-xs text-muted">Teams</div>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border text-center group hover:border-success/30 transition-colors">
                  <div className="text-2xl font-bold text-success mb-1">50+</div>
                  <div className="text-xs text-muted">Players</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* News Section */}
      {data.recentNews.length > 0 && (
        <section className="py-12 bg-surface relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-accent/10 rounded-full blur-[80px]" />
          
          <div className="container mx-auto px-4 relative">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-primary to-accent rounded-full" />
                <h2 className="text-2xl font-bold text-foreground">Latest News</h2>
              </div>
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
