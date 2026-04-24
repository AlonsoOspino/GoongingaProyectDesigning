"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

const PHASE_DURATION = 30; // 30 seconds per phase

export function useDraftPolling({
  draftId,
  pollInterval = 3000,
  enabled = true,
}: UseDraftPollingOptions): UseDraftPollingResult {
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(PHASE_DURATION);
  const lastPhaseRef = useRef<string | null>(null);
  const lastPhaseStartRef = useRef<string | null>(null);

  const fetchDraftState = useCallback(async () => {
    if (!draftId) return;

    try {
      const state = await getDraftState(draftId);
      setDraftState(state);
      setError(null);

      // Reset timer if phase changed
      if (
        state.phase !== lastPhaseRef.current ||
        state.phaseStartedAt !== lastPhaseStartRef.current
      ) {
        lastPhaseRef.current = state.phase;
        lastPhaseStartRef.current = state.phaseStartedAt;

        // Calculate time remaining from phaseStartedAt using server time.
        // phaseStartedAt comes from the backend; mixing it with the client clock
        // (Date.now) introduces skew if the user's machine clock is off. Using
        // getServerNow() aligns both sides of the subtraction.
        const phaseStart = new Date(state.phaseStartedAt).getTime();
        const now = getServerNow();
        const elapsed = Math.floor((now - phaseStart) / 1000);
        const remaining = Math.max(0, PHASE_DURATION - elapsed);
        setTimeRemaining(remaining);
      }
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
    if (!draftState || draftState.phase === "FINISHED" || draftState.phase === "IDLE") {
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
