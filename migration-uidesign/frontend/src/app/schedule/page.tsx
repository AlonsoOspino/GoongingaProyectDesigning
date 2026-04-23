"use client";

import { useState, useEffect, useMemo } from "react";
import { getMatches } from "@/lib/api/match";
import { getTeams } from "@/lib/api/team";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { MatchCard } from "@/components/matches/MatchCard";
import type { Match, Team, MatchType, MatchStatus } from "@/lib/api/types";
import { getCurrentTournament } from "@/lib/api/admin";

const ALL_MATCH_TYPES: MatchType[] = [
  "ROUNDROBIN",
  "PLAYINS",
  "PLAYOFFS",
  "SEMIFINALS",
  "FINALS",
  "PRACTICE",
];

const ALLOWED_MATCH_TYPES_BY_STATE: Record<string, MatchType[]> = {
  SCHEDULED: ALL_MATCH_TYPES,
  ROUNDROBIN: ["ROUNDROBIN"],
  PLAYOFFS: ["PLAYINS", "PLAYOFFS"],
  SEMIFINALS: ["SEMIFINALS"],
  FINALS: ["FINALS"],
  FINISHED: ["FINALS"],
};

export default function SchedulePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournamentState, setTournamentState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekFilter, setWeekFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchData() {
      try {
        const [matchesData, teamsData] = await Promise.all([
          getMatches(),
          getTeams(),
        ]);
        setMatches(matchesData);
        setTeams(teamsData);
        const tournamentData = await getCurrentTournament().catch(() => null);
        setTournamentState(tournamentData?.state ?? null);
      } catch (error) {
        console.error("Failed to fetch schedule:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const visibleMatchTypes = useMemo(() => {
    if (!tournamentState) return ALL_MATCH_TYPES;
    return ALLOWED_MATCH_TYPES_BY_STATE[tournamentState] || ALL_MATCH_TYPES;
  }, [tournamentState]);

  const visibleMatches = useMemo(
    () => matches.filter((match) => visibleMatchTypes.includes(match.type)),
    [matches, visibleMatchTypes]
  );

  // Get unique weeks
  const weeks = useMemo(() => {
    const uniqueWeeks = [...new Set(visibleMatches.map((m) => m.semanas).filter((w): w is number => w !== null))].sort((a, b) => a - b);
    return uniqueWeeks;
  }, [visibleMatches]);

  // Get unique match types
  const matchTypes = useMemo(() => {
    const types = [...new Set(visibleMatches.map((m) => m.type))];
    return types;
  }, [visibleMatches]);

  // Filter matches
  const filteredMatches = useMemo(() => {
    return visibleMatches.filter((match) => {
      if (weekFilter !== "all" && match.semanas !== Number(weekFilter)) {
        return false;
      }
      if (
        teamFilter !== "all" &&
        match.teamAId !== Number(teamFilter) &&
        match.teamBId !== Number(teamFilter)
      ) {
        return false;
      }
      if (typeFilter !== "all" && match.type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [visibleMatches, weekFilter, teamFilter, typeFilter]);

  // Group by status - PENDINGREGISTERS treated as completed (not active)
  const liveMatches = filteredMatches.filter((m) => m.status === "ACTIVE");
  const upcomingMatches = filteredMatches
    .filter((m) => m.status === "SCHEDULED")
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const completedMatches = filteredMatches
    .filter((m) => m.status === "FINISHED" || m.status === "PENDINGREGISTERS")
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  const weekOptions = [
    { value: "all", label: "All Weeks" },
    ...weeks.map((w) => ({ value: String(w), label: `Week ${w}` })),
  ];

  const teamOptions = [
    { value: "all", label: "All Teams" },
    ...teams.map((t) => ({ value: String(t.id), label: t.name })),
  ];

  const typeOptions = [
    { value: "all", label: "All Types" },
    ...matchTypes.map((t) => ({ value: t, label: t.replace(/_/g, " ") })),
  ];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-64" variant="text" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Decorative background */}
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-radial-bottom pointer-events-none" />
      <div className="fixed inset-0 bg-grid-pattern-subtle pointer-events-none opacity-50" />
      
      <div className="container mx-auto px-4 py-8 relative">
        {/* Header */}
        <div className="mb-8 relative">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Schedule</h1>
              <p className="text-muted">View all matches across the season</p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-primary/50 via-accent/30 to-transparent" />
        </div>

        {/* Stats summary bar */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-surface/80 backdrop-blur border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">{liveMatches.length}</span>
            </div>
            <div>
              <p className="text-sm text-muted">Live Now</p>
              <p className="text-xs text-primary">{liveMatches.length > 0 ? "In Progress" : "None"}</p>
            </div>
          </div>
          <div className="bg-surface/80 backdrop-blur border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <span className="text-lg font-bold text-accent">{upcomingMatches.length}</span>
            </div>
            <div>
              <p className="text-sm text-muted">Upcoming</p>
              <p className="text-xs text-accent">Scheduled</p>
            </div>
          </div>
          <div className="bg-surface/80 backdrop-blur border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <span className="text-lg font-bold text-success">{completedMatches.length}</span>
            </div>
            <div>
              <p className="text-sm text-muted">Completed</p>
              <p className="text-xs text-success">Finished</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card variant="featured" className="mb-6 border-border/50 bg-surface/50 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="text-sm font-medium text-foreground">Filters</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Week"
                options={weekOptions}
                value={weekFilter}
                onChange={(e) => setWeekFilter(e.target.value)}
              />
              <Select
                label="Team"
                options={teamOptions}
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
              />
            </div>
            {(weekFilter !== "all" || teamFilter !== "all" || typeFilter !== "all") && (
              <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                <span className="text-sm text-muted">
                  Showing <span className="text-primary font-medium">{filteredMatches.length}</span> of {matches.length} matches
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setWeekFilter("all");
                    setTeamFilter("all");
                    setTypeFilter("all");
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Matches Tabs */}
        <Tabs defaultValue={liveMatches.length > 0 ? "live" : "upcoming"}>
          <TabsList>
            {liveMatches.length > 0 && (
              <TabsTrigger value="live">
                <span className="w-2 h-2 bg-danger rounded-full mr-2 animate-pulse" />
                Live ({liveMatches.length})
              </TabsTrigger>
            )}
            <TabsTrigger value="upcoming">Upcoming ({upcomingMatches.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedMatches.length})</TabsTrigger>
          </TabsList>

          {liveMatches.length > 0 && (
            <TabsContent value="live">
              <div className="space-y-4">
                {liveMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    teamA={teamsById.get(match.teamAId)}
                    teamB={teamsById.get(match.teamBId)}
                  />
                ))}
              </div>
            </TabsContent>
          )}

          <TabsContent value="upcoming">
            {upcomingMatches.length > 0 ? (
              (() => {
                // Group upcoming matches by week
                const weekMap = new Map();
                upcomingMatches.forEach((match) => {
                  const week = match.semanas;
                  if (week === null) return;
                  if (!weekMap.has(week)) weekMap.set(week, []);
                  weekMap.get(week).push(match);
                });
                const sortedWeeks = Array.from(weekMap.keys()).sort((a, b) => a - b);
                return (
                  <div className="space-y-8">
                    {sortedWeeks.map((week) => (
                      <div key={week}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                            <span className="text-sm font-bold text-accent">{week}</span>
                          </div>
                          <h3 className="text-lg font-bold text-foreground">Week {week}</h3>
                          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
                        </div>
                        <div className="space-y-4">
                          {weekMap.get(week).map((match: Match) => (
                            <MatchCard
                              key={match.id}
                              match={match}
                              teamA={teamsById.get(match.teamAId)}
                              teamB={teamsById.get(match.teamBId)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : (
              <Card variant="featured" className="border-border/50">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-accent/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-muted">No upcoming matches found</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed">
            {completedMatches.length > 0 ? (
              <div className="space-y-4">
                {completedMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    teamA={teamsById.get(match.teamAId)}
                    teamB={teamsById.get(match.teamBId)}
                  />
                ))}
              </div>
            ) : (
              <Card variant="featured" className="border-border/50">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-success/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-muted">No completed matches found</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
