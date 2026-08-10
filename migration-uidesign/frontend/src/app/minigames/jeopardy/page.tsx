"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getActiveJeopardy, type JeopardyGame, type JeopardyParticipant } from "@/lib/api/minigame";
import { useAnimatedScore } from "@/minigames/useAnimatedScore";
import styles from "./jeopardy.module.css";

const PODIUM_ORDER = [1, 0, 2];

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function AnimatedPoints({ score, delay }: { score: number; delay: number }) {
  const display = useAnimatedScore(score, delay, 1200);
  return <>{display.toLocaleString()} <small>PTS</small></>;
}

function PodiumSlot({ participant, place, slotIndex }: { participant?: JeopardyParticipant; place: number; slotIndex: number }) {
  const revealDelay = slotIndex * 350;
  return (
    <article className={`${styles.slot} ${styles[`slot${slotIndex + 1}`]}`} style={{ "--slot-delay": `${revealDelay}ms` } as React.CSSProperties}>
      <div className={styles.nameplate}>
        <span>0{place}</span>
        <strong>{participant?.member.username || "Waiting"}</strong>
      </div>
      <div className={styles.portrait}>
        {participant?.member.avatarUrl
          ? <img src={participant.member.avatarUrl} alt="" />
          : <strong>{participant ? initials(participant.member.username) : "?"}</strong>}
      </div>
      <div className={styles.points}>
        {participant ? <AnimatedPoints score={participant.score} delay={revealDelay + 600} /> : <>0 <small>PTS</small></>}
      </div>
    </article>
  );
}

function Podium({ game }: { game: JeopardyGame }) {
  const leaders = useMemo(
    () => [...game.participants].sort((a, b) => b.score - a.score || a.member.username.localeCompare(b.member.username)).slice(0, 3),
    [game.participants],
  );

  return (
    <div className={styles.rig}>
      <img className={styles.artwork} src="/jeopardy-podium.png" alt="" />
      {PODIUM_ORDER.map((leaderIndex, slotIndex) => (
        <PodiumSlot key={slotIndex} participant={leaders[leaderIndex]} place={leaderIndex + 1} slotIndex={slotIndex} />
      ))}
    </div>
  );
}

export default function JeopardyPodiumOverlay() {
  const [game, setGame] = useState<JeopardyGame | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    try {
      setGame(await getActiveJeopardy());
      setLoadError("");
    } catch (error) {
      setGame(null);
      setLoadError(error instanceof Error ? error.message : "Unable to load Jeopardy");
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 1500);
    return () => window.clearInterval(poll);
  }, [load]);

  return (
    <main className={styles.viewport} data-overlay-state={loadError ? "error" : game?.phase || "loading"} data-overlay-error={loadError || undefined}>
      <section className={styles.stage}>{game?.phase === "FINALIZED" ? <Podium game={game} /> : null}</section>
    </main>
  );
}
