"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { joinFeudGame } from "@/lib/familyFeud/api";
import type { TeamSide } from "@/lib/familyFeud/types";
import { getNetworkToken, useNetworkSession } from "@/lib/networkSession";
import { ConnectionPill, ErrorState, FeudLogo, LoadingState, TeamCard } from "./Shared";
import { useFeudGame } from "@/lib/familyFeud/useFeudGame";
import styles from "./network-feud.module.css";

export function LobbyPage() {
  const params = useParams<{ gameId: string }>();
  const router = useRouter();
  const code = String(params.gameId || "").toUpperCase();
  const { user } = useNetworkSession();
  const { data, error, loading, connected, refresh, action } = useFeudGame(code, "lobby");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data && data.game.phase !== "LOBBY" && data.me) router.replace(`/feud/game/${code}`);
  }, [code, data, router]);

  const join = async (role: "PLAYER" | "SPECTATOR", side?: TeamSide) => {
    const token = getNetworkToken();
    if (!token) return router.push(`/login?return_to=${encodeURIComponent(`/feud/lobby/${code}`)}`);
    setBusy(true); setMessage(null);
    try { await joinFeudGame(token, code, role, side); await refresh(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to join this match."); }
    finally { setBusy(false); }
  };

  const ready = async () => {
    setBusy(true); setMessage(null);
    try { await action("SET_READY", { ready: !data?.me?.ready }); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Ready state could not be updated."); }
    finally { setBusy(false); }
  };

  if (loading && !data) return <LoadingState />;
  if (!data) return <ErrorState message={error || "This match does not exist."} />;
  return <div className={styles.shell}>
    <div className={`${styles.container} ${styles.wide}`}>
      <div className={styles.topline}>
        <FeudLogo />
        <div className={styles.buttonRow}><span className={styles.code}>{data.game.code}</span><ConnectionPill connected={connected} /></div>
      </div>
      <div style={{ marginBottom: 26 }}>
        <p className={styles.eyebrow}>Match lobby · Managed by {data.game.manager.name}</p>
        <h1 className={styles.title} style={{ fontSize: "clamp(44px, 6vw, 76px)" }}>Pick a side.<br />Bring your answer.</h1>
      </div>
      {message || error ? <p className={`${styles.notice} ${styles.error}`} style={{ marginBottom: 18 }}>{message || error}</p> : null}
      {!user ? <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: 18 }}><h2 className={styles.sectionTitle}>Sign in to take your seat</h2><p className={styles.sectionCopy}>Network Feud uses your existing Goonginga Network account and profile.</p><Link className={`${styles.button}`} style={{ display: "inline-grid", placeItems: "center", marginTop: 16 }} href={`/login?return_to=${encodeURIComponent(`/feud/lobby/${code}`)}`}>Sign in with Discord</Link></div> : null}
      <div className={styles.grid2}>
        {data.teams.map((team) => <div className={styles.stack} key={team.side}>
          <TeamCard team={team} />
          {!data.me && data.game.canJoin ? <button className={styles.button} disabled={busy} onClick={() => void join("PLAYER", team.side)}>Join {team.name}</button> : null}
        </div>)}
      </div>
      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginTop: 18 }}>
        {data.me?.role === "PLAYER" ? <div className={styles.topline} style={{ marginBottom: 0 }}>
          <div><h2 className={styles.sectionTitle}>{data.me.ready ? "You are ready" : "Ready when you are"}</h2><p className={styles.sectionCopy}>The manager can start when every active player is ready.</p></div>
          <button className={`${styles.button} ${data.me.ready ? styles.buttonSecondary : styles.buttonAmber}`} disabled={busy} onClick={() => void ready()}>{data.me.ready ? "Mark not ready" : "I'm ready"}</button>
        </div> : data.me?.role === "SPECTATOR" ? <div><h2 className={styles.sectionTitle}>Spectator seat reserved</h2><p className={styles.sectionCopy}>You will move to the responsive player-safe match view when the show starts.</p></div> : <div className={styles.topline} style={{ marginBottom: 0 }}><div><h2 className={styles.sectionTitle}>Prefer to watch?</h2><p className={styles.sectionCopy}>Join as a logged-in spectator without occupying a team slot.</p></div><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy || !user} onClick={() => void join("SPECTATOR")}>Join as spectator</button></div>}
      </div>
    </div>
  </div>;
}
