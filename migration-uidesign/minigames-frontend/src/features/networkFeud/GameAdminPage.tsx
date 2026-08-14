"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { deleteFeudGame, listFeudGames, setFeudDevelopmentMode } from "@/lib/familyFeud/api";
import type { FeudGameSummary } from "@/lib/familyFeud/types";
import { hasNetworkRole, useNetworkSession } from "@/lib/networkSession";
import { FeudLogo, LoadingState, PhaseName } from "./Shared";
import styles from "./network-feud.module.css";

export function GameAdminPage() {
  const { user, token, isHydrated } = useNetworkSession();
  const canManage = Boolean(user && hasNetworkRole(user, "SOCIAL_MEDIA", "ADMIN"));
  const [games, setGames] = useState<FeudGameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [deleteCode, setDeleteCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !canManage) return setLoading(false);
    try {
      setGames(await listFeudGames(token));
      setMessage(null);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "The Family Feud games could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [canManage, token]);

  useEffect(() => { if (isHydrated) void load(); }, [isHydrated, load]);

  const toggleDevelopment = async (game: FeudGameSummary) => {
    if (!token) return;
    setBusyCode(game.code); setMessage(null);
    try {
      const updated = await setFeudDevelopmentMode(token, game.code, !game.developmentMode);
      setGames((current) => current.map((entry) => entry.code === game.code ? updated : entry));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Development mode could not be changed.");
    } finally {
      setBusyCode(null);
    }
  };

  const copyTestLink = async (code: string) => {
    const link = `${window.location.origin}/feud/lobby/${code}?development=1`;
    try {
      await navigator.clipboard.writeText(link);
      setMessage(`Test link copied for ${code}. Open it in separate tabs or browsers.`);
    } catch {
      setMessage(link);
    }
  };

  const remove = async (code: string) => {
    if (!token) return;
    setBusyCode(code); setMessage(null);
    try {
      await deleteFeudGame(token, code);
      setGames((current) => current.filter((game) => game.code !== code));
      setDeleteCode(null);
      setMessage(`Game ${code} deleted.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "The game could not be deleted.");
    } finally {
      setBusyCode(null);
    }
  };

  if (!isHydrated || (loading && canManage)) return <LoadingState />;
  if (!user) return <AccessCard title="Sign in to manage Family Feud" copy="Use your Goonginga Network account to open the Social Media panel." href="/login?next=/admin/feud/games" action="Sign in" />;
  if (!canManage) return <AccessCard title="Social Media access required" copy="Only Social Media and Admin members can manage all Family Feud games." href="/feud" action="Back to Family Feud" />;

  return <div className={styles.shell}>
    <main className={`${styles.container} ${styles.wide} ${styles.gameAdmin}`}>
      <div className={styles.adminHeading}>
        <div><FeudLogo /><p className={styles.eyebrow}>Social Media panel</p><h1>Family Feud games</h1><p>Open a control room, prepare browser tests or clean up old games from one place.</p></div>
        <div className={styles.buttonRow}><Link className={`${styles.button} ${styles.buttonSecondary}`} href="/admin/feud/questions">Questions</Link><Link className={styles.button} href="/feud">Create game</Link></div>
      </div>

      {message ? <p className={styles.notice}>{message}</p> : null}

      <section className={styles.adminStats}>
        <div><strong>{games.length}</strong><span>Total games</span></div>
        <div><strong>{games.filter((game) => game.developmentMode).length}</strong><span>Development sessions</span></div>
        <div><strong>{games.reduce((sum, game) => sum + game.playerCount, 0)}</strong><span>Connected players</span></div>
      </section>

      {games.length ? <div className={styles.gameAdminGrid}>{games.map((game) => {
        const alpha = game.teams.find((team) => team.side === "ALPHA");
        const beta = game.teams.find((team) => team.side === "BETA");
        const busy = busyCode === game.code;
        return <article className={`${styles.card} ${styles.gameAdminCard}`} key={game.id}>
          <div className={styles.gameAdminTop}>
            <div><div className={styles.gameCode}>{game.code}</div><h2>{game.title}</h2><p>Created by {game.manager.name} · {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(game.createdAt))}</p></div>
            <span className={styles.phaseBadge}><PhaseName phase={game.phase} /></span>
          </div>
          <div className={styles.adminTeams}><div><strong>{alpha?.name || "Team 1"}</strong><span>{alpha?.score || 0}</span></div><i>vs</i><div><strong>{beta?.name || "Team 2"}</strong><span>{beta?.score || 0}</span></div></div>
          <div className={styles.playerSummary}><span>{game.playerCount} players</span>{game.guestCount ? <span>{game.guestCount} temporary</span> : null}</div>
          <div className={`${styles.developmentControl} ${game.developmentMode ? styles.developmentControlOn : ""}`}>
            <div><strong>Development mode</strong><p>{game.developmentMode ? "Temporary players can enter without Discord." : "Production access only. Captains use their private links."}</p></div>
            <button className={styles.switchButton} type="button" role="switch" aria-checked={game.developmentMode} disabled={busy} onClick={() => void toggleDevelopment(game)}><span /></button>
          </div>
          {game.developmentMode ? <button className={`${styles.button} ${styles.buttonAmber}`} disabled={busy} onClick={() => void copyTestLink(game.code)}>Copy test-player link</button> : null}
          <div className={styles.gameAdminActions}>
            <Link className={`${styles.button} ${styles.buttonSecondary}`} href={`/feud/manager/${game.code}`}>Manager</Link>
            <Link className={`${styles.button} ${styles.buttonSecondary}`} href={`/feud/spectator/${game.code}`} target="_blank">Broadcast</Link>
            {deleteCode === game.code ? <><button className={`${styles.button} ${styles.buttonDanger}`} disabled={busy} onClick={() => void remove(game.code)}>{busy ? "Deleting..." : "Confirm delete"}</button><button className={styles.textButton} onClick={() => setDeleteCode(null)}>Cancel</button></> : <button className={styles.textButton} onClick={() => setDeleteCode(game.code)}>Delete</button>}
          </div>
        </article>;
      })}</div> : <section className={`${styles.card} ${styles.emptyGames}`}><h2>No Family Feud games yet</h2><p>Create the first game, then it will appear here automatically.</p><Link className={styles.button} href="/feud">Create Family Feud</Link></section>}
    </main>
  </div>;
}

function AccessCard({ title, copy, href, action }: { title: string; copy: string; href: string; action: string }) {
  return <div className={styles.shell}><div className={styles.centerState}><section className={`${styles.card} ${styles.cardPad}`}><FeudLogo /><h1 className={styles.phaseHero}>{title}</h1><p className={styles.sectionCopy}>{copy}</p><Link className={styles.button} style={{ marginTop: 18 }} href={href}>{action}</Link></section></div></div>;
}
