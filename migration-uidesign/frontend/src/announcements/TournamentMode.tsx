"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, Radio, Swords } from "lucide-react";
import type { PointerEvent } from "react";
import { AnnouncementCountdown } from "@/announcements/AnnouncementCountdown";
import type { AnnouncementConfig, TournamentAnnouncementPayload } from "@/announcements/types";
import styles from "@/announcements/announcements.module.css";

function Team({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div className={styles.team}>
      {logo ? <img src={logo} alt={`${name} logo`} /> : <span>{name.slice(0, 2)}</span>}
      <strong>{name}</strong>
    </div>
  );
}

export function TournamentMode({ payload, config, now, standalone = false }: { payload: TournamentAnnouncementPayload; config: AnnouncementConfig; now: number; standalone?: boolean }) {
  const match = payload.match;
  const countdownAt = config.countdownAt || match?.startDate;

  function followPointer(event: PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
  }

  return (
    <section className={`${styles.announcement} ${styles.tournament} ${standalone ? styles.standalone : ""}`} onPointerMove={followPointer}>
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.pointerLight} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.modeLabel}>
          {payload.state === "LIVE" ? <><Radio size={15} /> Live match</> : <><Swords size={15} /> Tournament update</>}
        </div>

        {!match ? (
          <div className={styles.idle}>
            <div><span>GGL · Season 9</span><h2>Match schedule in preparation</h2></div>
            <div className={styles.idleActions}>
              <AnnouncementCountdown target={config.countdownAt} now={now} />
              <Link href="/season-9">View Season 9 <ArrowRight size={18} /></Link>
            </div>
          </div>
        ) : (
          <div className={styles.matchLayout}>
            <div className={styles.matchMeta}>
              <span>{payload.state === "LIVE" ? "Now playing" : "Next match"}</span>
              <h2>{match.title || `${match.teamA.name} vs ${match.teamB.name}`}</h2>
              <p>{match.type.replace(/_/g, " ")} · Best of {match.bestOf}</p>
            </div>

            <div className={styles.versus}>
              <Team name={match.teamA.name} logo={match.teamA.logo} />
              {payload.state === "LIVE" ? (
                <div className={styles.liveScore}><strong>{match.mapWinsTeamA}</strong><span>LIVE</span><strong>{match.mapWinsTeamB}</strong></div>
              ) : <span className={styles.vs}>VS</span>}
              <Team name={match.teamB.name} logo={match.teamB.logo} />
            </div>

            <div className={styles.actionArea}>
              {payload.state === "LIVE" ? (
                <div className={styles.liveStatus}><i /><span>Game {Math.max(1, match.gameNumber + 1)}</span></div>
              ) : (
                <AnnouncementCountdown target={countdownAt} now={now} />
              )}
              <Link href={`/schedule/${match.id}`} className={styles.matchLink}>
                {payload.state === "LIVE" ? "Open live match" : <><CalendarClock size={17} /> Match details</>} <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
