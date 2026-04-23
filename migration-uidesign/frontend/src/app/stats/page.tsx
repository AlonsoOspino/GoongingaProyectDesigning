"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getPublicPlayerStats } from "@/lib/api/playerStat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { PlayerStat } from "@/lib/api/types";
import {
  buildPlayerAverages,
  sortByMetric,
  TOP_METRICS,
  type TopMetricKey,
} from "@/lib/stats/playerAverages";

const ROLE_COLOR: Record<string, "primary" | "danger" | "success" | "default"> = {
  TANK: "primary",
  DPS: "danger",
  SUPPORT: "success",
};

export default function StatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<TopMetricKey>("killsPer10");
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

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

  const metricTop10 = useMemo(() => {
    return sortByMetric(averages, selectedMetric).slice(0, 10);
  }, [averages, selectedMetric]);

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return averages;
    return averages.filter((row) => row.nickname.toLowerCase().includes(q) || String(row.userId) === q);
  }, [averages, search]);

  const selectedPlayer = useMemo(() => {
    if (!selectedUserId) return null;
    return averages.find((p) => p.userId === selectedUserId) || null;
  }, [averages, selectedUserId]);

  const topByMetricSummary = useMemo(() => {
    return TOP_METRICS.map((metric) => {
      const leader = sortByMetric(averages, metric.key)[0] || null;
      return { ...metric, leader };
    });
  }, [averages]);

  const metricCardTone = (key: TopMetricKey) => {
    if (key === "killsPer10") return "from-danger/20 via-danger/5 to-transparent border-danger/30";
    if (key === "damagePer10") return "from-primary/20 via-primary/5 to-transparent border-primary/30";
    if (key === "mitigationPer10") return "from-accent/20 via-accent/5 to-transparent border-accent/30";
    if (key === "healingPer10") return "from-success/20 via-success/5 to-transparent border-success/30";
    if (key === "assistsPer10") return "from-warning/20 via-warning/5 to-transparent border-warning/30";
    return "from-muted/20 via-muted/5 to-transparent border-border";
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-72 mb-3" />
        <Skeleton className="h-5 w-[32rem] max-w-full mb-8" variant="text" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-gradient-to-b from-background via-surface/30 to-background">
      <div className="container mx-auto px-4 py-8 relative">
      <div className="fixed top-20 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-[110px] pointer-events-none" />
      <div className="fixed bottom-24 right-1/4 w-72 h-72 bg-danger/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed inset-0 bg-grid-pattern-subtle pointer-events-none" />

      <div className="mb-8 relative">
        <div className="rounded-2xl border border-border bg-gradient-to-r from-surface-elevated/90 to-surface/60 backdrop-blur p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1 h-8 bg-gradient-to-b from-primary to-danger rounded-full" />
            <h1 className="text-3xl font-bold text-foreground">Top Players Dashboard</h1>
          </div>
          <p className="text-muted pl-4">
            Global top 10 by metric, quick filters, and individual player profiles.
          </p>
        </div>
      </div>

      <Card variant="featured" className="mb-6 border-primary/30 bg-surface-elevated/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Find player by nickname or user ID</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            list="players-list"
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            placeholder="Example: DECEMBER or 14"
            value={search}
            onChange={(e) => {
              const value = e.target.value;
              setSearch(value);
              const exact = averages.find(
                (p) => p.nickname.toLowerCase() === value.trim().toLowerCase() || String(p.userId) === value.trim()
              );
              setSelectedUserId(exact?.userId ?? null);
            }}
          />
          <datalist id="players-list">
            {filteredPlayers.slice(0, 80).map((p) => (
              <option key={p.userId} value={p.nickname}>{`ID ${p.userId}`}</option>
            ))}
          </datalist>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                if (selectedPlayer) router.push(`/stats/${selectedPlayer.userId}`);
              }}
              disabled={!selectedPlayer}
            >
              View player profile
            </Button>
            {selectedPlayer && (
              <span className="text-sm text-muted">
                Selected: {selectedPlayer.nickname} (ID {selectedPlayer.userId})
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mb-8">
        {topByMetricSummary.map((item) => (
          <Card
            key={item.key}
            variant="featured"
            className={`overflow-hidden border bg-gradient-to-br ${metricCardTone(item.key)}`}
          >
            <CardContent className="pt-4">
              <p className="text-xs uppercase tracking-wide text-muted mb-2">{item.label}</p>
              {item.leader ? (
                <>
                  <p className="font-semibold text-foreground">{item.leader.nickname}</p>
                  <p className="text-sm text-muted mt-1">ID {item.leader.userId} · {item.leader.games} games</p>
                  <p className="text-2xl font-bold mt-2 text-primary font-mono">
                    {item.leader[item.key].toLocaleString()}
                  </p>
                </>
              ) : (
                <p className="text-muted">No data</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card variant="featured" className="mb-6 border-border/60 bg-surface-elevated/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Top 10 by metric</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {TOP_METRICS.map((metric) => (
              <Button
                key={metric.key}
                size="sm"
                variant={selectedMetric === metric.key ? "default" : "ghost"}
                onClick={() => setSelectedMetric(metric.key)}
              >
                View metric: {metric.label.replace("Top ", "")}
              </Button>
            ))}
          </div>

          {metricTop10.length === 0 ? (
            <p className="text-muted py-6">No stats recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-surface to-surface-elevated border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Player</th>
                    <th className="px-3 py-2 text-left">Role</th>
                    <th className="px-3 py-2 text-left">Games</th>
                    <th className="px-3 py-2 text-right">Value</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {metricTop10.map((row, index) => (
                    <tr key={row.userId} className="border-t border-border hover:bg-surface-elevated/50 transition-colors">
                      <td className="px-3 py-2 font-mono text-muted">#{index + 1}</td>
                      <td className="px-3 py-2 font-medium">{row.nickname}</td>
                      <td className="px-3 py-2">
                        <Badge variant={ROLE_COLOR[row.role] || "default"}>{row.role}</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted">{row.games}</td>
                      <td className="px-3 py-2 text-right font-mono">{row[selectedMetric].toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => router.push(`/stats/${row.userId}`)}>
                          View player
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
