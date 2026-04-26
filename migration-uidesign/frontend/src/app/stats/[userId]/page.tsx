"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getPublicPlayerStats, getPublicPlayerStatsByUserId } from "@/lib/api/playerStat";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { PlayerStat } from "@/lib/api/types";
import { buildPlayerAverages, sortByMetric, TOP_METRICS, type PlayerAverage, type TopMetricKey } from "@/lib/stats/playerAverages";

const ROLE_CONFIG: Record<PlayerAverage["role"], { label: string; text: string; bg: string; gradient: string; icon: ReactNode }> = {
  TANK: {
    label: "Tank",
    text: "text-primary",
    bg: "bg-primary/15",
    gradient: "from-primary/30 via-primary/10 to-transparent",
    icon: (
      <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2A11.954 11.954 0 0110 1.944z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  DPS: {
    label: "Damage",
    text: "text-danger",
    bg: "bg-danger/15",
    gradient: "from-danger/30 via-danger/10 to-transparent",
    icon: (
      <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm2 10.414l-4.293-4.293a1 1 0 011.414-1.414L10 7.586V4h2v3.586l.879-.879a1 1 0 111.414 1.414L10 12.414z" />
      </svg>
    ),
  },
  SUPPORT: {
    label: "Support",
    text: "text-success",
    bg: "bg-success/15",
    gradient: "from-success/30 via-success/10 to-transparent",
    icon: (
      <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
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
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
};

function formatMetric(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatLargeNumber(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function getRoleBadgeVariant(role: PlayerAverage["role"]) {
  if (role === "TANK") return "primary" as const;
  if (role === "DPS") return "danger" as const;
  return "success" as const;
}

export default function PlayerStatsDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = Number(params.userId);

  const [allStats, setAllStats] = useState<PlayerStat[]>([]);
  const [userStats, setUserStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [globalRows, userRows] = await Promise.all([
          getPublicPlayerStats(),
          getPublicPlayerStatsByUserId(userId),
        ]);
        setAllStats(globalRows);
        setUserStats(userRows);
      } catch (error) {
        console.error("Failed to load player detail stats:", error);
      } finally {
        setLoading(false);
      }
    }

    if (Number.isInteger(userId) && userId > 0) {
      load();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const userAverage = useMemo(() => {
    return buildPlayerAverages(userStats)[0] || null;
  }, [userStats]);

  const globalAverages = useMemo(() => buildPlayerAverages(allStats), [allStats]);

  const rankings = useMemo((): Partial<Record<TopMetricKey, { rank: number; total: number; percentile: number }>> => {
    if (!userAverage || !globalAverages.length) return {};

    const result: Partial<Record<TopMetricKey, { rank: number; total: number; percentile: number }>> = {};
    
    for (const metric of TOP_METRICS) {
      const sorted = sortByMetric(globalAverages, metric.key);
      const rank = sorted.findIndex(p => p.userId === userAverage.userId) + 1;
      const total = sorted.length;
      const percentile = Math.round(((total - rank + 1) / total) * 100);
      result[metric.key] = { rank, total, percentile };
    }

    return result;
  }, [userAverage, globalAverages]);

  const comparison = useMemo(() => {
    if (!userAverage || !globalAverages.length) return [];

    return TOP_METRICS.map((metric) => {
      const config = METRIC_CONFIG[metric.key];
      const sorted = sortByMetric(globalAverages, metric.key);
      const top1 = sorted[0];
      const mine = userAverage[metric.key];
      const best = top1?.[metric.key] || 0;
      const rankData = rankings[metric.key];

      let status: "leader" | "top10" | "top25" | "average" | "below" = "average";
      let diff = 0;

      if (rankData) {
        if (rankData.rank === 1) status = "leader";
        else if (rankData.percentile >= 90) status = "top10";
        else if (rankData.percentile >= 75) status = "top25";
        else if (rankData.percentile < 50) status = "below";
      }

      if (best > 0 && mine !== best) {
        if (metric.lowerIsBetter) {
          diff = ((mine - best) / best) * 100;
        } else {
          diff = ((best - mine) / best) * 100;
        }
      }

      return {
        metric: metric.key,
        label: config.label,
        shortLabel: config.shortLabel,
        color: config.color,
        bgColor: config.bgColor,
        icon: config.icon,
        mine,
        top1Value: best,
        top1Name: top1?.nickname || "-",
        rank: rankData?.rank || 0,
        total: rankData?.total || 0,
        percentile: rankData?.percentile || 0,
        status,
        diff,
        lowerIsBetter: metric.lowerIsBetter,
      };
    });
  }, [userAverage, globalAverages, rankings]);

  const bestMetric = useMemo(() => {
    if (!comparison.length) return null;
    return comparison.reduce((best, current) => {
      if (current.percentile > best.percentile) return current;
      return best;
    });
  }, [comparison]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <Skeleton className="h-6 w-32 mb-6" variant="text" />
          <Skeleton className="h-48 rounded-2xl mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!userAverage) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <Link href="/stats" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-6">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Stats
          </Link>
          <div className="rounded-2xl border border-border/50 bg-surface/60 p-16 text-center backdrop-blur-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-elevated">
              <svg className="h-8 w-8 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Player Not Found</h2>
            <p className="text-muted mb-6">No stats were found for this player.</p>
            <Link
              href="/stats"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
            >
              View All Players
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const role = ROLE_CONFIG[userAverage.role];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0">
        <div className={`absolute -left-32 top-0 h-[500px] w-[500px] rounded-full bg-gradient-to-br ${role.gradient} blur-[150px] opacity-60`} />
        <div className="absolute -right-32 top-1/3 h-[400px] w-[400px] rounded-full bg-accent/5 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-10">
        {/* Back Link */}
        <Link href="/stats" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-6 group">
          <svg className="h-4 w-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Stats
        </Link>

        {/* Hero Section */}
        <header className="mb-8">
          <div className="overflow-hidden rounded-3xl border border-border/50 bg-surface/70 backdrop-blur-sm">
            {/* Gradient Header Bar */}
            <div className={`h-2 w-full bg-gradient-to-r ${role.gradient.replace('to-transparent', 'to-primary/20')}`} />
            
            <div className="p-6 lg:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                {/* Player Identity */}
                <div className="flex items-center gap-5">
                  <div className={`flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${role.gradient} ${role.text} shadow-lg shadow-black/20`}>
                    {role.icon}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h1 className="font-display text-3xl uppercase tracking-wide text-foreground lg:text-4xl">
                        {userAverage.nickname}
                      </h1>
                      <Badge variant={getRoleBadgeVariant(userAverage.role)} className="text-sm px-3 py-1">
                        {role.label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
                      <span className="flex items-center gap-1.5">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                        </svg>
                        {userAverage.games} games played
                      </span>
                      {bestMetric && (
                        <span className={`flex items-center gap-1.5 ${bestMetric.color}`}>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                          </svg>
                          Top {100 - bestMetric.percentile + 1}% in {bestMetric.shortLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="flex gap-6 lg:gap-8">
                  <div className="text-center">
                    <p className="font-mono text-3xl font-bold text-foreground">{formatMetric(userAverage.killsPer10)}</p>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted">Elim/10</p>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-3xl font-bold text-foreground">{formatLargeNumber(userAverage.damagePer10)}</p>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted">Dmg/10</p>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-3xl font-bold text-foreground">{formatMetric(userAverage.deathsPer10)}</p>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted">Death/10</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="mb-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Performance per 10 Minutes</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {comparison.map((stat) => (
              <div
                key={stat.metric}
                className="group relative overflow-hidden rounded-xl border border-border/40 bg-surface/60 p-4 backdrop-blur-sm transition-all hover:border-border hover:bg-surface-elevated/80"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bgColor}/15 ${stat.color}`}>
                    {stat.icon}
                  </div>
                  {stat.status === "leader" && (
                    <span className="text-xs font-bold text-warning">1ST</span>
                  )}
                </div>
                <p className={`font-mono text-2xl font-bold ${stat.color}`}>
                  {formatMetric(stat.mine)}
                </p>
                <p className="text-xs text-muted mt-1">{stat.label}</p>
                
                {/* Rank indicator */}
                <div className="mt-3 pt-3 border-t border-border/30">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Rank</span>
                    <span className="font-medium text-foreground">#{stat.rank} / {stat.total}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison Section */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Performance vs Top Player</h2>
          </div>
          
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface/60 backdrop-blur-sm">
            <div className="divide-y divide-border/30">
              {comparison.map((stat) => {
                const progress = stat.status === "leader" ? 100 : Math.max(5, 100 - stat.diff);
                
                return (
                  <div key={stat.metric} className="p-4 lg:p-5 hover:bg-surface-elevated/30 transition-colors">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      {/* Metric Info */}
                      <div className="flex items-center gap-3 lg:w-48">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bgColor}/15 ${stat.color}`}>
                          {stat.icon}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{stat.label}</p>
                          <p className="text-xs text-muted">
                            {stat.lowerIsBetter ? "Lower is better" : "Higher is better"}
                          </p>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <div className="flex-1">
                            <div className="h-2 rounded-full bg-border/30 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${stat.bgColor} transition-all duration-500`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                          <span className={`font-mono text-lg font-bold ${stat.color} w-20 text-right`}>
                            {formatMetric(stat.mine)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted">
                          <span>
                            {stat.status === "leader" ? (
                              <span className="text-warning font-medium">You are the leader</span>
                            ) : (
                              <>
                                Top 1: {stat.top1Name} ({formatMetric(stat.top1Value)})
                              </>
                            )}
                          </span>
                          <span>
                            {stat.status === "leader" ? (
                              <span className="text-warning">1ST</span>
                            ) : (
                              <span className={stat.percentile >= 75 ? "text-success" : stat.percentile >= 50 ? "text-foreground" : "text-danger"}>
                                Top {100 - stat.percentile + 1}%
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Performance Summary */}
        <section className="mt-8">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Best Performance */}
            {bestMetric && (
              <div className="rounded-2xl border border-success/30 bg-success/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-semibold text-success">Best Performance</span>
                </div>
                <p className="text-foreground font-medium">{bestMetric.label}</p>
                <p className="text-sm text-muted mt-1">
                  Ranked #{bestMetric.rank} out of {bestMetric.total} players
                </p>
              </div>
            )}

            {/* Games Played */}
            <div className="rounded-2xl border border-border/50 bg-surface/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                <span className="text-sm font-semibold text-primary">Experience</span>
              </div>
              <p className="font-mono text-2xl font-bold text-foreground">{userAverage.games}</p>
              <p className="text-sm text-muted mt-1">Total games played</p>
            </div>

            {/* Primary Role */}
            <div className={`rounded-2xl border ${role.text.replace('text-', 'border-')}/30 ${role.bg} p-5`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={role.text}>{ROLE_CONFIG[userAverage.role].icon}</div>
                <span className={`text-sm font-semibold ${role.text}`}>Primary Role</span>
              </div>
              <p className="font-medium text-foreground">{role.label}</p>
              <p className="text-sm text-muted mt-1">Most played position</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
