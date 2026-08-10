"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

  const leaders = useMemo(
    () => [...(game?.participants || [])].sort((a, b) => b.score - a.score || a.member.username.localeCompare(b.member.username)).slice(0, 3),
    [game?.participants],
  );

  return (
    <main className={styles.viewport}>
      <section className={styles.stage}>
        {game ? <div className={styles.scoreboard}>{[0,1,2].map((index) => <ScoreCard key={leaders[index]?.id || index} participant={leaders[index]} index={index} />)}</div> : null}
      </section>
    </main>
  );
}
