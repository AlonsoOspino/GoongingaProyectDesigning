import { useState, useEffect } from "react";
import { getServerNow } from "@/lib/serverTime";

const MAP_DURATION_MS = 5 * 60 * 1000; // 5 minutes per map

interface MapTimerState {
  timeLeft: number;
  isActive: boolean;
  isPaused: boolean;
}

/**
 * Hook that manages a countdown timer for an active map in a match.
 * Tracks time remaining based on when the map started and whether it's paused.
 *
 * @param mapStartedAt ISO timestamp when the map phase started
 * @param isPaused Whether the timer is paused (manager initiated)
 * @returns Object with timeLeft (ms), isActive, isPaused state
 */
export function useMapTimer(
  mapStartedAt: string | null,
  isPaused: boolean = false,
): MapTimerState {
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!mapStartedAt) {
      setTimeLeft(0);
      setIsActive(false);
      return;
    }

    const updateTimer = () => {
      const now = getServerNow();
      const startMs = new Date(mapStartedAt).getTime();
      const elapsed = Math.max(0, now - startMs);
      const remaining = Math.max(0, MAP_DURATION_MS - elapsed);

      setTimeLeft(remaining);
      setIsActive(remaining > 0);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100); // Update every 100ms for smooth countdown

    return () => clearInterval(interval);
  }, [mapStartedAt, isPaused]);

  return {
    timeLeft,
    isActive,
    isPaused,
  };
}

/**
 * Format milliseconds into MM:SS display format
 */
export function formatMapTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
