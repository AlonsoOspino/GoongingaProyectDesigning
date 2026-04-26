"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
  type TopMetricKey,
  type PlayerAverage,
} from "@/lib/stats/playerAverages";

// Role configuration with icons and colors
const ROLE_CONFIG: Record<string, { color: string; bgColor: string; icon: JSX.Element }> = {
  TANK: {
    color: "text-primary",
    bgColor: "bg-primary/15",
    icon: (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2A11.954 11.954 0 0110 1.944z" clipRule="evenodd" />
      </svg>
    ),
  },
  DPS: {
    color: "text-danger",
    bgColor: "bg-danger/15",
    icon: (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm2 10.414l-4.293-4.293a1 1 0 011.414-1.414L10 7.586V4h2v3.586l.879-.879a1 1 0 111.414 1.414L10 12.414z" />
      </svg>
    ),
  },
  SUPPORT: {
    color: "text-success",
    bgColor: "bg-success/15",
    icon: (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
      </svg>
    ),
  },
};

// Metric icons mapping
const METRIC_ICONS: Record<TopMetricKey, JSX.Element> = {
  killsPer10: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  ),
  damagePer10: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
    </svg>
  ),
  mitigationPer10: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  healingPer10: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  ),
  assistsPer10: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  deathsPer10: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
};

// Metric color mapping
const METRIC_COLORS: Record<TopMetricKey, { text: string; bg: string; border: string; glow: string }> = {
  killsPer10: { text: "text-danger", bg: "bg-danger/10", border: "border-danger/30", glow: "shadow-danger/20" },
  damagePer10: { text: "text-primary", bg: "bg-primary/10", border: "border-primary/30", glow: "shadow-primary/20" },
  mitigationPer10: { text: "text-accent", bg: "bg-accent/10", border: "border-accent/30", glow: "shadow-accent/20" },
  healingPer10: { text: "text-success", bg: "bg-success/10", border: "border-success/30", glow: "shadow-success/20" },
  assistsPer10: { text: "text-warning", bg: "bg-warning/10", border: "border-warning/30", glow: "shadow-warning/20" },
  deathsPer10: { text: "text-muted", bg: "bg-muted/10", border: "border-muted/30", glow: "shadow-muted/20" },
};

// Sort options for the leaderboard
type SortOption = "rank" | "games" | "role";
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "rank", label: "By Rank" },
  { value: "games", label: "By Games" },
  { value: "role", label: "By Role" },
];

// Role filter options
type RoleFilter = "ALL" | "TANK" | "DPS" | "SUPPORT";
const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "ALL", label: "All Roles" },
  { value: "TANK", label: "Tank" },
  { value: "DPS", label: "DPS" },
  { value: "SUPPORT", label: "Support" },
];

