"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getActiveJeopardy, type JeopardyGame, type JeopardyParticipant } from "@/lib/api/minigame";
import { useAnimatedScore } from "@/minigames/useAnimatedScore";
import styles from "./jeopardy.module.css";

const MAX_PODIUMS = 5;

function podiumOrder(count: number) {
  if (count >= 5) return [3, 1, 0, 2, 4];
  if (count === 4) return [3, 1, 0, 2];
  if (count === 3) return [1, 0, 2];
  if (count === 2) return [1, 0];
  return [0];
}

function AnimatedPoints({ score, delay }: { score: number; delay: number }) {
  const display = useAnimatedScore(score, delay, 1200);
  const value = Math.abs(display).toLocaleString();
  return <>{display < 0 ? `-$${value}` : `$${value}`}</>;
}

function FittedName({ name }: { name: string }) {
  const nameRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const element = nameRef.current;
    const panel = element?.parentElement;
    if (!element || !panel) return;

    const fit = () => {
      element.style.fontSize = "";
      const maximum = Number.parseFloat(window.getComputedStyle(element).fontSize);
      const availableWidth = panel.clientWidth * 0.84;
      let size = maximum;
      while (element.scrollWidth > availableWidth && size > 11) {
        size -= 1;
        element.style.fontSize = `${size}px`;
      }
    };

    const frame = window.requestAnimationFrame(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(panel);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [name]);

  return <strong ref={nameRef} title={name}>{name}</strong>;
}

function PodiumSlot({ participant, slotIndex }: { participant: JeopardyParticipant; slotIndex: number }) {
  const revealDelay = slotIndex * 350;
  const previousScore = useRef(participant.score);
  const [scoreChange, setScoreChange] = useState<{ delta: number; sequence: number } | null>(null);

  useEffect(() => {
    const delta = participant.score - previousScore.current;
    previousScore.current = participant.score;
    if (!delta) return;
    const sequence = Date.now();
    setScoreChange({ delta, sequence });
    const timeout = window.setTimeout(() => setScoreChange((current) => current?.sequence === sequence ? null : current), 1200);
    return () => window.clearTimeout(timeout);
  }, [participant.score]);

  return (
    <article className={`${styles.slot} ${scoreChange ? scoreChange.delta > 0 ? styles.scoreGain : styles.scoreLoss : ""}`} style={{ "--slot-delay": `${revealDelay}ms` } as CSSProperties}>
      <div className={styles.scoreHousing}>
        <div className={styles.scorePanel}>
          <AnimatedPoints score={participant.score} delay={revealDelay + 700} />
        </div>
        {scoreChange ? <span key={scoreChange.sequence} className={styles.scoreChange}>{scoreChange.delta > 0 ? "+" : "−"}${Math.abs(scoreChange.delta).toLocaleString()}</span> : null}
      </div>
      <div className={styles.bodyFrame}>
        <div className={styles.namePanel}>
          <FittedName name={participant.member.username} />
        </div>
      </div>
      <div className={styles.podiumFoot} aria-hidden="true" />
    </article>
  );
}

function Podium({ game }: { game: JeopardyGame }) {
  const leaders = useMemo(
    () => [...game.participants].sort((a, b) => b.score - a.score || a.member.username.localeCompare(b.member.username)).slice(0, MAX_PODIUMS),
    [game.participants],
  );
  const orderedLeaders = podiumOrder(leaders.length)
    .map((leaderIndex) => leaders[leaderIndex])
    .filter(
      (participant): participant is JeopardyParticipant => Boolean(participant),
    );

  return (
    <div className={styles.rig} style={{ "--podium-count": orderedLeaders.length } as CSSProperties}>
      <div className={styles.podiumRow}>
      {orderedLeaders.map((participant, slotIndex) => (
        <PodiumSlot key={participant.id} participant={participant} slotIndex={slotIndex} />
      ))}
      </div>
      <div className={styles.sharedBase} aria-hidden="true" />
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
