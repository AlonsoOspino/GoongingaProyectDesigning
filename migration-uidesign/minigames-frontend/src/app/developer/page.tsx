"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getGames, setGameStatus, type MiniGame } from "@/lib/minigames";
import { hasNetworkRole, useNetworkSession } from "@/lib/networkSession";

export default function DeveloperDashboard() {
  const { user, token } = useNetworkSession();
  const [games, setGames] = useState<MiniGame[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const permitted = hasNetworkRole(user, "DEVELOPER", "ADMIN");
  useEffect(() => { if (permitted) void getGames().then(setGames).catch((reason) => setFeedback(reason instanceof Error ? reason.message : "Could not load games.")); }, [permitted]);

  async function changeStatus(game: MiniGame, status: "LIVE" | "UNDER_DEVELOPMENT") {
    if (!token) return; setFeedback(null);
    try { const updated = await setGameStatus(game.slug, status, token); setGames((all) => all.map((item) => item.id === game.id ? updated : item)); }
    catch (reason) { setFeedback(reason instanceof Error ? reason.message : "Could not update status."); }
  }

  if (!user) return <section className="staff-only"><p className="eyebrow">Developer Dashboard</p><h1 className="font-display">Sign in first</h1><p>Use your Network Users account to see game controls.</p><Link className="primary-button" href="/login">Sign in</Link></section>;
  if (!permitted) return <section className="staff-only"><p className="eyebrow">Developer Dashboard</p><h1 className="font-display">Role required</h1><p>The <b>Developer</b> role controls the public build status. Marking a game as under development shows your profile in its black-and-white card.</p></section>;

  return <div className="page-shell"><p className="eyebrow">Developer Dashboard</p><h1 className="page-title font-display">Build status</h1><p className="page-lede">Control whether a Minigame is live or shows the dedicated “Still building it!” experience.</p><div className="game-grid">{games.map((game) => <article className="game-card" key={game.id}><div className="game-cover" style={game.coverImageUrl ? { backgroundImage: `linear-gradient(180deg, transparent 15%, rgba(4,6,12,.97) 95%), url("${game.coverImageUrl}")` } : undefined} /><div className="game-card-content"><span className="game-type">/{game.slug}</span><h3 className="font-display">{game.title}</h3><p>Current state: {game.status === "LIVE" ? "Live" : "Under development"}</p><div className="toolbar"><button className="secondary-button" onClick={() => void changeStatus(game, "LIVE")}>Set live</button><button className="danger-button" onClick={() => void changeStatus(game, "UNDER_DEVELOPMENT")}>Still building it</button></div></div></article>)}</div>{games.length === 0 ? <section className="empty-state"><div><h3 className="font-display">Nothing to build yet</h3><p>The Social Media team needs to publish a game first.</p></div></section> : null}{feedback ? <p className="feedback">{feedback}</p> : null}</div>;
}
