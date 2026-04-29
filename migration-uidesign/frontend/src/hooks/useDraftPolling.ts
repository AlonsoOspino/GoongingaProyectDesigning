"use client";

import { useState, useEffect, useCallback } from "react";
import { getDraftState } from "@/lib/api/draft";
import type { DraftState } from "@/lib/api/types";
import { getServerNow } from "@/lib/serverTime";

interface UseDraftPollingOptions {
  draftId: number | null;
  pollInterval?: number;
  enabled?: boolean;
}

interface UseDraftPollingResult {
  draftState: DraftState | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  timeRemaining: number;
}

const TURN_DURATION = 75;
const TURN_PHASES = new Set(["MAPPICKING", "BAN"]);

const isTurnPhase = (phase: string) => TURN_PHASES.has(phase);

const getTimeRemaining = (state: DraftState) => {
  // Prefer server-provided remainingSeconds when available so clients
  // don't rely on their local clock.
  if (state.remainingSeconds !== undefined && Number.isFinite(state.remainingSeconds)) {
    return Math.min(TURN_DURATION, Math.max(0, state.remainingSeconds));
  }
  if (!isTurnPhase(state.phase)) return TURN_DURATION;
  if (!state.phaseStartedAt) return TURN_DURATION;

  const phaseStart = new Date(state.phaseStartedAt).getTime();
  if (!Number.isFinite(phaseStart)) return TURN_DURATION;

  // Freeze countdown while the manager pause is active.
  const referenceNow =
    state.match?.mapTimerPaused && state.match?.mapTimerPausedAt
      ? new Date(state.match.mapTimerPausedAt).getTime()
      : getServerNow();

  if (!Number.isFinite(referenceNow)) return TURN_DURATION;

    // Prevent negative elapsed when phaseStartedAt is slightly in the future
    // (eg. due to clock skew or misapplied shifts). Treat future start as 0
    // elapsed so UI never shows > TURN_DURATION seconds.
    const safePhaseStart = Math.min(phaseStart, referenceNow);
    const elapsed = Math.floor((referenceNow - safePhaseStart) / 1000);
    const remaining = Math.max(0, TURN_DURATION - elapsed);
    return Math.min(TURN_DURATION, remaining);
};

export function useDraftPolling({
  draftId,
  pollInterval = 3000,
  enabled = true,
}: UseDraftPollingOptions): UseDraftPollingResult {
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(TURN_DURATION);

  const fetchDraftState = useCallback(async () => {
    if (!draftId) return;

    try {
      const state = await getDraftState(draftId);

      // Avoid tiny backend timestamp drift resetting the client timer.
      // If phase didn't change and the new phaseStartedAt differs from
      // the previous one by <= 1s, keep the previous timestamp.
      setDraftState((prev) => {
        try {
          if (
            prev &&
            prev.phase === state.phase &&
            isTurnPhase(state.phase) &&
            prev.phaseStartedAt &&
            state.phaseStartedAt
          ) {
            const prevTs = new Date(prev.phaseStartedAt).getTime();
            const newTs = new Date(state.phaseStartedAt).getTime();
            if (Number.isFinite(prevTs) && Number.isFinite(newTs) && Math.abs(newTs - prevTs) <= 1000) {
              // reuse prev timestamp to avoid resetting countdown on tiny drift
              state.phaseStartedAt = prev.phaseStartedAt;
            }
          }
        } catch (e) {
          // ignore and fall back to server value
        }
        return state;
      });

      setError(null);
      setTimeRemaining(getTimeRemaining(state));
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch draft state"));
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  // Initial fetch and polling
  useEffect(() => {
    if (!draftId || !enabled) {
      setLoading(false);
      return;
    }

    fetchDraftState();

    const interval = setInterval(fetchDraftState, pollInterval);

    return () => clearInterval(interval);
  }, [draftId, pollInterval, enabled, fetchDraftState]);

  // Local timer countdown
  useEffect(() => {
    if (!draftState || !isTurnPhase(draftState.phase) || draftState.match?.mapTimerPaused) {
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [draftState]);

  return {
    draftState,
    loading,
    error,
    refetch: fetchDraftState,
    timeRemaining,
  };
}
