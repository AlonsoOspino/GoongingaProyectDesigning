"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, Radio, Swords } from "lucide-react";
import type { PointerEvent } from "react";
import type { TournamentAnnouncementPayload } from "@/announcements/types";
import styles from "@/announcements/announcements.module.css";

function Team({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div className={styles.team}>
      {logo ? <img src={logo} alt={`${name} logo`} /> : <span>{name.slice(0, 2)}</span>}
      <strong>{name}</strong>
    </div>
  );
}

function countdown(target: string | null, now: number) {
  if (!target) return null;
  const remaining = Math.max(0, new Date(target).getTime() - now);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return [
    [days, "Days"],
    [hours, "Hours"],
    [minutes, "Minutes"],
    [seconds, "Seconds"],
  ] as const;
}

export function TournamentMode({ payload, now, standalone = false }: { payload: TournamentAnnouncementPayload; now: number; standalone?: boolean }) {
  const match = payload.match;
  const time = match ? countdown(match.startDate, now) : null;

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
          {payload.state === "LIVE" ? <><Radio size={15} /> Live match</> : <><Swords size={15} /> Tournament mode</>}
        </div>

        {!match ? (
          <div className={styles.idle}>
            <div><span>Goonginga Season 9</span><h2>Match schedule in preparation</h2></div>
            <Link href="/season-9">Season details <ArrowRight size={18} /></Link>
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
                <div className={styles.countdown} aria-label="Time until the next match">
                  {time?.map(([value, label]) => <div key={label}><strong>{String(value).padStart(2, "0")}</strong><span>{label}</span></div>)}
                </div>
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
