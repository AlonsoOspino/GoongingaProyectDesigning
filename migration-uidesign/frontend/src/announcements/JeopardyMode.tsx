"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Gamepad2, Radio } from "lucide-react";
import type { JeopardyAnnouncementPayload } from "@/announcements/types";
import styles from "@/announcements/announcements.module.css";

export function JeopardyMode({ payload, standalone = false }: { payload: JeopardyAnnouncementPayload; standalone?: boolean }) {
  const game = payload.game;
  const fallbackCover = "/ramattra-login-cropped.webp";
  const [cover, setCover] = useState(game?.coverImageUrl || fallbackCover);

  useEffect(() => setCover(game?.coverImageUrl || fallbackCover), [game?.coverImageUrl]);

  return (
    <section className={`${styles.announcement} ${styles.jeopardy} ${standalone ? styles.standalone : ""}`}>
      {game ? <img className={styles.jeopardyCover} src={cover} onError={() => setCover(fallbackCover)} alt="" /> : null}
      <div className={styles.jeopardyShade} />
      <div className={styles.inner}>
        <div className={styles.modeLabel}><Gamepad2 size={16} /> Jeopardy Minigame mode</div>
        <div className={styles.jeopardyContent}>
          <div>
            <span>{game ? <><Radio size={14} /> {game.phase === "CREATED" ? "Starting soon" : game.phase === "FINALIZED" ? "Final standings" : "Live Minigame"}</> : "Minigames"}</span>
            <h2>{game?.title || "Jeopardy is not live"}</h2>
            <p>{game?.description || "The next Jeopardy game will appear here when it is published."}</p>
          </div>
          <Link href="/minigames" className={styles.jeopardyLink}>Open Minigames <ArrowRight size={18} /></Link>
        </div>
      </div>
    </section>
  );
}
