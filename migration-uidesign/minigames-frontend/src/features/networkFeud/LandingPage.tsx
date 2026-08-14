"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createFeudGame } from "@/lib/familyFeud/api";
import { useNetworkSession } from "@/lib/networkSession";
import { FeudLogo } from "./Shared";
import styles from "./network-feud.module.css";

function normalizeCode(value: string) {
  const plain = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (plain.startsWith("NF") && plain.length > 2) return `NF-${plain.slice(2, 6)}`;
  return plain;
}

export function LandingPage() {
  const router = useRouter();
  const { user, token, isHydrated } = useNetworkSession();
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!token) return router.push("/login");
    setCreating(true);
    setError(null);
    try {
      const game = await createFeudGame(token, {
        title: "Network Feud",
        teamAlphaName: "Team Nova",
        teamBetaName: "Team Pulse",
        config: { maxPlayersPerTeam: 5, answerSeconds: 20, roundCount: 4, fastMoneyTarget: 200 },
      });
      router.push(`/feud/manager/${game.game.code}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The match could not be created.");
    } finally { setCreating(false); }
  };

  const join = () => {
    const code = normalizeCode(joinCode);
    if (code) router.push(`/feud/lobby/${code}`);
  };

  return <div className={styles.shell}>
    <div className={styles.hero}>
      <div>
        <FeudLogo />
        <p className={styles.eyebrow} style={{ marginTop: 30 }}>Two teams · One survey board · No second chances</p>
        <h1 className={styles.title}>The network<br />has spoken.</h1>
        <p className={styles.subhead} style={{ marginInline: "auto" }}>A live multiplayer game show where an external challenge decides who answers first—then survey instinct decides who controls the board.</p>
        <div className={styles.joinBox}>
          <input className={styles.input} value={joinCode} onChange={(event) => setJoinCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && join()} placeholder="Enter match code · NF-2048" aria-label="Match code" />
          <button className={styles.button} onClick={join}>Join match</button>
        </div>
        <div className={styles.heroActions}>
          <button className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => void create()} disabled={!isHydrated || creating}>{creating ? "Creating…" : user ? "Create manager room" : "Sign in to host"}</button>
          <Link className={`${styles.button} ${styles.buttonSecondary}`} style={{ display: "inline-grid", placeItems: "center" }} href="/admin/feud/questions">Question library</Link>
        </div>
        {error ? <p className={`${styles.notice} ${styles.error}`} style={{ marginTop: 18 }}>{error}</p> : null}
      </div>
    </div>
  </div>;
}
