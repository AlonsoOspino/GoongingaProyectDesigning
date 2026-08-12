"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { getActiveJeopardy, type JeopardyGame, type JeopardyParticipant } from "@/lib/api/minigame";
import { useAnimatedScore } from "@/minigames/useAnimatedScore";
import styles from "./jeopardy.module.css";

const PODIUM_ORDER = [1, 0, 2];

function AnimatedPoints({ score, delay }: { score: number; delay: number }) {
  const display = useAnimatedScore(score, delay, 1200);
  const value = Math.abs(display).toLocaleString();
  return <>{display < 0 ? `-$${value}` : `$${value}`}</>;
}

function PodiumSlot({ participant, slotIndex }: { participant?: JeopardyParticipant; slotIndex: number }) {
  const revealDelay = slotIndex * 350;
  return (
    <article className={`${styles.slot} ${styles[`slot${slotIndex + 1}`]}`} style={{ "--slot-delay": `${revealDelay}ms` } as React.CSSProperties}>
      <div className={styles.scorePanel}>
        {participant ? <AnimatedPoints score={participant.score} delay={revealDelay + 700} /> : "$0"}
      </div>
      <div className={styles.namePanel}>
        <strong title={participant?.member.username}>{participant?.member.username || "Waiting"}</strong>
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
        <PodiumSlot key={`${slotIndex}-${leaders[leaderIndex]?.id || "empty"}`} participant={leaders[leaderIndex]} slotIndex={slotIndex} />
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

  useLayoutEffect(() => {
    const htmlBackground = document.documentElement.style.background;
    const htmlBackgroundColor = document.documentElement.style.backgroundColor;
    const bodyBackground = document.body.style.background;
    const bodyBackgroundColor = document.body.style.backgroundColor;
    document.documentElement.classList.add("jeopardy-overlay-root");
    document.body.classList.add("jeopardy-overlay-root");
    document.documentElement.style.setProperty("background", "transparent", "important");
    document.documentElement.style.setProperty("background-color", "transparent", "important");
    document.body.style.setProperty("background", "transparent", "important");
    document.body.style.setProperty("background-color", "transparent", "important");
    return () => {
      document.documentElement.classList.remove("jeopardy-overlay-root");
      document.body.classList.remove("jeopardy-overlay-root");
      document.documentElement.style.background = htmlBackground;
      document.documentElement.style.backgroundColor = htmlBackgroundColor;
      document.body.style.background = bodyBackground;
      document.body.style.backgroundColor = bodyBackgroundColor;
    };
  }, []);

  return (
    <main className={styles.viewport} data-overlay-state={loadError ? "error" : game?.phase || "loading"} data-overlay-error={loadError || undefined}>
      <section className={styles.stage}>{game?.participants?.length ? <Podium game={game} /> : null}</section>
    </main>
  );
}
