"use client";

import { useEffect } from "react";

/**
 * Local-storage key shared with `NewNewsNotifier`. The value is the
 * highest news id the current browser has acknowledged seeing.
 */
export const LAST_SEEN_NEWS_KEY = "gng:lastSeenNewsId";

/**
 * Custom event the notifier listens to so it can immediately hide the
 * "new posts" toast as soon as the user reaches `/news` — without
 * waiting for the next mount/poll cycle.
 */
export const NEWS_SEEN_EVENT = "gng:newsSeen";

interface MarkSeenNewsProps {
  /** Highest article id currently shown on the page. */
  latestId: number;
}

/**
 * Tiny client helper that runs on the news index. It bumps the
 * "last seen" cursor in localStorage to the highest article id the
 * server returned, then dispatches a global event so the floating
 * notifier toast can hide itself in real time.
 *
 * Renders nothing.
 */
export function MarkSeenNews({ latestId }: MarkSeenNewsProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!latestId) return;

    const previous = Number(
      window.localStorage.getItem(LAST_SEEN_NEWS_KEY) || "0",
    );
    if (latestId > previous) {
      window.localStorage.setItem(LAST_SEEN_NEWS_KEY, String(latestId));
    }

    window.dispatchEvent(
      new CustomEvent(NEWS_SEEN_EVENT, { detail: { latestId } }),
    );
  }, [latestId]);

  return null;
}
