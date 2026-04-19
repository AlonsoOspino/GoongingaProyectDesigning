"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getLeaderboard } from "@/lib/api/team";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Team } from "@/lib/api/types";

type SortField = "rank" | "victories" | "mapWins" | "mapLoses" | "diff" | "winRate";
type SortDirection = "asc" | "desc";

export default function StandingsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getLeaderboard();
        setTeams(data);
      } catch (error) {
        console.error("Failed to fetch standings:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "rank" ? "asc" : "desc");
    }
  };

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortField) {
        case "rank":
          aVal = teams.indexOf(a);
          bVal = teams.indexOf(b);
          break;
        case "victories":
          aVal = a.victories;
          bVal = b.victories;
          break;
        case "mapWins":
          aVal = a.mapWins;
          bVal = b.mapWins;
          break;
        case "mapLoses":
          aVal = a.mapLoses;
          bVal = b.mapLoses;
          break;
        case "diff":
          aVal = a.mapWins - a.mapLoses;
          bVal = b.mapWins - b.mapLoses;
          break;
        case "winRate":
          aVal = a.mapWins + a.mapLoses > 0 ? a.mapWins / (a.mapWins + a.mapLoses) : 0;
          bVal = b.mapWins + b.mapLoses > 0 ? b.mapWins / (b.mapWins + b.mapLoses) : 0;
          break;
        default:
          return 0;
      }

      const multiplier = sortDirection === "asc" ? 1 : -1;
      return (aVal - bVal) * multiplier;
    });
  }, [teams, sortField, sortDirection]);

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-10 relative">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-1 h-10 bg-gradient-to-b from-primary to-accent rounded-full" />
          <h1 className="text-3xl font-bold text-foreground">Standings</h1>
        </div>
        <p className="text-muted ml-5">
          Current league standings sorted by victories and map differential
        </p>
        {/* Decorative element */}
        <div className="absolute -top-4 right-0 w-32 h-32 bg-gradient-to-bl from-primary/5 to-transparent rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Standings Table */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>League Standings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="w-8 h-8" />
                  <Skeleton className="w-12 h-12 rounded-full" variant="circular" />
                  <Skeleton className="flex-1 h-6" variant="text" />
                  <Skeleton className="w-16 h-6" variant="text" />
                  <Skeleton className="w-16 h-6" variant="text" />
                </div>
              ))}
            </div>
          ) : teams.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    sortable
                    sorted={sortField === "rank" ? sortDirection : false}
                    onClick={() => handleSort("rank")}
                    className="w-16"
                  >
                    Rank
                  </TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead
                    sortable
                    sorted={sortField === "victories" ? sortDirection : false}
                    onClick={() => handleSort("victories")}
                    className="text-center"
                  >
                    W
                  </TableHead>
                  <TableHead
                    sortable
                    sorted={sortField === "mapWins" ? sortDirection : false}
                    onClick={() => handleSort("mapWins")}
                    className="text-center"
                  >
                    MW
                  </TableHead>
                  <TableHead
                    sortable
                    sorted={sortField === "mapLoses" ? sortDirection : false}
                    onClick={() => handleSort("mapLoses")}
                    className="text-center"
                  >
                    ML
                  </TableHead>
                  <TableHead
                    sortable
                    sorted={sortField === "diff" ? sortDirection : false}
                    onClick={() => handleSort("diff")}
                    className="text-center"
                  >
                    Diff
                  </TableHead>
                  <TableHead
                    sortable
                    sorted={sortField === "winRate" ? sortDirection : false}
                    onClick={() => handleSort("winRate")}
                    className="text-center"
                  >
                    Win%
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTeams.map((team, idx) => {
                  const originalRank = teams.indexOf(team) + 1;
                  const mapDiff = team.mapWins - team.mapLoses;
                  const totalMaps = team.mapWins + team.mapLoses;
                  const winRate = totalMaps > 0 ? Math.round((team.mapWins / totalMaps) * 100) : 0;

                  return (
                    <TableRow key={team.id}>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {originalRank <= 3 ? (
                            <Badge
                              variant={
                                originalRank === 1 ? "primary" : originalRank === 2 ? "default" : "outline"
                              }
                            >
                              #{originalRank}
                            </Badge>
                          ) : (
                            <span className="text-muted font-medium">#{originalRank}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/teams/${team.id}`}
                          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                        >
                          <Avatar size="md" src={team.logo || undefined} fallback={team.name} />
                          <span className="font-medium text-foreground">{team.name}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold text-success font-mono">{team.victories}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono">{team.mapWins}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono text-muted">{team.mapLoses}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`font-bold font-mono ${
                            mapDiff > 0 ? "text-success" : mapDiff < 0 ? "text-danger" : "text-muted"
                          }`}
                        >
                          {mapDiff > 0 ? "+" : ""}{mapDiff}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono text-accent">{winRate}%</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center text-muted">
              <p>No teams found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted">
        <div className="flex items-center gap-2">
          <span className="font-medium">W</span>
          <span>= Match Victories</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">MW</span>
          <span>= Maps Won</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">ML</span>
          <span>= Maps Lost</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">Diff</span>
          <span>= Map Differential (MW - ML)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">Win%</span>
          <span>= Map Win Percentage</span>
        </div>
      </div>
    </div>
  );
}
