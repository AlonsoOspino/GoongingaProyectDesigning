"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getPublicPlayerStats } from "@/lib/api/playerStat";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { PlayerStat } from "@/lib/api/types";
import {
  buildPlayerAverages,
  sortByMetric,
  TOP_METRICS,
  type PlayerAverage,
  type TopMetricKey,
} from "@/lib/stats/playerAverages";

type SortOption = "metric" | "games" | "role";
type RoleFilter = "ALL" | "TANK" | "DPS" | "SUPPORT";

const ROLE_CONFIG: Record<PlayerAverage["role"], { label: string; text: string; bg: string; gradient: string; icon: ReactNode }> = {
  TANK: {
    label: "Tank",
    text: "text-primary",
    bg: "bg-primary/15",
    gradient: "from-primary/20 to-primary/5",
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2A11.954 11.954 0 0110 1.944z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  DPS: {
    label: "DPS",
    text: "text-danger",
    bg: "bg-danger/15",
    gradient: "from-danger/20 to-danger/5",
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm2 10.414l-4.293-4.293a1 1 0 011.414-1.414L10 7.586V4h2v3.586l.879-.879a1 1 0 111.414 1.414L10 12.414z" />
      </svg>
    ),
  },
  SUPPORT: {
    label: "Support",
    text: "text-success",
    bg: "bg-success/15",
    gradient: "from-success/20 to-success/5",
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
};

const METRIC_CONFIG: Record<TopMetricKey, { icon: ReactNode; color: string; bgColor: string; label: string; shortLabel: string }> = {
  killsPer10: {
    label: "Eliminations",
    shortLabel: "ELIM",
    color: "text-danger",
    bgColor: "bg-danger",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
  },
  damagePer10: {
    label: "Damage Output",
    shortLabel: "DMG",
    color: "text-primary",
    bgColor: "bg-primary",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      </svg>
    ),
  },
  mitigationPer10: {
    label: "Damage Blocked",
    shortLabel: "MIT",
    color: "text-accent",
    bgColor: "bg-accent",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  healingPer10: {
    label: "Healing Done",
    shortLabel: "HEAL",
    color: "text-success",
    bgColor: "bg-success",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
  },
  assistsPer10: {
    label: "Assists",
    shortLabel: "AST",
    color: "text-warning",
    bgColor: "bg-warning",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  deathsPer10: {
    label: "Deaths",
    shortLabel: "DTH",
    color: "text-muted",
    bgColor: "bg-muted",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "metric", label: "Performance" },
  { value: "games", label: "Experience" },
  { value: "role", label: "Role" },
];

const ROLE_FILTERS: { value: RoleFilter; label: string; icon?: ReactNode }[] = [
  { value: "ALL", label: "All Roles" },
  { value: "TANK", label: "Tank", icon: ROLE_CONFIG.TANK.icon },
  { value: "DPS", label: "DPS", icon: ROLE_CONFIG.DPS.icon },
  { value: "SUPPORT", label: "Support", icon: ROLE_CONFIG.SUPPORT.icon },
];

function formatMetric(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatLargeNumber(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString();
}

function getRoleBadgeVariant(role: PlayerAverage["role"]) {
  if (role === "TANK") return "primary" as const;
  if (role === "DPS") return "danger" as const;
  return "success" as const;
}

function getProgress(value: number, best: number, lowerIsBetter?: boolean) {
  if (!best || best <= 0) return 0;
  if (lowerIsBetter) return Math.max(8, Math.min(100, (best / Math.max(value, best)) * 100));
  return Math.max(8, Math.min(100, (value / best) * 100));
}

export default function StatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<TopMetricKey>("killsPer10");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("metric");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  useEffect(() => {
    async function load() {
      try {
        const data = await getPublicPlayerStats();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch public stats:", error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const averages = useMemo(() => buildPlayerAverages(stats), [stats]);
  const selectedMetricMeta = useMemo(
    () => TOP_METRICS.find((metric) => metric.key === selectedMetric) || TOP_METRICS[0],
    [selectedMetric]
  );
  const selectedMetricRanking = useMemo(() => sortByMetric(averages, selectedMetric), [averages, selectedMetric]);
  const selectedMetricLeader = selectedMetricRanking[0] || null;
  const metricBestValue = selectedMetricLeader?.[selectedMetric] || 0;
  const metricConfig = METRIC_CONFIG[selectedMetric];

  const leaderboardData = useMemo(() => {
    let data = sortByMetric(averages, selectedMetric);

    if (roleFilter !== "ALL") {
      data = data.filter((player) => player.role === roleFilter);
    }

    if (sortBy === "games") {
      data = [...data].sort((a, b) => b.games - a.games);
    } else if (sortBy === "role") {
      const roleOrder: Record<PlayerAverage["role"], number> = { TANK: 0, DPS: 1, SUPPORT: 2 };
      data = [...data].sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
    }

    return data.slice(0, 30);
  }, [averages, roleFilter, selectedMetric, sortBy]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    return averages
      .filter((player) => player.nickname.toLowerCase().includes(q))
      .sort((a, b) => b[selectedMetric] - a[selectedMetric])
      .slice(0, 8);
  }, [averages, searchQuery, selectedMetric]);

  const roleSummary = useMemo(() => {
    return averages.reduce(
      (acc, player) => {
        acc[player.role] += 1;
        return acc;
      },
      { TANK: 0, DPS: 0, SUPPORT: 0 }
    );
  }, [averages]);

  const totalGames = useMemo(() => averages.reduce((sum, player) => sum + player.games, 0), [averages]);

  const handlePlayerClick = useCallback(
    (userId: number) => {
      router.push(`/stats/${userId}`);
    },
    [router]
  );

  const clearSearch = useCallback(() => setSearchQuery(""), []);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setRoleFilter("ALL");
    setSortBy("metric");
    setSelectedMetric("killsPer10");
  }, []);

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && searchResults[0]) {
        handlePlayerClick(searchResults[0].userId);
      }
      if (event.key === "Escape") {
        clearSearch();
      }
    },
    [handlePlayerClick, searchResults, clearSearch]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-[1600px] px-4 py-8 lg:px-8 lg:py-12">
          <Skeleton className="mb-3 h-12 w-80" />
          <Skeleton className="mb-10 h-5 w-[32rem] max-w-full" variant="text" />
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="mt-8 h-20 rounded-2xl" />
          <Skeleton className="mt-6 h-[600px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient background effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-32 top-0 h-[600px] w-[600px] rounded-full bg-primary/6 blur-[180px]" />
        <div className="absolute -right-32 top-1/4 h-[500px] w-[500px] rounded-full bg-accent/5 blur-[160px]" />
        <div className="absolute bottom-0 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-success/4 blur-[200px]" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-10">
        {/* Hero Header */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Live Analytics
            </span>
            <span className="rounded-full bg-surface-elevated px-3 py-1 text-xs font-medium text-muted">
              Season 1
            </span>
          </div>
          
          <h1 className="font-display text-4xl uppercase leading-none tracking-wide text-foreground md:text-5xl lg:text-6xl">
            Player Performance
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted lg:text-lg text-pretty">
            Real-time competitive stats across all active players. Filter by role, sort by metrics, and discover the top performers.
          </p>
        </header>

        {/* Quick Stats Bar */}
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-surface/80 p-4 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-surface-elevated/80">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Total Players</p>
              <p className="mt-1 font-display text-3xl text-foreground">{averages.length}</p>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-surface/80 p-4 backdrop-blur-sm transition-all hover:border-accent/30 hover:bg-surface-elevated/80">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Games Tracked</p>
              <p className="mt-1 font-display text-3xl text-foreground">{formatLargeNumber(totalGames)}</p>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-surface/80 p-4 backdrop-blur-sm transition-all hover:border-success/30 hover:bg-surface-elevated/80">
            <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Role Distribution</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-primary">{roleSummary.TANK}T</span>
                <span className="text-danger">{roleSummary.DPS}D</span>
                <span className="text-success">{roleSummary.SUPPORT}S</span>
              </div>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-surface/80 p-4 backdrop-blur-sm transition-all hover:border-warning/30 hover:bg-surface-elevated/80">
            <div className="absolute inset-0 bg-gradient-to-br from-warning/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Leader</p>
              <p className="mt-1 truncate font-medium text-foreground">{selectedMetricLeader?.nickname || "-"}</p>
            </div>
          </div>
        </div>

        {/* Metric Selector - Horizontal Pills */}
        <section className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Focus Metric</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {TOP_METRICS.map((metric) => {
              const config = METRIC_CONFIG[metric.key];
              const isActive = selectedMetric === metric.key;
              const leader = sortByMetric(averages, metric.key)[0];

              return (
                <button
                  key={metric.key}
                  onClick={() => setSelectedMetric(metric.key)}
                  className={`group relative flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                    isActive
                      ? `border-transparent ${config.bgColor}/20 shadow-lg shadow-black/10`
                      : "border-border/50 bg-surface/60 hover:border-border hover:bg-surface-elevated/80"
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isActive ? `${config.bgColor}/20` : "bg-surface-elevated"} ${config.color} transition-colors`}>
                    {config.icon}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${isActive ? config.color : "text-foreground"}`}>
                      {config.label}
                    </p>
                    <p className="text-xs text-muted truncate max-w-[120px]">
                      {leader ? `${leader.nickname}: ${formatMetric(leader[metric.key])}` : "No data"}
                    </p>
                  </div>
                  {isActive && (
                    <div className={`ml-2 h-2 w-2 rounded-full ${config.bgColor} animate-pulse`} />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Search and Filters Section */}
        <section className="mb-8">
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface/60 backdrop-blur-sm">
            {/* Search Bar */}
            <div className="relative border-b border-border/50 p-4">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <svg className="h-5 w-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search players by name..."
                  className="w-full rounded-xl border border-border/50 bg-background/60 py-3 pl-12 pr-12 text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-muted transition-colors hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Search Results Dropdown */}
              {searchQuery && searchFocused && (
                <div className="absolute left-4 right-4 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border/70 bg-surface-elevated shadow-2xl shadow-black/40">
                  {searchResults.length > 0 ? (
                    <div className="max-h-[400px] overflow-y-auto p-2">
                      {searchResults.map((player, index) => {
                        const role = ROLE_CONFIG[player.role];
                        const rank = sortByMetric(averages, selectedMetric).findIndex(p => p.userId === player.userId) + 1;

                        return (
                          <button
                            key={player.userId}
                            onClick={() => handlePlayerClick(player.userId)}
                            className={`flex w-full items-center gap-4 rounded-lg p-3 text-left transition-colors hover:bg-surface ${index === 0 ? "bg-primary/5" : ""}`}
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated text-sm font-bold text-muted">
                              #{rank}
                            </div>
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${role.gradient} ${role.text}`}>
                              {role.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate font-semibold text-foreground">{player.nickname}</p>
                                <Badge variant={getRoleBadgeVariant(player.role)} className="shrink-0">{role.label}</Badge>
                              </div>
                              <div className="mt-0.5 flex items-center gap-3 text-sm text-muted">
                                <span>{player.games} games</span>
                                <span className="h-1 w-1 rounded-full bg-border" />
                                <span className={metricConfig.color}>
                                  {metricConfig.shortLabel}: {formatMetric(player[selectedMetric])}
                                </span>
                              </div>
                            </div>
                            <svg className="h-5 w-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <p className="text-muted">No players found for &quot;{searchQuery}&quot;</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3 p-4">
              {/* Role Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted">Role:</span>
                <div className="flex gap-1">
                  {ROLE_FILTERS.map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setRoleFilter(filter.value)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                        roleFilter === filter.value
                          ? filter.value === "ALL"
                            ? "bg-foreground text-background"
                            : `${ROLE_CONFIG[filter.value as Exclude<RoleFilter, "ALL">].bg} ${ROLE_CONFIG[filter.value as Exclude<RoleFilter, "ALL">].text}`
                          : "bg-surface-elevated text-muted hover:bg-border hover:text-foreground"
                      }`}
                    >
                      {filter.icon && <span className="h-4 w-4">{filter.icon}</span>}
                      <span className="hidden sm:inline">{filter.label}</span>
                      {!filter.icon && <span className="sm:hidden">{filter.label}</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-6 w-px bg-border/50" />

              {/* Sort Options */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted">Sort:</span>
                <div className="flex gap-1">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                        sortBy === option.value
                          ? `${metricConfig.bgColor}/15 ${metricConfig.color}`
                          : "bg-surface-elevated text-muted hover:bg-border hover:text-foreground"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {/* View Toggle */}
                <div className="flex rounded-lg border border-border/50 bg-surface-elevated p-0.5">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`rounded-md p-2 transition-colors ${viewMode === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
                    aria-label="Grid view"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`rounded-md p-2 transition-colors ${viewMode === "table" ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
                    aria-label="Table view"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </button>
                </div>

                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted hover:text-foreground">
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Leaderboard */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl uppercase tracking-wide text-foreground">
                {metricConfig.label} Leaderboard
              </h2>
              <p className="mt-1 text-sm text-muted">
                {roleFilter === "ALL" ? "All roles" : roleFilter} &middot; Top {leaderboardData.length} players
              </p>
            </div>
          </div>

          {leaderboardData.length === 0 ? (
            <div className="rounded-2xl border border-border/50 bg-surface/60 p-16 text-center backdrop-blur-sm">
              <p className="text-lg text-muted">No players match your current filters.</p>
              <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4">
                Reset Filters
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {leaderboardData.map((player, index) => {
                const role = ROLE_CONFIG[player.role];
                const progress = getProgress(player[selectedMetric], metricBestValue, selectedMetricMeta.lowerIsBetter);
                const isTop3 = index < 3;

                return (
                  <button
                    key={player.userId}
                    onClick={() => handlePlayerClick(player.userId)}
                    className={`group relative overflow-hidden rounded-2xl border text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 ${
                      isTop3
                        ? "border-primary/30 bg-gradient-to-br from-surface-elevated/90 to-surface/80"
                        : "border-border/40 bg-surface/70 hover:border-border hover:bg-surface-elevated/80"
                    } backdrop-blur-sm`}
                  >
                    {/* Rank Badge */}
                    <div className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                      index === 0
                        ? "bg-warning/20 text-warning"
                        : index === 1
                          ? "bg-foreground/10 text-foreground"
                          : index === 2
                            ? "bg-warning/10 text-warning/70"
                            : "bg-surface-elevated text-muted"
                    }`}>
                      {index + 1}
                    </div>

                    <div className="p-4">
                      {/* Player Info */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${role.gradient} ${role.text} shadow-lg shadow-black/10`}>
                          {role.icon}
                        </div>
                        <div className="min-w-0 flex-1 pr-8">
                          <p className="truncate font-semibold text-foreground group-hover:text-primary transition-colors">
                            {player.nickname}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant={getRoleBadgeVariant(player.role)} className="text-[10px]">{role.label}</Badge>
                            <span className="text-xs text-muted">{player.games} games</span>
                          </div>
                        </div>
                      </div>

                      {/* Main Metric */}
                      <div className="mb-3">
                        <div className="flex items-baseline justify-between mb-1.5">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted">{metricConfig.shortLabel}</span>
                          <span className={`font-mono text-2xl font-bold ${metricConfig.color}`}>
                            {formatMetric(player[selectedMetric])}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${metricConfig.bgColor} transition-all duration-500`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Secondary Stats */}
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/30">
                        <div className="text-center">
                          <p className="font-mono text-sm font-semibold text-foreground">{formatMetric(player.killsPer10)}</p>
                          <p className="text-[10px] text-muted">ELIM</p>
                        </div>
                        <div className="text-center">
                          <p className="font-mono text-sm font-semibold text-foreground">{formatLargeNumber(player.damagePer10)}</p>
                          <p className="text-[10px] text-muted">DMG</p>
                        </div>
                        <div className="text-center">
                          <p className="font-mono text-sm font-semibold text-foreground">{formatMetric(player.deathsPer10)}</p>
                          <p className="text-[10px] text-muted">DTH</p>
                        </div>
                      </div>
                    </div>

                    {/* Hover gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface/60 backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-surface-elevated/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Player</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted">Role</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted">Games</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted">{metricConfig.shortLabel}</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted">Progress</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {leaderboardData.map((player, index) => {
                      const role = ROLE_CONFIG[player.role];
                      const progress = getProgress(player[selectedMetric], metricBestValue, selectedMetricMeta.lowerIsBetter);

                      return (
                        <tr
                          key={player.userId}
                          onClick={() => handlePlayerClick(player.userId)}
                          className="group cursor-pointer transition-colors hover:bg-surface-elevated/50"
                        >
                          <td className="px-4 py-3">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                              index === 0
                                ? "bg-warning/20 text-warning"
                                : index === 1
                                  ? "bg-foreground/10 text-foreground"
                                  : index === 2
                                    ? "bg-warning/10 text-warning/70"
                                    : "bg-surface-elevated text-muted"
                            }`}>
                              {index + 1}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${role.gradient} ${role.text}`}>
                                {role.icon}
                              </div>
                              <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                                {player.nickname}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={getRoleBadgeVariant(player.role)}>{role.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-sm text-muted">
                            {player.games}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-mono text-lg font-bold ${metricConfig.color}`}>
                              {formatMetric(player[selectedMetric])}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-24 rounded-full bg-border/30 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${metricConfig.bgColor}`}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted w-10 text-right">{Math.round(progress)}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <svg className="h-5 w-5 text-muted group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
