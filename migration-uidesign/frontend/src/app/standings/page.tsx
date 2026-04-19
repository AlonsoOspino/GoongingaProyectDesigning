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
    <div className="min-h-screen relative">
      {/* Decorative background elements */}
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-radial-bottom pointer-events-none" />
      <div className="fixed inset-0 bg-grid-pattern-subtle pointer-events-none opacity-50" />
      
      <div className="container mx-auto px-4 py-8 relative">
        {/* Header */}
        <div className="mb-8 relative">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Standings</h1>
              <p className="text-muted">Current league standings sorted by victories and map differential</p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-primary/50 via-accent/30 to-transparent" />
        </div>

        {/* Top 3 Podium */}
        {!loading && teams.length >= 3 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {/* 2nd Place */}
            <div className="bg-surface/80 backdrop-blur border border-border rounded-xl p-4 flex flex-col items-center order-1">
              <div className="w-10 h-10 rounded-full bg-slate-400/20 border-2 border-slate-400 flex items-center justify-center mb-3">
                <span className="font-bold text-slate-400">2</span>
              </div>
              <Avatar size="xl" src={teams[1]?.logo || undefined} fallback={teams[1]?.name || "2"} />
              <p className="font-semibold text-foreground mt-2 text-center truncate w-full">{teams[1]?.name}</p>
              <p className="text-xs text-muted">{teams[1]?.victories}W - {teams[1]?.mapWins}MW</p>
            </div>
            
            {/* 1st Place */}
            <div className="bg-gradient-to-b from-amber-500/10 to-surface/80 backdrop-blur border border-amber-500/30 rounded-xl p-4 flex flex-col items-center order-2 -mt-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
              <Avatar size="xl" src={teams[0]?.logo || undefined} fallback={teams[0]?.name || "1"} />
              <p className="font-bold text-amber-500 mt-2 text-center truncate w-full">{teams[0]?.name}</p>
              <p className="text-xs text-amber-500/70">{teams[0]?.victories}W - {teams[0]?.mapWins}MW</p>
            </div>
            
            {/* 3rd Place */}
            <div className="bg-surface/80 backdrop-blur border border-border rounded-xl p-4 flex flex-col items-center order-3">
              <div className="w-10 h-10 rounded-full bg-amber-700/20 border-2 border-amber-700 flex items-center justify-center mb-3">
                <span className="font-bold text-amber-700">3</span>
              </div>
              <Avatar size="xl" src={teams[2]?.logo || undefined} fallback={teams[2]?.name || "3"} />
              <p className="font-semibold text-foreground mt-2 text-center truncate w-full">{teams[2]?.name}</p>
              <p className="text-xs text-muted">{teams[2]?.victories}W - {teams[2]?.mapWins}MW</p>
            </div>
          </div>
        )}

        {/* Standings Table */}
        <Card variant="bordered" className="border-border/50 bg-surface/50 backdrop-blur overflow-hidden">
          <CardHeader className="border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <CardTitle>League Standings</CardTitle>
            </div>
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
                    <TableRow key={team.id} className={
                      originalRank === 1 ? "bg-amber-500/5" :
                      originalRank === 2 ? "bg-slate-400/5" :
                      originalRank === 3 ? "bg-amber-700/5" : ""
                    }>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {originalRank === 1 ? (
                            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center">
                              <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                              </svg>
                            </div>
                          ) : originalRank === 2 ? (
                            <div className="w-8 h-8 rounded-full bg-slate-400/20 border border-slate-400/50 flex items-center justify-center">
                              <span className="font-bold text-slate-400">2</span>
                            </div>
                          ) : originalRank === 3 ? (
                            <div className="w-8 h-8 rounded-full bg-amber-700/20 border border-amber-700/50 flex items-center justify-center">
                              <span className="font-bold text-amber-700">3</span>
                            </div>
                          ) : (
                            <span className="text-muted font-medium">#{originalRank}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/teams/${team.id}`}
                          className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
                        >
                          <div className="relative">
                            <Avatar size="md" src={team.logo || undefined} fallback={team.name} />
                            {originalRank <= 3 && (
                              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                originalRank === 1 ? "bg-amber-500 text-white" :
                                originalRank === 2 ? "bg-slate-400 text-white" :
                                "bg-amber-700 text-white"
                              }`}>
                                {originalRank}
                              </div>
                            )}
                          </div>
                          <span className={`font-medium group-hover:text-primary transition-colors ${
                            originalRank === 1 ? "text-amber-500" : "text-foreground"
                          }`}>{team.name}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold text-success font-mono px-2 py-0.5 rounded bg-success/10">{team.victories}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono text-primary">{team.mapWins}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono text-danger/70">{team.mapLoses}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`font-bold font-mono px-2 py-0.5 rounded ${
                            mapDiff > 0 ? "text-success bg-success/10" : mapDiff < 0 ? "text-danger bg-danger/10" : "text-muted"
                          }`}
                        >
                          {mapDiff > 0 ? "+" : ""}{mapDiff}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-12 h-1.5 rounded-full bg-border overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                              style={{ width: `${winRate}%` }}
                            />
                          </div>
                          <span className="font-mono text-accent text-sm">{winRate}%</span>
                        </div>
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
        <div className="mt-6 bg-surface/50 backdrop-blur border border-border/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-foreground">Legend</span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted">
            <div className="flex items-center gap-2">
              <span className="font-medium text-success bg-success/10 px-1.5 py-0.5 rounded">W</span>
              <span>= Match Victories</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-primary">MW</span>
              <span>= Maps Won</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-danger/70">ML</span>
              <span>= Maps Lost</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Diff</span>
              <span>= Map Differential (MW - ML)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-accent">Win%</span>
              <span>= Map Win Percentage</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
