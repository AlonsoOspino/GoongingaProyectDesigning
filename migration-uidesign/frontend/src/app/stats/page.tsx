"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "@/features/session/SessionProvider";
import { getAllPlayerStats } from "@/lib/api/playerStat";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import type { PlayerStat, HeroRole, MapType } from "@/lib/api/types";

type SortField = "damage" | "healing" | "mitigation" | "kills" | "deaths" | "assists";

export default function StatsPage() {
  const { token, isHydrated } = useSession();
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [mapTypeFilter, setMapTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("damage");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    async function fetchStats() {
      try {
        // Stats require auth in most cases, but try without token first
        const data = token
          ? await getAllPlayerStats(token)
          : [];
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    }

    if (isHydrated) {
      fetchStats();
    }
  }, [token, isHydrated]);

  const filteredStats = useMemo(() => {
    return stats.filter((stat) => {
      if (roleFilter !== "all" && stat.role !== roleFilter) return false;
      if (mapTypeFilter !== "all" && stat.mapType !== mapTypeFilter) return false;
      return true;
    });
  }, [stats, roleFilter, mapTypeFilter]);

  const sortedStats = useMemo(() => {
    return [...filteredStats].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const multiplier = sortDirection === "asc" ? 1 : -1;
      return (aVal - bVal) * multiplier;
    });
  }, [filteredStats, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Aggregate stats by role
  const statsByRole = useMemo(() => {
    const roles: HeroRole[] = ["TANK", "DPS", "SUPPORT"];
    return roles.map((role) => {
      const roleStats = stats.filter((s) => s.role === role);
      if (roleStats.length === 0) return { role, avg: null };

      const avg = {
        damage: roleStats.reduce((acc, s) => acc + s.damagePer10, 0) / roleStats.length,
        healing: roleStats.reduce((acc, s) => acc + s.healingPer10, 0) / roleStats.length,
        mitigation: roleStats.reduce((acc, s) => acc + s.mitigationPer10, 0) / roleStats.length,
        kills: roleStats.reduce((acc, s) => acc + s.killsPer10, 0) / roleStats.length,
        deaths: roleStats.reduce((acc, s) => acc + s.deathsPer10, 0) / roleStats.length,
      };

      return { role, avg };
    });
  }, [stats]);

  const roleOptions = [
    { value: "all", label: "All Roles" },
    { value: "TANK", label: "Tank" },
    { value: "DPS", label: "DPS" },
    { value: "SUPPORT", label: "Support" },
  ];

  const mapTypeOptions = [
    { value: "all", label: "All Map Types" },
    { value: "CONTROL", label: "Control" },
    { value: "HYBRID", label: "Hybrid" },
    { value: "PAYLOAD", label: "Payload" },
    { value: "PUSH", label: "Push" },
    { value: "FLASHPOINT", label: "Flashpoint" },
  ];

  const roleColors: Record<HeroRole, string> = {
    TANK: "primary",
    DPS: "danger",
    SUPPORT: "success",
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-64" variant="text" />
        </div>
        <Skeleton className="h-64 mb-6" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 relative">
      {/* Decorative background */}
      <div className="fixed top-28 right-1/3 w-72 h-72 bg-danger/10 rounded-full blur-[110px] pointer-events-none" />
      <div className="fixed bottom-1/3 left-1/4 w-56 h-56 bg-success/10 rounded-full blur-[90px] pointer-events-none" />
      
      {/* Header */}
      <div className="mb-8 relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-8 bg-gradient-to-b from-danger to-success rounded-full" />
          <h1 className="text-3xl font-bold text-foreground">Stats Center</h1>
        </div>
        <p className="text-muted pl-4">Player performance statistics across all matches</p>
      </div>

      {stats.length > 0 ? (
        <>
          {/* Role Averages */}
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            {statsByRole.map(({ role, avg }) => (
              <Card key={role} variant="bordered">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge variant={roleColors[role] as "primary" | "danger" | "success"}>
                      {role}
                    </Badge>
                    <span className="text-sm text-muted">Avg per 10 min</span>
                  </div>
                  {avg ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xl font-bold text-danger font-mono">
                          {Math.round(avg.damage)}
                        </p>
                        <p className="text-xs text-muted">Damage</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-success font-mono">
                          {Math.round(avg.healing)}
                        </p>
                        <p className="text-xs text-muted">Healing</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-primary font-mono">
                          {Math.round(avg.mitigation)}
                        </p>
                        <p className="text-xs text-muted">Mitigation</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-accent font-mono">
                          {avg.kills.toFixed(1)}
                        </p>
                        <p className="text-xs text-muted">Elims</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted text-sm">No data</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <Card variant="bordered" className="mb-6">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Role"
                  options={roleOptions}
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                />
                <Select
                  label="Map Type"
                  options={mapTypeOptions}
                  value={mapTypeFilter}
                  onChange={(e) => setMapTypeFilter(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Stats Table */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Player Stats</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Map</TableHead>
                    <TableHead
                      sortable
                      sorted={sortField === "damage" ? sortDirection : false}
                      onClick={() => handleSort("damage")}
                      className="text-right"
                    >
                      Damage
                    </TableHead>
                    <TableHead
                      sortable
                      sorted={sortField === "healing" ? sortDirection : false}
                      onClick={() => handleSort("healing")}
                      className="text-right"
                    >
                      Healing
                    </TableHead>
                    <TableHead
                      sortable
                      sorted={sortField === "kills" ? sortDirection : false}
                      onClick={() => handleSort("kills")}
                      className="text-right"
                    >
                      Elims
                    </TableHead>
                    <TableHead
                      sortable
                      sorted={sortField === "deaths" ? sortDirection : false}
                      onClick={() => handleSort("deaths")}
                      className="text-right"
                    >
                      Deaths
                    </TableHead>
                    <TableHead
                      sortable
                      sorted={sortField === "assists" ? sortDirection : false}
                      onClick={() => handleSort("assists")}
                      className="text-right"
                    >
                      Assists
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedStats.slice(0, 50).map((stat) => (
                    <TableRow key={stat.id}>
                      <TableCell>
                        <span className="font-medium">Player #{stat.userId}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={roleColors[stat.role] as "primary" | "danger" | "success"}>
                          {stat.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted text-sm">{stat.mapType}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {stat.damage.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {stat.healing.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">{stat.kills}</TableCell>
                      <TableCell className="text-right font-mono">{stat.deaths}</TableCell>
                      <TableCell className="text-right font-mono">{stat.assists}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {sortedStats.length === 0 && (
                <div className="p-12 text-center text-muted">
                  No stats match your filters
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card variant="bordered">
          <CardContent className="py-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-muted"
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
              <h2 className="text-xl font-semibold text-foreground mb-2">
                No Stats Available
              </h2>
              <p className="text-muted">
                {token
                  ? "No player statistics have been recorded yet."
                  : "Sign in to view player statistics."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
