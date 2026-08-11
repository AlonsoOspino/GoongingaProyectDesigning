"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Gamepad2, Radio } from "lucide-react";
import { AnnouncementCountdown } from "@/announcements/AnnouncementCountdown";
import type { AnnouncementConfig, JeopardyAnnouncementPayload } from "@/announcements/types";
import styles from "@/announcements/announcements.module.css";

export function JeopardyMode({ payload, config, now, standalone = false }: { payload: JeopardyAnnouncementPayload; config: AnnouncementConfig; now: number; standalone?: boolean }) {
  const game = payload.game;
  const fallbackCover = "/ramattra-login-cropped.webp";
  const [cover, setCover] = useState(game?.coverImageUrl || fallbackCover);

  useEffect(() => setCover(game?.coverImageUrl || fallbackCover), [game?.coverImageUrl]);

  return (
    <section className={`${styles.announcement} ${styles.jeopardy} ${standalone ? styles.standalone : ""}`}>
      {game ? <img className={styles.jeopardyCover} src={cover} onError={() => setCover(fallbackCover)} alt="" /> : null}
      <div className={styles.jeopardyShade} />
      <div className={styles.inner}>
        <div className={styles.modeLabel}><Gamepad2 size={16} /> Jeopardy event</div>
        <div className={styles.jeopardyContent}>
          <div>
            <span>{game ? <><Radio size={14} /> {game.phase === "CREATED" ? "Starts soon" : game.phase === "FINALIZED" ? "Final standings" : "Live"}</> : "Minigames"}</span>
            <h2>{game?.title || "Upcoming Jeopardy"}</h2>
            <p>{game?.description || "The next game will appear here when it is published."}</p>
          </div>
          <div className={styles.jeopardyActions}>
            <AnnouncementCountdown target={config.countdownAt} now={now} />
            <Link href="/minigames/jeopardy" className={styles.jeopardyLink}>Open Jeopardy <ArrowRight size={18} /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
