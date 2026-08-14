"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { joinFeudDevelopmentGuest, joinFeudGame } from "@/lib/familyFeud/api";
import { saveFeudGuestToken } from "@/lib/familyFeud/developmentGuest";
import type { TeamSide } from "@/lib/familyFeud/types";
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
  const developmentLink = searchParams.get("development") === "1";
  const { user } = useNetworkSession();
  const { data, error, loading, connected, refresh } = useFeudGame(code, "lobby");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestSide, setGuestSide] = useState<TeamSide>("ALPHA");

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

  const joinAsTestPlayer = async () => {
    if (guestName.trim().length < 2) return setMessage("Enter a name for this test player.");
    setBusy(true);
    setMessage(null);
    try {
      const result = await joinFeudDevelopmentGuest(code, { name: guestName.trim(), side: guestSide });
      if (!saveFeudGuestToken(code, result.token)) throw new Error("This browser could not keep the temporary test session.");
      await refresh();
      router.push(`/feud/game/${code}`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "The test player could not join.");
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
      <div className={styles.lobbyScene} aria-hidden="true"><div className={styles.showStage} /><img className={styles.showCoins} src="/feud-coins.webp" alt="" /><img className={styles.showHost} src="/feud-doomfist.webp" alt="" /></div>
      <section className={`${styles.card} ${styles.captainJoinCard} ${styles.lobbyJoinCard}`}>
        <p className={styles.eyebrow}>{data.me?.isGuest || (developmentLink && data.game.developmentMode) ? "Development session" : "Captain invitation"}</p>
        {data.me?.role === "PLAYER" && myTeam ? <>
          <h1>{data.me.isGuest ? `Test player connected to ${myTeam.name}` : `You are connected as captain of ${myTeam.name}`}</h1>
          <p>{data.me.isGuest ? "Keep this tab open. Use another tab or browser window to add the next test player." : "The manager can start when the other captain joins. This page will open the game automatically."}</p>
          <div className={styles.captainTeamPreview} style={{ "--team": myTeam.color } as React.CSSProperties}><strong>{myTeam.name}</strong><span>{data.me.isCaptain ? `Captain: ${myTeam.captainName}` : "Test player"}</span></div>
          <div className={styles.captainStatus}><span className={styles.statusDot} /> Ready and waiting for the manager</div>
        </> : hasCaptainInvite ? <>
          <h1>Join {invitedTeam.name}</h1>
          <p>The manager invited you to represent this team in Family Feud. Accepting assigns you as captain and marks you ready.</p>
          <div className={styles.captainTeamPreview} style={{ "--team": invitedTeam.color } as React.CSSProperties}><strong>{invitedTeam.name}</strong><span>Captain seat</span></div>
          {user ? <button className={styles.button} disabled={busy} onClick={() => void joinAsCaptain()}>{busy ? "Joining..." : `Join as ${invitedTeam.name} captain`}</button> : <Link className={styles.button} href={`/login?next=${encodeURIComponent(returnPath)}`}>Sign in and join</Link>}
        </> : developmentLink && data.game.developmentMode ? <>
          <h1>Add a test player</h1>
          <p>No Discord account is needed. This player only exists in this tab and leaves the game when the tab is closed.</p>
          <label className={styles.field}><span>Player name</span><input className={styles.input} value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Player 1" maxLength={32} autoFocus /></label>
          <div className={styles.testTeamGrid}>
            {data.teams.map((team) => <button type="button" key={team.side} className={`${styles.testTeamChoice} ${guestSide === team.side ? styles.testTeamChoiceActive : ""}`} style={{ "--team": team.color } as React.CSSProperties} onClick={() => setGuestSide(team.side)}><strong>{team.name}</strong><span>{team.players.length} connected</span></button>)}
          </div>
          <button className={styles.button} disabled={busy} onClick={() => void joinAsTestPlayer()}>{busy ? "Joining..." : "Join this test session"}</button>
          <p className={styles.guestHint}>Tip: open this same link in another tab for every player you want to simulate.</p>
        </> : developmentLink ? <>
          <h1>Development mode is off</h1>
          <p>Ask a Social Media manager to enable development mode for this game, then reload this page.</p>
          <Link className={`${styles.button} ${styles.buttonSecondary}`} href="/feud">Back to Family Feud</Link>
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
