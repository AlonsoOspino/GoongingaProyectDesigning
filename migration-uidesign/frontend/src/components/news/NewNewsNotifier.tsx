"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { getNews } from "@/lib/api/news";
import type { NewsItem } from "@/lib/api/types";
import {
  LAST_SEEN_NEWS_KEY,
  NEWS_SEEN_EVENT,
} from "@/components/news/MarkSeenNews";

interface UnseenState {
  latestId: number;
  count: number;
  headline: string;
}

/**
 * Floating toast that tells the user when news articles have been
 * published since their last visit. 100% client-side: it stores the
 * highest article id the user has acknowledged in localStorage and
 * compares it against whatever the public news endpoint returns.
 *
 *  - Mounted globally in the root layout so it's visible on every page.
 *  - Hides itself on `/news` and `/news/[id]` (no point notifying the
 *    user about content they're already looking at).
 *  - Listens to `gng:newsSeen` so the badge clears the moment the
 *    user opens the index page.
 *  - Polls on mount and whenever the tab regains focus, so a long-open
 *    session still picks up new posts.
 */
export function NewNewsNotifier() {
  const pathname = usePathname();
  const onNewsRoute = pathname?.startsWith("/news") ?? false;

  const [unseen, setUnseen] = useState<UnseenState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const news = await getNews();
      if (!news?.length) return;
      const sorted = [...news].sort((a, b) => b.id - a.id);
      const latest = sorted[0];
      const lastSeen = Number(
        window.localStorage.getItem(LAST_SEEN_NEWS_KEY) || "0",
      );
      if (latest.id > lastSeen) {
        const newOnes: NewsItem[] = sorted.filter((n) => n.id > lastSeen);
        setUnseen({
          latestId: latest.id,
          count: newOnes.length,
          headline: latest.title,
        });
      } else {
        setUnseen(null);
      }
    } catch {
      // Network/API issues should never crash the toast — just stay quiet.
    }
  }, []);

  // Initial check + every time the user comes back to the tab.
  useEffect(() => {
    check();
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [check]);

  // Hide the toast immediately once the news index page marks the
  // articles as seen.
  useEffect(() => {
    const onSeen = () => {
      setUnseen(null);
      setDismissed(false);
    };
    window.addEventListener(NEWS_SEEN_EVENT, onSeen as EventListener);
    return () =>
      window.removeEventListener(NEWS_SEEN_EVENT, onSeen as EventListener);
  }, []);

  // Re-check after route changes so opening an article on /news/[id]
  // also counts as having seen the freshest content.
  useEffect(() => {
    if (!onNewsRoute) return;
    if (unseen) {
      window.localStorage.setItem(
        LAST_SEEN_NEWS_KEY,
        String(unseen.latestId),
      );
      setUnseen(null);
    }
  }, [onNewsRoute, unseen]);

  const handleDismiss = () => {
    if (unseen) {
      window.localStorage.setItem(
        LAST_SEEN_NEWS_KEY,
        String(unseen.latestId),
      );
    }
    setDismissed(true);
    setUnseen(null);
  };

  if (!unseen || dismissed || onNewsRoute) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 max-w-sm"
      style={{ animation: "gngNewsToastIn 0.35s ease-out both" }}
    >
      <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-elevated/95 backdrop-blur-md p-4 shadow-2xl shadow-primary/10">
        {/* Pulsing dot */}
        <div className="relative mt-1 flex-shrink-0">
          <span className="absolute inset-0 rounded-full bg-primary opacity-75 animate-ping" />
          <span className="relative block w-2.5 h-2.5 rounded-full bg-primary" />
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
            {unseen.count === 1
              ? "New article"
              : `${unseen.count} new articles`}
          </p>
          <p className="text-sm text-foreground line-clamp-2 mb-3">
            {unseen.headline}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/news"
              className="inline-flex items-center gap-1 text-xs font-medium text-foreground bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-md transition-colors"
              onClick={() => setUnseen(null)}
            >
              Read now
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs text-muted hover:text-foreground px-2 py-1.5 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>

        {/* Close (X) */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          className="flex-shrink-0 text-muted hover:text-foreground transition-colors -mt-1 -mr-1 p-1"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
