"use client";

import { useEffect, useState } from "react";
import { getServerNow } from "@/lib/serverTime";

/**
 * Reactive server "now" timestamp (in UTC ms since epoch).
 *
 * Ticks every `intervalMs` (default 1000ms) and always reflects the latest
 * client↔server clock offset. Use this for countdowns and "in X time" copy
 * instead of `Date.now()` so that a user whose machine clock is wrong still
 * sees accurate remaining time.
 *
 * To get EST-formatted display, pass the returned ms to Intl.DateTimeFormat
 * with `timeZone: "America/New_York"` (or use formatDateTimeEST from dateUtils).
 */
export function useServerNow(intervalMs = 1000): number {
  const [now, setNow] = useState<number>(() => getServerNow());

  useEffect(() => {
    // Sync immediately on mount (in case offset was updated between render and effect)
    setNow(getServerNow());

    const id = setInterval(() => {
      setNow(getServerNow());
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
