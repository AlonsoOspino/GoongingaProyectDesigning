"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getPublicPlayerStats } from "@/lib/api/playerStat";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
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

const ROLE_CONFIG: Record<PlayerAverage["role"], { label: string; text: string; bg: string; icon: ReactNode }> = {
  TANK: {
    label: "Tank",
    text: "text-primary",
    bg: "bg-primary/15",
    icon: (
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
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
    icon: (
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm2 10.414l-4.293-4.293a1 1 0 011.414-1.414L10 7.586V4h2v3.586l.879-.879a1 1 0 111.414 1.414L10 12.414z" />
      </svg>
    ),
  },
  SUPPORT: {
    label: "Support",
    text: "text-success",
    bg: "bg-success/15",
    icon: (
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
};

const METRIC_ICONS: Record<TopMetricKey, ReactNode> = {
  killsPer10: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  ),
  damagePer10: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
    </svg>
  ),
  mitigationPer10: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  healingPer10: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  ),
  assistsPer10: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  deathsPer10: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
};

const METRIC_COLORS: Record<TopMetricKey, { text: string; bg: string; border: string }> = {
  killsPer10: { text: "text-danger", bg: "bg-danger/10", border: "border-danger/30" },
  damagePer10: { text: "text-primary", bg: "bg-primary/10", border: "border-primary/30" },
  mitigationPer10: { text: "text-accent", bg: "bg-accent/10", border: "border-accent/30" },
  healingPer10: { text: "text-success", bg: "bg-success/10", border: "border-success/30" },
  assistsPer10: { text: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
  deathsPer10: { text: "text-muted", bg: "bg-muted/10", border: "border-muted/30" },
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "metric", label: "Focus metric" },
  { value: "games", label: "Games played" },
  { value: "role", label: "Role" },
];

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "TANK", label: "Tank" },
  { value: "DPS", label: "DPS" },
  { value: "SUPPORT", label: "Support" },
];

