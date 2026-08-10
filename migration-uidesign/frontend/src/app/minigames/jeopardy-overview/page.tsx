"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { getActiveJeopardy, type JeopardyGame, type MiniGameMember } from "@/lib/api/minigame";
import styles from "./jeopardy-overview.module.css";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function Avatar({ member }: { member: MiniGameMember }) {
  return (
    <span className={styles.avatar} title={member.username}>
      {member.avatarUrl ? <img src={member.avatarUrl} alt={member.username} /> : <strong>{initials(member.username)}</strong>}
    </span>
  );
}

export default function JeopardyOverviewPage() {
  const [game, setGame] = useState<JeopardyGame | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setGame(await getActiveJeopardy()); }
    catch { setGame(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 1200);
    return () => window.clearInterval(poll);
  }, [load]);

  const members = useMemo(
    () => new Map(game?.participants.map((participant) => [participant.memberId, participant.member]) || []),
    [game?.participants],
  );
  const standings = useMemo(
    () => [...(game?.participants || [])].sort((a, b) => b.score - a.score || a.member.username.localeCompare(b.member.username)),
    [game?.participants],
  );

  if (!game?.board) {
    return <main className={styles.viewport}><div className={styles.empty}>{loading ? "Loading overview" : "No active Jeopardy game"}</div></main>;
  }

  return (
    <main className={styles.viewport}>
      <section className={styles.stage}>
        <header className={styles.header}>
          <div><span>Jeopardy overview</span><h1>{game.title}</h1></div>
          <p>{game.gameState.questionResults.length} answers recorded</p>
        </header>

        <div className={styles.board}>
          {game.board.categories.map((category) => (
            <div
              className={styles.category}
              key={category.id}
              style={{ gridTemplateRows: `1.08fr repeat(${category.questions.length}, 1fr)` }}
            >
              <h2>{category.name}</h2>
              {category.questions.map((question) => {
                const member = question.answeredMemberId ? members.get(question.answeredMemberId) : null;
                return (
                  <div className={`${styles.question} ${question.used ? styles.recorded : styles.open}`} key={question.id}>
                    <span className={styles.value}>{question.reward}</span>
                    {member ? (
                      <div className={styles.answerer}><Avatar member={member} /><strong>{member.username}</strong></div>
                    ) : question.unanswered ? (
                      <span className={styles.missed} aria-label="No one answered"><X /></span>
                    ) : (
                      <span className={styles.pending}>OPEN</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <footer className={styles.standings}>
          <span className={styles.standingsLabel}>Standings</span>
          <div className={styles.players}>
            {standings.map((participant, index) => (
              <article key={participant.id}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <Avatar member={participant.member} />
                <span>{participant.member.username}</span>
                <strong>{participant.score}</strong>
              </article>
            ))}
          </div>
        </footer>
      </section>
    </main>
  );
}
