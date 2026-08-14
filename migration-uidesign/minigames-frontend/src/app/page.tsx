"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getGames, type MiniGame, type MiniGameMember } from "@/lib/minigames";

function BuilderChip({ developer }: { developer: MiniGameMember | null }) {
  if (!developer) return <span className="builder-chip builder-speech"><span className="avatar avatar-fallback">GG</span><span><b>Goonginga team</b><em>In development</em></span></span>;
  return <span className="builder-chip builder-speech">
    {developer.avatarUrl ? <img className="avatar" src={developer.avatarUrl} alt="" /> : <span className="avatar avatar-fallback">{developer.username.slice(0, 2)}</span>}
    <span><b>{developer.username}</b><em>In development</em></span>
  </span>;
}

function GameCard({ game }: { game: MiniGame }) {
  const underDevelopment = game.status === "UNDER_DEVELOPMENT";
  const coverStyle = game.coverImageUrl
    ? { backgroundImage: `linear-gradient(180deg, transparent 15%, rgba(4,6,12,.97) 95%), url("${game.coverImageUrl}")` }
    : undefined;
  return <Link href={`/${game.slug}`} className={`game-card ${underDevelopment ? "under-development" : ""}`}>
    <div className="game-cover" style={coverStyle} />
    <div className="game-card-content">
      <span className="game-type">{underDevelopment ? "Under development" : game.gameType.replace("_", " ")}</span>
      <h3 className="font-display">{game.title}</h3>
      <p>{underDevelopment ? "This game is being built for the next Goonginga session." : game.description || "A live Goonginga minigame."}</p>
      <div className="game-card-footer">
        <span className="game-state">{underDevelopment ? "In development" : "Open game"}</span>
        {underDevelopment ? <BuilderChip developer={game.underDevelopmentBy} /> : null}
      </div>
    </div>
  </Link>;
}

export default function MinigamesHome() {
  const [games, setGames] = useState<MiniGame[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getGames().then(setGames).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load games."));
  }, []);

  return <div className="page-shell">
    <section className="game-directory-intro">
      <div><p className="eyebrow">Goonginga Game Nights</p><h1>Choose a game</h1><p>Players can join with a room code. Managers can sign in to create a match and open the broadcast view.</p></div>
      <div className="directory-actions"><Link className="primary-button" href="/feud">Open Network Feud</Link><a className="secondary-button" href={(process.env.NEXT_PUBLIC_GOONGINGA_URL || "http://localhost:3000").replace(/\/$/, "")}>Back to Goonginga</a></div>
    </section>

    <div className="section-row" id="games">
      <div><p className="eyebrow">Available games</p><h2 className="directory-title">Game library</h2></div>
      <span className="hint">Choose a game to join or manage it.</span>
    </div>

    <div className="game-grid">
      <Link href="/feud" className="game-card">
        <div className="game-cover family" />
        <div className="game-card-content">
          <span className="game-type">Available now</span>
          <h3>Network Feud</h3>
          <p>Join with a code or create a two-team survey game.</p>
          <div className="game-card-footer"><span className="game-state">Open game</span></div>
        </div>
      </Link>
      {games.map((game) => <GameCard key={game.id} game={game} />)}
    </div>

    {games.length === 0 ? <section className="empty-state" aria-live="polite">
      <div><h3>No additional games yet</h3><p>Network Feud is available above. Other games will appear here when they are published.</p>{error ? <span className="feedback">{error}</span> : null}</div>
    </section> : null}
  </div>;
}
