"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMvpVoting, type MvpCampaign } from "@/lib/api";
import styles from "./mvp-landing-cta.module.css";

type MvpLandingCtaProps = {
  candidateCount?: number;
  status?: MvpCampaign["status"];
  published?: boolean;
};

/**
 * Landing entry point for the MVP vote.
 *
 * The homepage is statically revalidated every 60s, so the server-rendered
 * status can lag behind the manager opening the vote or revealing the winner
 * mid-broadcast. This polls the live endpoint to keep the banner truthful, and
 * shows the right copy for each phase instead of always claiming "VOTING LIVE".
 */
export function MvpLandingCta({
  candidateCount = 5,
  status: initialStatus,
  published: initialPublished = false,
}: MvpLandingCtaProps) {
  const [status, setStatus] = useState<MvpCampaign["status"] | undefined>(initialStatus);
  const [published, setPublished] = useState(initialPublished);
  const [count, setCount] = useState(candidateCount);

  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      getMvpVoting({ cache: "no-store" })
        .then((data) => {
          if (cancelled || !data.campaign) return;
          setStatus(data.campaign.status);
          setPublished(Boolean(data.campaign.publishedAt));
          setCount(data.campaign.candidates.length || candidateCount);
        })
        .catch(() => undefined);
    };

    sync();
    const timer = window.setInterval(sync, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [candidateCount]);

  const isLive = status === "OPEN";
  const isRevealed = published;

  const label = isRevealed ? "RESULT IN" : isLive ? "VOTING LIVE" : "VOTING CLOSED";
  const title = isRevealed ? (
    <>See the Grand Final <strong>MVP</strong></>
  ) : (
    <>Choose the Grand Final <strong>MVP</strong></>
  );
  const subtitle = isRevealed
    ? "The community has spoken. See who took it."
    : isLive
      ? `${count} finalists. One vote per account.`
      : "Voting has closed. The winner is revealed on stream.";
  const action = isRevealed ? "SEE RESULT" : isLive ? "VOTE NOW" : "VIEW";

  return (
    <Link
      href="/mvp-voting"
      className={styles.cta}
      aria-label={isRevealed ? "See the Grand Final MVP result" : "Vote for the Grand Final MVP"}
    >
      <span className={styles.ambient} aria-hidden="true" />
      <span className={styles.sweep} aria-hidden="true" />

      <span className={styles.iconWrap} aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none">
          <path d="M15 8h18v7c0 8.5-3.8 14.2-9 16.2C18.8 29.2 15 23.5 15 15V8Z" stroke="currentColor" strokeWidth="2.6" />
          <path d="M15 12H8c0 8 3.6 12 10.2 12M33 12h7c0 8-3.6 12-10.2 12M24 31v7M17 41h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <path d="m24 12 1.8 3.7 4.1.6-3 2.9.7 4.1-3.6-1.9-3.6 1.9.7-4.1-3-2.9 4.1-.6L24 12Z" fill="currentColor" />
        </svg>
      </span>

      <span className={styles.copy}>
        <span className={styles.liveRow}>
          {isLive && !isRevealed && <span className={styles.liveDot} aria-hidden="true" />}
          <span>{label}</span>
          <span className={styles.separator}>•</span>
          <span>GRAND FINAL</span>
        </span>
        <span className={styles.title}>{title}</span>
        <span className={styles.subtitle}>{subtitle}</span>
      </span>

      <span className={styles.action}>
        <span>{action}</span>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12h13M13 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}
