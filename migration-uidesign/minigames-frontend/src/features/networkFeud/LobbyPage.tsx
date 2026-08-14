"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { joinFeudGame } from "@/lib/familyFeud/api";
import { getNetworkToken, useNetworkSession } from "@/lib/networkSession";
import { ConnectionPill, ErrorState, FeudLogo, LoadingState } from "./Shared";
import { useFeudGame } from "@/lib/familyFeud/useFeudGame";
import styles from "./network-feud.module.css";

export function LobbyPage() {
  const params = useParams<{ gameId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = String(params.gameId || "").toUpperCase();
  const inviteToken = searchParams.get("invite") || "";
  const requestedSide = searchParams.get("captain") === "BETA" ? "BETA" : "ALPHA";
  const hasCaptainInvite = Boolean(inviteToken);
  const { user } = useNetworkSession();
  const { data, error, loading, connected, refresh } = useFeudGame(code, "lobby");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data && data.game.phase !== "LOBBY" && data.me) router.replace(`/feud/game/${code}`);
  }, [code, data, router]);

  const joinAsCaptain = async () => {
    const token = getNetworkToken();
    const returnPath = `/feud/lobby/${code}?captain=${requestedSide}&invite=${encodeURIComponent(inviteToken)}`;
    if (!token) return router.push(`/login?next=${encodeURIComponent(returnPath)}`);
    setBusy(true);
    setMessage(null);
    try {
      await joinFeudGame(token, code, "PLAYER", undefined, inviteToken);
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "This captain invitation could not be accepted.");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <LoadingState />;
  if (!data) return <ErrorState message={error || "This Family Feud game does not exist."} />;
  const invitedTeam = data.teams.find((team) => team.side === requestedSide) || data.teams[0];
  const myTeam = data.me?.side ? data.teams.find((team) => team.side === data.me?.side) : null;
  const returnPath = `/feud/lobby/${code}?captain=${requestedSide}&invite=${encodeURIComponent(inviteToken)}`;

  return <div className={styles.shell}>
    <div className={styles.container}>
      <div className={styles.topline}><FeudLogo /><ConnectionPill connected={connected} /></div>
      <section className={`${styles.card} ${styles.captainJoinCard}`}>
        <p className={styles.eyebrow}>Captain invitation</p>
        {data.me?.role === "PLAYER" && myTeam ? <>
          <h1>You are connected as captain of {myTeam.name}</h1>
          <p>The manager can start when the other captain joins. This page will open the game automatically.</p>
          <div className={styles.captainTeamPreview} style={{ "--team": myTeam.color } as React.CSSProperties}><strong>{myTeam.name}</strong><span>Captain: {myTeam.captainName}</span></div>
          <div className={styles.captainStatus}><span className={styles.statusDot} /> Ready and waiting for the manager</div>
        </> : hasCaptainInvite ? <>
          <h1>Join {invitedTeam.name}</h1>
          <p>The manager invited you to represent this team in Family Feud. Accepting assigns you as captain and marks you ready.</p>
          <div className={styles.captainTeamPreview} style={{ "--team": invitedTeam.color } as React.CSSProperties}><strong>{invitedTeam.name}</strong><span>Captain seat</span></div>
          {user ? <button className={styles.button} disabled={busy} onClick={() => void joinAsCaptain()}>{busy ? "Joining..." : `Join as ${invitedTeam.name} captain`}</button> : <Link className={styles.button} href={`/login?next=${encodeURIComponent(returnPath)}`}>Sign in and join</Link>}
        </> : <>
          <h1>You need a captain invitation</h1>
          <p>Ask the game manager to send the private link for your team. A game code alone does not assign a captain.</p>
          <Link className={`${styles.button} ${styles.buttonSecondary}`} href="/feud">Back to Family Feud</Link>
        </>}
        {message || error ? <p className={`${styles.notice} ${styles.error}`}>{message || error}</p> : null}
      </section>
    </div>
  </div>;
}
