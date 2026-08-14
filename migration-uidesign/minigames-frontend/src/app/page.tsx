"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFamilyFeudStatus, getGames, type FamilyFeudStatus, type MiniGame, type MiniGameMember } from "@/lib/minigames";

function BuilderChip({ developer }: { developer: MiniGameMember | null }) {
  if (!developer) return <span className="builder-chip builder-speech"><span className="avatar avatar-fallback">GG</span><span><b>The workshop</b><em>Still building it!</em></span></span>;
  return <span className="builder-chip builder-speech">
    {developer.avatarUrl ? <img className="avatar" src={developer.avatarUrl} alt="" /> : <span className="avatar avatar-fallback">{developer.username.slice(0, 2)}</span>}
    <span><b>{developer.username}</b><em>Still building it!</em></span>
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
        <span className="game-state">{underDevelopment ? "STILL BUILDING IT!" : "Open game →"}</span>
        {underDevelopment ? <BuilderChip developer={game.underDevelopmentBy} /> : null}
      </div>
    </div>
  </Link>;
}

export default function MinigamesHome() {
  const [games, setGames] = useState<MiniGame[]>([]);
  const [familyFeud, setFamilyFeud] = useState<FamilyFeudStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getGames().then(setGames).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load games."));
    void getFamilyFeudStatus().then(setFamilyFeud).catch(() => undefined);
  }, []);

  return <div className="page-shell">
    <p className="eyebrow">Goonginga Network presents</p>
    <h1 className="page-title game-nights-title font-display">GOONGINGA GAME NIGHTS!!</h1>
    <p className="page-lede">Live games built for the community, their players, and the big screen. Pick a game and join the next Goonginga moment.</p>

    <section className="hero-grid" aria-label="Goonginga Minigames introduction">
      <div className="hero-copy">
        <p className="eyebrow">For players, streams, and socials</p>
        <h2 className="hero-title font-display">The <span className="gradient">party</span><br />is online.</h2>
        <p className="page-lede">Every game has a player experience, a clean 1920×1080 stream board, and tools for the Social Media team to run it live.</p>
        <Link className="hero-action" href="#games">Explore games</Link>
      </div>
      <div className="hero-image" role="img" aria-label="D.Va and Sombra playing games" />
    </section>

    <div className="section-row" id="games">
      <div><p className="eyebrow">Available now</p><h2 className="section-title font-display">Game library</h2></div>
      <span className="hint">New games are published by the Social Media team.</span>
    </div>

    <div className="game-grid">
      <Link href="/feud" className="game-card">
        <div className="game-cover family" />
        <div className="game-card-content">
          <span className="game-type">Live game show</span>
          <h3 className="font-display">Network Feud</h3>
          <p>A live two-team survey showdown with player, manager, and broadcast views.</p>
          <div className="game-card-footer"><span className="game-state">LIVE MULTIPLAYER</span><BuilderChip developer={familyFeud?.underDevelopmentBy || null} /></div>
        </div>
      </Link>
      {games.map((game) => <GameCard key={game.id} game={game} />)}
    </div>

    {games.length === 0 ? <section className="empty-state" aria-live="polite">
      <div><h3 className="font-display">No games created yet</h3><p>The Social Media team can create a title, cover image, route, and live game configuration from their dashboard. Jeopardy is ready for its first board.</p>{error ? <span className="feedback">{error}</span> : null}</div>
    </section> : null}
  </div>;
}
