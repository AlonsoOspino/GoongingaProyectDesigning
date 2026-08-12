"use client";

import { useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Radio } from "lucide-react";
import styles from "./jeopardy-dashboard.module.css";

const SAMPLE_PLAYERS = [
  { id: 1, username: "AddieBC1", score: 300 },
  { id: 2, username: "Arterrat", score: 700 },
  { id: 3, username: "GoPrough", score: 100 },
  { id: 4, username: "MiracleMax", score: -200 },
  { id: 5, username: "AReallyLongPlayerName", score: 1200 },
];

export function JeopardyOrderPreview() {
  const [players, setPlayers] = useState(SAMPLE_PLAYERS);
  const [published, setPublished] = useState(SAMPLE_PLAYERS.map((player) => player.id));
  const draftIds = players.map((player) => player.id);
  const changed = draftIds.join(",") !== published.join(",");

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= players.length) return;
    setPlayers((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <main style={{ minHeight: "100vh", background: "#eef2f7", padding: "40px 24px", color: "#172033" }}>
      <section style={{ width: "min(1180px, 100%)", margin: "0 auto" }}>
        <p style={{ color: "#007f9a", fontSize: ".7rem", fontWeight: 900, textTransform: "uppercase" }}>Local development preview</p>
        <h1 style={{ marginTop: 8, fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: .9 }}>Jeopardy stream order</h1>
        <p style={{ maxWidth: 680, marginTop: 12, color: "#657086" }}>Use the arrows to arrange the permanent box positions. Publishing locks that order; future score changes update only the numbers.</p>

        <section className={styles.streamOrder} aria-labelledby="preview-title">
          <header>
            <div><span>Preview before publishing</span><h3 id="preview-title">Stream box order</h3><p>This local demo does not touch the live stream or real scores.</p></div>
            <div className={changed ? styles.draftStatus : styles.liveStatus}><Radio size={14}/>{changed ? "Draft not live" : "Live order"}</div>
          </header>
          <div className={styles.orderPreview} style={{ "--preview-count": players.length } as CSSProperties}>
            {players.map((player, index) => <article key={player.id}>
              <div className={styles.previewScore}>${player.score.toLocaleString()}</div>
              <div className={styles.previewName} title={player.username}>{player.username}</div>
              <footer>
                <button disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${player.username} left`}><ChevronLeft size={16}/></button>
                <span>Box {index + 1}</span>
                <button disabled={index === players.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${player.username} right`}><ChevronRight size={16}/></button>
              </footer>
            </article>)}
          </div>
          <footer className={styles.publishOrder}>
            <span>{changed ? "Preview ready. The stream would still show the previous order." : "This exact order would currently remain on stream."}</span>
            <button disabled={!changed} onClick={() => setPublished(draftIds)}><Radio size={16}/>Publish order to preview</button>
          </footer>
        </section>
      </section>
    </main>
  );
}
