import Link from "next/link";
import styles from "./mvp-landing-cta.module.css";

export function MvpLandingCta({ candidateCount = 5 }: { candidateCount?: number }) {
  return (
    <Link href="/mvp-voting" className={styles.cta} aria-label="Vote for the Grand Finals MVP">
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
          <span className={styles.liveDot} aria-hidden="true" />
          <span>VOTING LIVE</span>
          <span className={styles.separator}>•</span>
          <span>GRAND FINALS</span>
        </span>
        <span className={styles.title}>Choose the Grand Finals <strong>MVP</strong></span>
        <span className={styles.subtitle}>{candidateCount} finalists. One vote. You make the call.</span>
      </span>

      <span className={styles.action}>
        <span>VOTE NOW</span>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12h13M13 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}
