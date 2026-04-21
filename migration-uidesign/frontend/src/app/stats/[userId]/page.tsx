"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getPublicPlayerStats, getPublicPlayerStatsByUserId } from "@/lib/api/playerStat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { PlayerStat } from "@/lib/api/types";
import { buildPlayerAverages, sortByMetric, TOP_METRICS, type TopMetricKey } from "@/lib/stats/playerAverages";

function metricLabel(key: TopMetricKey) {
  return TOP_METRICS.find((m) => m.key === key)?.label || key;
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

  const comparison = useMemo(() => {
    if (!userAverage || !globalAverages.length) return [];

    return TOP_METRICS.map((metric) => {
      const top1 = sortByMetric(globalAverages, metric.key)[0];
      const mine = userAverage[metric.key];
      const best = top1?.[metric.key] || 0;

      let message = "Sin referencia";
      if (best > 0) {
        if (metric.lowerIsBetter) {
          const percent = Math.max(0, ((mine - best) / best) * 100);
          message = percent <= 1
            ? "Estas practicamente en el Top 1"
            : `Estas a ${percent.toFixed(1)}% por encima del Top 1 (menor es mejor)`;
        } else {
          const ratio = mine / best;
          const behind = Math.max(0, (1 - ratio) * 100);
          message = behind <= 1
            ? "Estas practicamente en el Top 1"
            : `Estas a ${behind.toFixed(1)}% del Top 1`;
        }
      }

      return {
        metric: metric.key,
        label: metricLabel(metric.key),
        mine,
        top1Value: best,
        top1Name: top1?.nickname || "-",
        message,
      };
    });
  }, [userAverage, globalAverages]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-72 mb-3" />
        <Skeleton className="h-5 w-96 max-w-full mb-8" variant="text" />
        <Skeleton className="h-40 mb-6" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!userAverage) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/stats" className="text-sm text-muted hover:text-foreground">Volver a Stats</Link>
        <Card variant="bordered" className="mt-4">
          <CardContent className="py-10 text-center text-muted">No se encontraron stats para este usuario.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 relative">
      <div className="fixed top-20 right-1/4 w-80 h-80 bg-success/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-12 left-1/4 w-80 h-80 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <Link href="/stats" className="inline-flex text-sm text-muted hover:text-foreground mb-4">
        ← Volver a Stats
      </Link>

      <Card variant="bordered" className="mb-6 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-success to-accent" />
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h1 className="text-3xl font-bold text-foreground">{userAverage.nickname}</h1>
            <Badge variant="primary">ID {userAverage.userId}</Badge>
            <Badge variant="secondary">{userAverage.role}</Badge>
          </div>
          <p className="text-muted">Resumen por promedio incremental de {userAverage.games} partidas (normalizado a 10 minutos).</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Kills/10", value: userAverage.killsPer10 },
          { label: "Dano/10", value: userAverage.damagePer10 },
          { label: "Mitigado/10", value: userAverage.mitigationPer10 },
          { label: "Healing/10", value: userAverage.healingPer10 },
          { label: "Assists/10", value: userAverage.assistsPer10 },
          { label: "Deaths/10", value: userAverage.deathsPer10 },
        ].map((item) => (
          <Card key={item.label} variant="bordered">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold font-mono text-foreground">{item.value.toLocaleString()}</p>
              <p className="text-xs text-muted">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Menu de comparacion vs Top 1</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {comparison.map((row) => (
              <div key={row.metric} className="rounded-lg border border-border bg-surface/40 p-4">
                <p className="text-sm font-semibold text-foreground mb-1">{row.label}</p>
                <p className="text-sm text-muted mb-2">Tu valor: {row.mine.toLocaleString()} | Top 1: {row.top1Value.toLocaleString()} ({row.top1Name})</p>
                <p className="text-sm text-primary font-medium">{row.message}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
