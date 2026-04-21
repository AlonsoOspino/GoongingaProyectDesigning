import type { PlayerStat } from "@/lib/api/types";

export type TopMetricKey =
  | "damagePer10"
  | "mitigationPer10"
  | "healingPer10"
  | "assistsPer10"
  | "deathsPer10"
  | "killsPer10";

export interface PlayerAverage {
  userId: number;
  nickname: string;
  role: "TANK" | "DPS" | "SUPPORT";
  games: number;
  damagePer10: number;
  mitigationPer10: number;
  healingPer10: number;
  assistsPer10: number;
  deathsPer10: number;
  killsPer10: number;
}

export const TOP_METRICS: Array<{ key: TopMetricKey; label: string; lowerIsBetter?: boolean }> = [
  { key: "killsPer10", label: "Top Kills" },
  { key: "damagePer10", label: "Top Damage" },
  { key: "mitigationPer10", label: "Top Mitigation" },
  { key: "healingPer10", label: "Top Healing" },
  { key: "assistsPer10", label: "Top Assists" },
  { key: "deathsPer10", label: "Lowest Deaths", lowerIsBetter: true },
];

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function resolveNickname(stat: PlayerStat) {
  return stat.user?.nickname || `User ${stat.userId}`;
}

export function buildPlayerAverages(stats: PlayerStat[]): PlayerAverage[] {
  const byUser = new Map<number, {
    userId: number;
    nickname: string;
    games: number;
    roleCounts: { TANK: number; DPS: number; SUPPORT: number };
    damagePer10: number;
    mitigationPer10: number;
    healingPer10: number;
    assistsPer10: number;
    deathsPer10: number;
    killsPer10: number;
  }>();

  for (const stat of stats) {
    const existing = byUser.get(stat.userId) || {
      userId: stat.userId,
      nickname: resolveNickname(stat),
      games: 0,
      roleCounts: { TANK: 0, DPS: 0, SUPPORT: 0 },
      damagePer10: 0,
      mitigationPer10: 0,
      healingPer10: 0,
      assistsPer10: 0,
      deathsPer10: 0,
      killsPer10: 0,
    };

    const n = existing.games;
    const avg = (prev: number, next: number) => (prev * n + next) / (n + 1);

    existing.games += 1;
    existing.nickname = stat.user?.nickname || existing.nickname;
    existing.roleCounts[stat.role] += 1;
    existing.damagePer10 = avg(existing.damagePer10, Number(stat.damagePer10 || 0));
    existing.mitigationPer10 = avg(existing.mitigationPer10, Number(stat.mitigationPer10 || 0));
    existing.healingPer10 = avg(existing.healingPer10, Number(stat.healingPer10 || 0));
    existing.assistsPer10 = avg(existing.assistsPer10, Number(stat.assistsPer10 || 0));
    existing.deathsPer10 = avg(existing.deathsPer10, Number(stat.deathsPer10 || 0));
    existing.killsPer10 = avg(existing.killsPer10, Number(stat.killsPer10 || 0));

    byUser.set(stat.userId, existing);
  }

  const result: PlayerAverage[] = [];
  for (const user of byUser.values()) {
    const role = (Object.entries(user.roleCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "DPS") as PlayerAverage["role"];

    result.push({
      userId: user.userId,
      nickname: user.nickname,
      role,
      games: user.games,
      damagePer10: round2(user.damagePer10),
      mitigationPer10: round2(user.mitigationPer10),
      healingPer10: round2(user.healingPer10),
      assistsPer10: round2(user.assistsPer10),
      deathsPer10: round2(user.deathsPer10),
      killsPer10: round2(user.killsPer10),
    });
  }

  return result;
}

export function sortByMetric(rows: PlayerAverage[], metric: TopMetricKey) {
  const lowerIsBetter = metric === "deathsPer10";
  return [...rows].sort((a, b) =>
    lowerIsBetter ? a[metric] - b[metric] : b[metric] - a[metric]
  );
}
