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

export default function SchedulePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
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
      } catch (error) {
        console.error("Failed to fetch schedule:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // Get unique weeks
  const weeks = useMemo(() => {
    const uniqueWeeks = [...new Set(matches.map((m) => m.semanas))].sort(
      (a, b) => a - b
    );
    return uniqueWeeks;
  }, [matches]);

  // Get unique match types
  const matchTypes = useMemo(() => {
    const types = [...new Set(matches.map((m) => m.type))];
    return types;
  }, [matches]);

  // Filter matches
  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      if (weekFilter !== "all" && match.semanas !== parseInt(weekFilter)) {
        return false;
      }
      if (
        teamFilter !== "all" &&
        match.teamAId !== parseInt(teamFilter) &&
        match.teamBId !== parseInt(teamFilter)
      ) {
        return false;
      }
      if (typeFilter !== "all" && match.type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [matches, weekFilter, teamFilter, typeFilter]);

  // Group by status
  const liveMatches = filteredMatches.filter((m) => m.status === "ACTIVE");
  const upcomingMatches = filteredMatches
    .filter((m) => m.status === "SCHEDULED" || m.status === "PENDINGREGISTERS")
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const completedMatches = filteredMatches
    .filter((m) => m.status === "FINISHED")
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
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-10 relative">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-1 h-10 bg-gradient-to-b from-primary to-accent rounded-full" />
          <h1 className="text-3xl font-bold text-foreground">Schedule</h1>
        </div>
        <p className="text-muted ml-5">View all matches across the season</p>
        {/* Decorative element */}
        <div className="absolute -top-4 right-0 w-32 h-32 bg-gradient-to-bl from-accent/5 to-transparent rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Filters */}
      <Card variant="bordered" className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <Select
              label="Match Type"
              options={typeOptions}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
          {(weekFilter !== "all" || teamFilter !== "all" || typeFilter !== "all") && (
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <span className="text-sm text-muted">
                Showing {filteredMatches.length} of {matches.length} matches
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
            <div className="space-y-4">
              {upcomingMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  teamA={teamsById.get(match.teamAId)}
                  teamB={teamsById.get(match.teamBId)}
                />
              ))}
            </div>
          ) : (
            <Card variant="bordered">
              <CardContent className="py-12 text-center text-muted">
                No upcoming matches found
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
            <Card variant="bordered">
              <CardContent className="py-12 text-center text-muted">
                No completed matches found
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