export default function StatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<TopMetricKey>("killsPer10");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("rank");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [showFilters, setShowFilters] = useState(false);

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

  // Filtered and sorted leaderboard data
  const leaderboardData = useMemo(() => {
    let data = sortByMetric(averages, selectedMetric);
    
    // Apply role filter
    if (roleFilter !== "ALL") {
      data = data.filter((p) => p.role === roleFilter);
    }
    
    // Apply secondary sort
    if (sortBy === "games") {
      data = [...data].sort((a, b) => b.games - a.games);
    } else if (sortBy === "role") {
      const roleOrder = { TANK: 0, DPS: 1, SUPPORT: 2 };
      data = [...data].sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
    }
    
    return data.slice(0, 25);
  }, [averages, selectedMetric, sortBy, roleFilter]);

  // Search results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return averages
      .filter((p) => p.nickname.toLowerCase().includes(q) || String(p.userId) === q)
      .slice(0, 8);
  }, [averages, searchQuery]);

  // Top leaders per metric for the overview cards
  const metricLeaders = useMemo(() => {
    return TOP_METRICS.map((metric) => {
      const sorted = sortByMetric(averages, metric.key);
      return {
        ...metric,
        top3: sorted.slice(0, 3),
      };
    });
  }, [averages]);

  const handlePlayerClick = useCallback(
    (userId: number) => {
      router.push(`/stats/${userId}`);
    },
    [router]
  );

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <Skeleton className="h-12 w-80 mb-2" />
          <Skeleton className="h-5 w-96 mb-10" variant="text" />
          <Skeleton className="h-16 w-full mb-8 rounded-2xl" />
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 mb-10">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[500px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-danger/6 rounded-full blur-[130px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-accent/4 rounded-full blur-[180px] rotate-45" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-8 lg:py-12">
        {/* Page Header */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15 border border-primary/25">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <Badge variant="primary" className="px-3 py-1">
              Analytics
            </Badge>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-2 text-balance">
            Player Statistics
          </h1>
          <p className="text-muted max-w-xl text-pretty">
            Comprehensive performance metrics and leaderboards across all competitive matches.
          </p>
        </header>

        {/* Search and Filters Section */}
        <section className="mb-10">
          <div className="relative">
            {/* Main search container */}
            <div
              className={`
                relative rounded-2xl border transition-all duration-300
                ${searchFocused 
                  ? "bg-surface-elevated border-primary/40 shadow-lg shadow-primary/10" 
                  : "bg-surface border-border/60 hover:border-border"
                }
              `}
            >
              <div className="flex items-center gap-3 px-5 py-4">
                {/* Search icon */}
                <svg
                  className={`w-5 h-5 transition-colors ${searchFocused ? "text-primary" : "text-muted"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>

                {/* Search input */}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  placeholder="Search players by name or ID..."
                  className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base"
                />

                {/* Clear button */}
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="p-1.5 rounded-lg hover:bg-border/50 transition-colors text-muted hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}

                {/* Divider */}
                <div className="w-px h-6 bg-border" />

                {/* Filter toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${showFilters 
                      ? "bg-primary/15 text-primary" 
                      : "hover:bg-surface-elevated text-muted hover:text-foreground"
                    }
                  `}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                  </svg>
                  Filters
                </button>
              </div>

              {/* Filters panel */}
              {showFilters && (
                <div className="px-5 pb-4 pt-0 border-t border-border/50">
                  <div className="flex flex-wrap items-center gap-4 pt-4">
                    {/* Role filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted">Role:</span>
                      <div className="flex gap-1">
                        {ROLE_FILTERS.map((filter) => (
                          <button
                            key={filter.value}
                            onClick={() => setRoleFilter(filter.value)}
                            className={`
                              px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                              ${roleFilter === filter.value
                                ? "bg-primary text-primary-foreground"
                                : "bg-surface-elevated text-muted hover:text-foreground"
                              }
                            `}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sort by */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted">Sort:</span>
                      <div className="flex gap-1">
                        {SORT_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setSortBy(option.value)}
                            className={`
                              px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                              ${sortBy === option.value
                                ? "bg-primary text-primary-foreground"
                                : "bg-surface-elevated text-muted hover:text-foreground"
                              }
                            `}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Search results dropdown */}
            {searchQuery && searchResults.length > 0 && searchFocused && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-surface-elevated border border-border rounded-xl shadow-xl shadow-black/30 z-50 overflow-hidden">
                <div className="p-2">
                  {searchResults.map((player) => (
                    <button
                      key={player.userId}
                      onClick={() => handlePlayerClick(player.userId)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface transition-colors text-left"
                    >
                      <div className={`w-8 h-8 rounded-lg ${ROLE_CONFIG[player.role]?.bgColor} flex items-center justify-center ${ROLE_CONFIG[player.role]?.color}`}>
                        {ROLE_CONFIG[player.role]?.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{player.nickname}</p>
                        <p className="text-xs text-muted">ID {player.userId} · {player.games} games</p>
                      </div>
                      <Badge variant={player.role === "TANK" ? "primary" : player.role === "DPS" ? "danger" : "success"}>
                        {player.role}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No results message */}
            {searchQuery && searchResults.length === 0 && searchFocused && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-surface-elevated border border-border rounded-xl shadow-xl shadow-black/30 z-50 p-6 text-center">
                <p className="text-muted">No players found for &quot;{searchQuery}&quot;</p>
              </div>
            )}
          </div>
        </section>

        {/* Metric Leaders Overview */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-foreground">Leaderboard Overview</h2>
            <span className="text-sm text-muted">{averages.length} players tracked</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {metricLeaders.map((metric) => {
              const colors = METRIC_COLORS[metric.key];
              const isSelected = selectedMetric === metric.key;
              
              return (
                <button
                  key={metric.key}
                  onClick={() => setSelectedMetric(metric.key)}
                  className={`
                    relative group text-left p-5 rounded-xl border transition-all duration-300
                    ${isSelected
                      ? `${colors.bg} ${colors.border} shadow-lg ${colors.glow}`
                      : "bg-surface border-border/60 hover:bg-surface-elevated hover:border-border"
                    }
                  `}
                >
                  {/* Metric header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>
                      {METRIC_ICONS[metric.key]}
                    </div>
                    {isSelected && (
                      <span className="text-xs font-medium text-primary bg-primary/15 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Metric label */}
                  <h3 className={`text-sm font-medium mb-3 ${isSelected ? colors.text : "text-muted"}`}>
                    {metric.label}
                  </h3>

                  {/* Top 3 players */}
                  <div className="space-y-2">
                    {metric.top3.map((player, idx) => (
                      <div key={player.userId} className="flex items-center gap-2">
                        <span className={`
                          w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                          ${idx === 0 ? "bg-warning/20 text-warning" : "bg-surface-elevated text-muted"}
                        `}>
                          {idx + 1}
                        </span>
                        <span className="text-sm text-foreground truncate flex-1">{player.nickname}</span>
                        <span className={`text-xs font-mono ${isSelected ? colors.text : "text-muted"}`}>
                          {player[metric.key].toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Main Leaderboard Table */}
        <section>
          <div className="bg-surface border border-border/60 rounded-2xl overflow-hidden">
            {/* Table header */}
            <div className="px-6 py-4 border-b border-border bg-surface-elevated/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${METRIC_COLORS[selectedMetric].bg} ${METRIC_COLORS[selectedMetric].text}`}>
                    {METRIC_ICONS[selectedMetric]}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {TOP_METRICS.find((m) => m.key === selectedMetric)?.label} Leaderboard
                    </h2>
                    <p className="text-sm text-muted">
                      Top {leaderboardData.length} players
                      {roleFilter !== "ALL" && ` · ${roleFilter} only`}
                    </p>
                  </div>
                </div>

                {/* Metric quick switcher */}
                <div className="hidden md:flex items-center gap-1 bg-surface-elevated rounded-lg p-1">
                  {TOP_METRICS.map((metric) => {
                    const colors = METRIC_COLORS[metric.key];
                    return (
                      <button
                        key={metric.key}
                        onClick={() => setSelectedMetric(metric.key)}
                        title={metric.label}
                        className={`
                          p-2 rounded-md transition-all
                          ${selectedMetric === metric.key
                            ? `${colors.bg} ${colors.text}`
                            : "text-muted hover:text-foreground hover:bg-border/30"
                          }
                        `}
                      >
                        {METRIC_ICONS[metric.key]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Table */}
            {leaderboardData.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-muted">No stats recorded yet for this category.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-16">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                        Player
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-24">
                        Role
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider w-20">
                        Games
                      </th>
                      <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider w-28 ${METRIC_COLORS[selectedMetric].text}`}>
                        {TOP_METRICS.find((m) => m.key === selectedMetric)?.label.replace("Top ", "").replace("Lowest ", "")}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider w-24">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {leaderboardData.map((player, index) => {
                      const rankDisplay = index + 1;
                      const isTop3 = rankDisplay <= 3;
                      const roleConfig = ROLE_CONFIG[player.role];
                      
                      return (
                        <tr
                          key={player.userId}
                          className="group hover:bg-surface-elevated/50 transition-colors"
                        >
                          {/* Rank */}
                          <td className="px-6 py-4">
                            <div className={`
                              w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
                              ${isTop3
                                ? rankDisplay === 1
                                  ? "bg-warning/20 text-warning"
                                  : rankDisplay === 2
                                    ? "bg-muted/30 text-foreground"
                                    : "bg-warning/10 text-warning/70"
                                : "bg-surface-elevated text-muted"
                              }
                            `}>
                              {rankDisplay}
                            </div>
                          </td>

                          {/* Player info */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl ${roleConfig?.bgColor} flex items-center justify-center ${roleConfig?.color}`}>
                                {roleConfig?.icon}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{player.nickname}</p>
                                <p className="text-xs text-muted">ID {player.userId}</p>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="px-6 py-4">
                            <Badge
                              variant={player.role === "TANK" ? "primary" : player.role === "DPS" ? "danger" : "success"}
                            >
                              {player.role}
                            </Badge>
                          </td>

                          {/* Games */}
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm text-muted font-mono">{player.games}</span>
                          </td>

                          {/* Value */}
                          <td className="px-6 py-4 text-right">
                            <span className={`text-lg font-bold font-mono ${METRIC_COLORS[selectedMetric].text}`}>
                              {player[selectedMetric].toLocaleString()}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="px-6 py-4 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePlayerClick(player.userId)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
