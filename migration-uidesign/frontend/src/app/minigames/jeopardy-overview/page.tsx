"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { getActiveJeopardy, type JeopardyGame, type JeopardyParticipant } from "@/lib/api/minigame";
import { useAnimatedScore } from "@/minigames/useAnimatedScore";
import styles from "./jeopardy-overview.module.css";

function ScoreCard({ participant, index }: { participant?: JeopardyParticipant; index: number }) {
  const score = useAnimatedScore(participant?.score || 0, index * 120, 700);
  return (
    <article className={styles.card}>
      <strong title={participant?.member.username}>{participant?.member.username || "Waiting"}</strong>
      <div className={styles.score}>{score.toLocaleString()}</div>
      <div className={styles.controls} aria-hidden="true"><span>+</span><span>-</span></div>
    </article>
  );
}

export default function JeopardyScoreOverlay() {
  const [game, setGame] = useState<JeopardyGame | null>(null);

  const load = useCallback(async () => {
    try { setGame(await getActiveJeopardy()); }
    catch { setGame(null); }
  }, []);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 1200);
    return () => window.clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const htmlBackground = document.documentElement.style.background;
    const bodyBackground = document.body.style.background;
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    return () => {
      document.documentElement.style.background = htmlBackground;
      document.body.style.background = bodyBackground;
    };
  }, []);

  const leaders = useMemo(
    () => [...(game?.participants || [])].sort((a, b) => b.score - a.score || a.member.username.localeCompare(b.member.username)).slice(0, 6),
    [game?.participants],
  );

  return (
    <main className={styles.viewport}>
      <section className={styles.stage}>
        {leaders.length ? (
          <div className={styles.scoreboard} style={{ "--player-count": leaders.length } as CSSProperties}>
            {leaders.map((participant, index) => <ScoreCard key={participant.id} participant={participant} index={index} />)}
          </div>
        ) : null}
      </section>
    </main>
  );
}