function formatMetric(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function getRoleBadgeVariant(role: PlayerAverage["role"]) {
  if (role === "TANK") return "primary" as const;
  if (role === "DPS") return "danger" as const;
  return "success" as const;
}

function getProgress(value: number, best: number, lowerIsBetter?: boolean) {
  if (!best || best <= 0) return 0;
  if (lowerIsBetter) return Math.max(12, Math.min(100, (best / Math.max(value, best)) * 100));
  return Math.max(12, Math.min(100, (value / best) * 100));
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
  const selectedMetricTop3 = selectedMetricRanking.slice(0, 3);
  const metricBestValue = selectedMetricLeader?.[selectedMetric] || 0;

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

    return data.slice(0, 25);
  }, [averages, roleFilter, selectedMetric, sortBy]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    return averages
      .filter((player) => player.nickname.toLowerCase().includes(q))
      .sort((a, b) => b[selectedMetric] - a[selectedMetric])
      .slice(0, 6);
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
  const topRole = Object.entries(roleSummary).sort((a, b) => b[1] - a[1])[0];

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
    },
    [handlePlayerClick, searchResults]
  );

  const selectedMetricColors = METRIC_COLORS[selectedMetric];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:py-12">
          <Skeleton className="mb-4 h-16 w-96" />
          <Skeleton className="mb-8 h-5 w-[38rem] max-w-full" variant="text" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-44 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="mt-8 h-40 rounded-2xl" />
          <Skeleton className="mt-6 h-[520px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/4 top-0 h-[540px] w-[540px] rounded-full bg-primary/8 blur-[150px]" />
        <div className="absolute right-1/4 top-1/3 h-[420px] w-[420px] rounded-full bg-accent/6 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-[520px] w-[520px] rounded-full bg-success/5 blur-[160px]" />
        <div className="absolute inset-0 bg-grid-pattern-subtle opacity-30" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 lg:py-12">
        <header className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="primary" className="px-3 py-1.5 uppercase tracking-[0.18em]">
              Analytics hub
            </Badge>
            <Badge variant="outline" className="px-3 py-1.5">
              {averages.length} players tracked
            </Badge>
            <Badge variant="secondary" className="px-3 py-1.5">
              {selectedMetricMeta.label}
            </Badge>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.35fr,0.65fr] xl:items-end">
            <div className="space-y-4">
              <h1 className="max-w-3xl font-display text-5xl uppercase leading-none tracking-[0.06em] text-foreground lg:text-7xl">
                Player stats
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted lg:text-lg text-pretty">
                Clean scouting view, quick search, and a leaderboard built to scan fast. The display type is intentionally more athletic and the cards are tuned to feel less flat.
              </p>
            </div>

            <Card variant="featured" className="border-primary/25 bg-surface-elevated/70 shadow-xl shadow-black/20 backdrop-blur">
              <CardContent className="grid grid-cols-2 gap-3 p-5">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Players</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{averages.length}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Games</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{totalGames}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Top role</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{topRole?.[0] || "-"}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Focus</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{selectedMetricMeta.label}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </header>

        <section className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl uppercase tracking-[0.05em] text-foreground">Search players</h2>
              <p className="mt-1 text-sm text-muted">Search is intentionally simple: name only, with quick clear and one-tap navigation.</p>
            </div>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Reset all
            </Button>
          </div>

          <Card variant="featured" className="border-primary/20 bg-surface-elevated/60 shadow-xl shadow-black/15 backdrop-blur">
            <CardContent className="space-y-4 p-5 lg:p-6">
              <div className="relative">
                <div className="flex items-center gap-3 rounded-3xl border border-border/70 bg-surface px-4 py-3 transition-all focus-within:border-primary/40 focus-within:bg-background/90">
                  <svg className="h-5 w-5 shrink-0 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search player name"
                    className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  {searchQuery ? (
                    <button
                      onClick={clearSearch}
                      className="rounded-full p-1.5 text-muted transition-colors hover:bg-border/40 hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : null}
                </div>

                {searchQuery && searchFocused ? (
                  <div className="absolute left-0 right-0 top-full z-40 mt-3 overflow-hidden rounded-2xl border border-border/70 bg-surface-elevated shadow-2xl shadow-black/30">
                    {searchResults.length > 0 ? (
                      <div className="p-2">
                        {searchResults.map((player) => {
                          const role = ROLE_CONFIG[player.role];

                          return (
                            <button
                              key={player.userId}
                              onClick={() => handlePlayerClick(player.userId)}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-surface"
                            >
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${role.bg} ${role.text}`}>
                                {role.icon}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate font-medium text-foreground">{player.nickname}</p>
                                  <Badge variant={getRoleBadgeVariant(player.role)}>{role.label}</Badge>
                                </div>
                                <p className="text-sm text-muted">{player.games} games · {selectedMetricMeta.label}: {formatMetric(player[selectedMetric])}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-5 text-center text-sm text-muted">No players found for “{searchQuery}”.</div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {ROLE_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setRoleFilter(filter.value)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                      roleFilter === filter.value
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border/70 bg-surface text-muted hover:border-border hover:text-foreground"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
                <div className="h-6 w-px bg-border/70" />
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSortBy(option.value)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                      sortBy === option.value
                        ? `${selectedMetricColors.bg} ${selectedMetricColors.text} border-transparent`
                        : "border-border/70 bg-surface text-muted hover:border-border hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {TOP_METRICS.map((metric) => {
            const colors = METRIC_COLORS[metric.key];
            const isActive = selectedMetric === metric.key;
            const leader = sortByMetric(averages, metric.key)[0] || null;
            const top3 = sortByMetric(averages, metric.key).slice(0, 3);

            return (
              <button
                key={metric.key}
                onClick={() => setSelectedMetric(metric.key)}
                className={`group overflow-hidden rounded-3xl border text-left transition-all duration-300 ${
                  isActive
                    ? `${colors.bg} ${colors.border} shadow-lg`
                    : "border-border/70 bg-surface/90 hover:-translate-y-0.5 hover:border-border hover:bg-surface-elevated"
                }`}
              >
                <div className="relative p-5">
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-white/[0.03]" />
                  <div className="relative space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${colors.bg} ${colors.text}`}>
                        {METRIC_ICONS[metric.key]}
                      </div>
                      {isActive ? <Badge variant="primary">Focused</Badge> : <span className="text-xs text-muted">Metric</span>}
                    </div>

                    <div>
                      <p className="font-display text-3xl uppercase tracking-[0.05em] text-foreground">
                        {metric.label.replace("Top ", "")}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {leader ? `${leader.nickname} leads with ${formatMetric(leader[metric.key])}` : "No stat data available"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {top3.map((player, index) => (
                        <div key={`${metric.key}-${player.userId}`} className="flex items-center gap-2">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${index === 0 ? "bg-warning/15 text-warning" : "bg-surface-elevated text-muted"}`}>
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{player.nickname}</span>
                          <span className={`font-mono text-xs ${isActive ? colors.text : "text-muted"}`}>
                            {formatMetric(player[metric.key])}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        <section className="mt-8">
          <Card variant="featured" className="border-border/70 bg-surface-elevated/60 shadow-xl shadow-black/15 backdrop-blur">
            <CardContent className="p-0">
              <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <Badge variant="primary">Leaderboard</Badge>
                  <h2 className="mt-3 font-display text-4xl uppercase tracking-[0.05em] text-foreground">
                    {selectedMetricMeta.label} table
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {roleFilter === "ALL" ? "All roles included" : `${roleFilter} only`} · {sortBy === "metric" ? "sorted by focus metric" : `sorted by ${SORT_OPTIONS.find((item) => item.value === sortBy)?.label.toLowerCase()}`}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Reset filters
                </Button>
              </div>

              {leaderboardData.length === 0 ? (
                <div className="px-5 py-16 text-center text-muted">No stats recorded yet for this selection.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs uppercase tracking-[0.2em] text-muted">
                        <th className="px-5 py-4">Position</th>
                        <th className="px-5 py-4">Player</th>
                        <th className="px-5 py-4">Role</th>
                        <th className="px-5 py-4 text-center">Games</th>
                        <th className="px-5 py-4 text-right">{selectedMetricMeta.label.replace("Top ", "").replace("Lowest ", "")}</th>
                        <th className="px-5 py-4 text-right">Open</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {leaderboardData.map((player, index) => {
                        const role = ROLE_CONFIG[player.role];
                        const progress = getProgress(player[selectedMetric], metricBestValue, selectedMetricMeta.lowerIsBetter);

                        return (
                          <tr key={player.userId} className="group transition-colors hover:bg-surface/80">
                            <td className="px-5 py-4 align-top">
                              <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
                                index === 0
                                  ? "bg-warning/15 text-warning"
                                  : index === 1
                                    ? "bg-surface-elevated text-foreground"
                                    : index === 2
                                      ? "bg-warning/10 text-warning/80"
                                      : "bg-surface-elevated text-muted"
                              }`}>
                                {index + 1}
                              </div>
                            </td>

                            <td className="px-5 py-4 align-top">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${role.bg} ${role.text}`}>
                                  {role.icon}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-foreground">{player.nickname}</p>
                                  <p className="mt-1 text-sm text-muted">Clean readout with no visible ID</p>
                                  <div className="mt-2 hidden max-w-[260px] lg:block">
                                    <div className="h-1.5 rounded-full bg-border/50">
                                      <div
                                        className={`h-1.5 rounded-full ${selectedMetricColors.bg} ${selectedMetricColors.border}`}
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4 align-top">
                              <Badge variant={getRoleBadgeVariant(player.role)}>{role.label}</Badge>
                            </td>

                            <td className="px-5 py-4 align-top text-center font-mono text-sm text-muted">
                              {player.games}
                            </td>

                            <td className="px-5 py-4 align-top text-right">
                              <div>
                                <p className={`font-display text-3xl uppercase tracking-[0.04em] ${selectedMetricColors.text}`}>
                                  {formatMetric(player[selectedMetric])}
                                </p>
                                <p className="mt-1 text-xs text-muted">
                                  {index === 0 ? "Leader" : `-${formatMetric(Math.abs(player[selectedMetric] - metricBestValue))} from leader`}
                                </p>
                              </div>
                            </td>

                            <td className="px-5 py-4 align-top text-right">
                              <Button variant="ghost" size="sm" onClick={() => handlePlayerClick(player.userId)} className="opacity-70 transition-opacity group-hover:opacity-100">
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
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
