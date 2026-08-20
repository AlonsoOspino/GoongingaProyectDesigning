"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "@/features/session/SessionProvider";
import { getCurrentTournament } from "@/lib/api/admin";
import type { Tournament } from "@/lib/api/admin";
import { useServerNow } from "@/hooks/useServerNow";

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimestamp(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (value && typeof value === "object") {
    const serializedDate = (value as { $date?: unknown }).$date;
    if (typeof serializedDate === "string" || typeof serializedDate === "number") {
      const timestamp = new Date(serializedDate).getTime();
      return Number.isFinite(timestamp) ? timestamp : null;
    }
  }

  return null;
}

export function TournamentTimer() {
  const { isHydrated } = useSession();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  // Server-synced "now" that ticks every second.
  // Immune to client clock skew / manual clock changes.
  const serverNow = useServerNow(1000);

  useEffect(() => {
    if (!isHydrated) return;

    loadTournament();
  }, [isHydrated]);

  const timeRemaining = useMemo<TimeRemaining | null>(() => {
    if (!tournament) return null;

    const targetDate = getTimestamp(tournament.startDate);
    if (targetDate === null) return null;

    const distance = targetDate - serverNow;

    if (distance <= 0) return null;

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  }, [tournament, serverNow]);

  useEffect(() => {
    // Stop the loading skeleton once we know either the tournament state or that there's no countdown.
    if (tournament === null) return;
    setLoading(false);
  }, [tournament]);

  async function loadTournament() {
    try {
      const data = await getCurrentTournament();
      setTournament(data);
    } catch {
      setLoading(false);
    }
  }

  if (!isHydrated || loading || !tournament || !timeRemaining) {
    return null;
  }

  return (
    <div className="border-b border-brand-bright/35 bg-surface-1 px-4 py-3 text-center text-text-primary">
      <div className="container mx-auto">
        <p className="text-body-s font-medium mb-2">Tournament Starting In (EST):</p>
        <div className="flex justify-center items-center gap-2 font-mono text-body-l font-bold tabular-nums">
          <div className="flex flex-col items-center">
            <span className="text-display-m">{timeRemaining.days}</span>
            <span className="text-label uppercase">Days</span>
          </div>
          <span>:</span>
          <div className="flex flex-col items-center">
            <span className="text-display-m">{String(timeRemaining.hours).padStart(2, "0")}</span>
            <span className="text-label uppercase">Hours</span>
          </div>
          <span>:</span>
          <div className="flex flex-col items-center">
            <span className="text-display-m">{String(timeRemaining.minutes).padStart(2, "0")}</span>
            <span className="text-label uppercase">Mins</span>
          </div>
          <span>:</span>
          <div className="flex flex-col items-center">
            <span className="text-display-m">{String(timeRemaining.seconds).padStart(2, "0")}</span>
            <span className="text-label uppercase">Secs</span>
          </div>
        </div>
      </div>
    </div>
  );
}
