"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown } from "lucide-react";
import { getActiveJeopardy, type JeopardyGame, type JeopardyParticipant } from "@/lib/api/minigame";
import styles from "./jeopardy.module.css";

const REVEAL_ORDER = [1, 0, 2];

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function PlayerAvatar({ participant }: { participant: JeopardyParticipant }) {
  const { member } = participant;
  return (
    <span className={styles.avatar}>
      {member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <strong>{initials(member.username)}</strong>}
    </span>
  );
}

function Podium({ game }: { game: JeopardyGame }) {
  const leaders = useMemo(
    () => [...game.participants].sort((a, b) => b.score - a.score || a.member.username.localeCompare(b.member.username)).slice(0, 3),
    [game.participants],
  );

  return (
    <section className={styles.podiumScene}>
      <div className={styles.motionLines} aria-hidden="true" />
      <header className={styles.heading}>
        <span>Final standings</span>
        <h1>{game.title}</h1>
      </header>

      <div className={styles.podium}>
        {REVEAL_ORDER.map((leaderIndex, columnIndex) => {
          const participant = leaders[leaderIndex];
          const place = leaderIndex + 1;
          if (!participant) return <div key={place} className={styles.emptyPlace} />;
          return (
            <article
              className={`${styles.place} ${place === 1 ? styles.first : place === 2 ? styles.second : styles.third}`}
              key={participant.id}
              style={{ "--reveal-delay": `${columnIndex * 0.65 + 0.3}s` } as React.CSSProperties}
            >
              {place === 1 ? <Crown className={styles.crown} aria-hidden="true" /> : null}
              <span className={styles.placeNumber}>0{place}</span>
              <PlayerAvatar participant={participant} />
              <div className={styles.playerName}>{participant.member.username}</div>
              <div className={styles.score}>{participant.score.toLocaleString()} <small>PTS</small></div>
              <div className={styles.plinth}><b>{place}</b></div>
            </article>
          );
        })}
      </div>

      <footer className={styles.footer}>
        <span>GOONGINGA JEOPARDY</span>
        <i />
        <span>OVERTIME PRODUCTIONS</span>
      </footer>
    </section>
  );
}

export default function JeopardyPodiumPage() {
  const [game, setGame] = useState<JeopardyGame | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setGame(await getActiveJeopardy()); }
    catch { setGame(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 1500);
    return () => window.clearInterval(poll);
  }, [load]);

  const backgroundImage = game?.coverImageUrl
    ? `url("${game.coverImageUrl}"), url("/ramattra-login-cropped.webp")`
    : `url("/ramattra-login-cropped.webp")`;

  return (
    <main className={styles.viewport}>
      <div className={styles.stage} style={{ backgroundImage }}>
        <div className={styles.backdrop} />
        {game?.phase === "FINALIZED" ? (
          <Podium game={game} />
        ) : (
          <div className={styles.idle}>
            <span>Jeopardy podium</span>
            <strong>{loading ? "Loading output" : "Waiting for final results"}</strong>
          </div>
        )}
      </div>
    </main>
  );
}
