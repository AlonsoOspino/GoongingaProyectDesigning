"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Match, Team } from "@/lib/api/types";
import { resolveGenericBackendAsset } from "@/lib/assetUrls";
import { getSeriesLength } from "@/lib/match-format";
import styles from "./finals.module.css";

function initials(name?: string) {
  return (name || "TBD").split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase();
}

function TeamLogo({ team, side }: { team?: Team; side: "a" | "b" }) {
  const [logoFailed, setLogoFailed] = useState(!team?.logo);
  return (
    <article className={`${styles.teamPlate} ${side === "a" ? styles.teamPlateA : styles.teamPlateB}`}>
      <span className={styles.teamPlateNumber} aria-hidden="true">{side === "a" ? "01" : "02"}</span>
      <div className={styles.teamPlateLabel}>FINALIST</div>
      <div className={styles.logoCore}>
        {team?.logo && !logoFailed ? (
          <img src={resolveGenericBackendAsset(team.logo)} alt={`${team.name} logo`} onError={() => setLogoFailed(true)} />
        ) : <span aria-label={`${team?.name || "Finalist"} logo`}>{initials(team?.name)}</span>}
      </div>
      <div className={styles.teamIdentity}>
        <small>GRAND FINALIST</small>
        <strong>{team?.name || "Finalist TBD"}</strong>
      </div>
    </article>
  );
}

function getParts(target: number | null, now: number) {
  if (target === null) return null;
  const seconds = Math.max(0, Math.floor((target - now) / 1000));

  const units = [
    { label: "days", value: Math.floor(seconds / 86400) },
    { label: "hours", value: Math.floor((seconds % 86400) / 3600) },
    { label: "minutes", value: Math.floor((seconds % 3600) / 60) },
    { label: "seconds", value: seconds % 60 },
  ];

  // Drops leading zero units so the countdown never shows a dead "00 DAYS" cell
  // on the broadcast. Minutes and seconds are always kept.
  const firstMeaningful = units.findIndex((unit) => unit.value > 0);
  const startAt = firstMeaningful === -1 ? 2 : Math.min(firstMeaningful, 2);

  return units.slice(startAt);
}

export function FinalsAnnouncement({ match, teamA, teamB }: { match: Match; teamA?: Team; teamB?: Team }) {
  const [now, setNow] = useState<number | null>(null);
  const effectiveStart = match.presentationStartDate || match.startDate;
  const target = useMemo(() => {
    if (!effectiveStart) return null;
    const value = new Date(effectiveStart).getTime();
    return Number.isFinite(value) ? value : null;
  }, [effectiveStart]);
  const parts = now === null ? null : getParts(target, now);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className={styles.announcement} aria-labelledby="finals-announcement-title">
      <div className={styles.scanlines} aria-hidden="true" />
      <div className={styles.announcementShell}>
        <div className={styles.finalsBar}>
          <div className={styles.finalsBrand}><i /> GOONGINGA LEAGUE</div>
          <span>SEASON CHAMPIONSHIP</span>
          <strong>BEST OF {getSeriesLength(match)}</strong>
        </div>
        <div className={styles.announcementHeading}>
          <span>THE SEASON DECIDES HERE</span>
          <h2 id="finals-announcement-title">GRAND FINAL</h2>
        </div>
        <div className={styles.versusGrid}>
        <TeamLogo team={teamA} side="a" />
        <div className={styles.versusCenter}>
          <span>CHAMPIONSHIP MATCH</span>
          <div className={styles.vsMark}><strong>VS</strong></div>
          {parts && target && now !== null && target > now ? (
            <div className={styles.countdown} aria-label="Time until the Grand Final">
              {Object.entries(parts).map(([label, value]) => (
                <div key={label}><b>{String(value).padStart(2, "0")}</b><small>{label}</small></div>
              ))}
            </div>
          ) : (
            <div className={styles.soon}><small>FIRST BELL</small>{now === null ? "GET READY" : target ? "STARTING NOW" : "SOON"}</div>
          )}
        </div>
        <TeamLogo team={teamB} side="b" />
      </div>
      <div className={styles.announcementFooter}>
        <span>MATCH HUB <i /> CAPTAIN CHECK-IN <i /> SEASON RECAP</span>
      <Link className={styles.enterLink} href={`/draft-table/${match.id}`}>
        ENTER <span aria-hidden="true">↗</span>
      </Link>
      </div>
      </div>
    </section>
  );
}
