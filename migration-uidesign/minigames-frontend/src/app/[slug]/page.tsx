"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { getGame, getPlayerGame, requestQuestion, type MiniGame, type PlayerMiniGame } from "@/lib/minigames";
import { getNetworkToken, useNetworkSession } from "@/lib/networkSession";
import { UnderDevelopmentScreen } from "@/components/UnderDevelopmentScreen";

function gameCoverStyle(game: MiniGame): CSSProperties {
  return { "--game-cover": game.coverImageUrl ? `url("${game.coverImageUrl}")` : "radial-gradient(circle at 70% 18%, #7039bf, #090d18 60%)" } as CSSProperties;
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return url ? <img className="avatar" src={url} alt="" /> : <span className="avatar avatar-fallback">{name.slice(0, 2).toUpperCase()}</span>;
}

export default function GameLandingPage() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const { user } = useNetworkSession();
  const [game, setGame] = useState<MiniGame | null>(null);
  const [playerGame, setPlayerGame] = useState<PlayerMiniGame | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    const refresh = async () => {
      try {
        const loaded = await getGame(slug);
        if (!active) return;
        setGame(loaded); setFeedback(null);
        const token = getNetworkToken();
        if (token) {
          const player = await getPlayerGame(slug, token);
          if (active) setPlayerGame(player);
        } else if (active) setPlayerGame(null);
      } catch (reason) { if (active) setFeedback(reason instanceof Error ? reason.message : "Could not load this game."); }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 2500);
    return () => { active = false; window.clearInterval(interval); };
  }, [slug]);

  async function request(questionId: string) {
    const token = getNetworkToken();
    if (!token || !game) return;
    setRequesting(true); setFeedback(null);
    try { setGame(await requestQuestion(game.slug, questionId, token)); setFeedback("Request sent to the Social Media manager."); }
    catch (reason) { setFeedback(reason instanceof Error ? reason.message : "Could not request question."); }
    finally { setRequesting(false); }
  }

  if (!game) return <section className="staff-only"><p className="eyebrow">Goonginga Minigames</p><h1 className="font-display">Loading game…</h1><p>{feedback || "Getting the player experience ready."}</p></section>;
  if (game.status === "UNDER_DEVELOPMENT") return <UnderDevelopmentScreen title={game.title} developer={game.underDevelopmentBy} coverImageUrl={game.coverImageUrl} />;

  const player = playerGame?.player;
  const canChoose = Boolean(player?.isTurn && !player?.currentQuestion);
  return <div className="game-page">
    <section className="game-landing" style={gameCoverStyle(game)}>
      <p className="eyebrow">{game.gameType.replace("_", " ")} · Player experience</p>
      <h1 className="font-display">{game.title}</h1>
      <p>{game.description || "Join the live game and make your choice when the host calls your turn."}</p>
      <div className="view-links"><Link className="secondary-button" href={`/${game.slug}/stream`} target="_blank">Open 1920×1080 stream</Link>{user ? null : <Link className="primary-button" href="/login">Sign in to play</Link>}</div>
    </section>

    <section className="panel">
      {game.currentPlayer ? <div className="player-turn"><Avatar name={game.currentPlayer.username} url={game.currentPlayer.avatarUrl} /><span><strong>{player?.isTurn ? "It is your turn" : "Current turn"}</strong><span>{player?.isTurn ? "Choose a question and wait for the manager to confirm it." : `${game.currentPlayer.username} is choosing now.`}</span></span></div> : <p className="hint">The manager has not chosen a player yet. Keep this page open - it refreshes automatically.</p>}
      {player?.currentQuestion ? <div className="question-for-player"><h2>{player.currentQuestion.categoryName} · ${player.currentQuestion.reward}</h2><p>{player.currentQuestion.question}</p><span className="hint">Answer aloud to the host. The stream board intentionally stays on the rewards only.</span></div> : null}
      {player?.requestedQuestionId && !player?.currentQuestion ? <p className="feedback">Your requested question is glowing in the manager dashboard. They may select it or choose another one.</p> : null}
      {game.board ? <div className="manager-board user-board">{game.board.categories.map((category) => <div key={category.id}><div className="board-category">{category.name}</div>{category.questions.map((question) => <button key={question.id} disabled={question.used || !canChoose || requesting} className={`board-cell ${canChoose && !question.used ? "can-request" : ""} ${question.requested ? "requested" : ""} ${question.selected ? "selected" : ""}`} onClick={() => void request(question.id)}>${question.reward}</button>)}</div>)}</div> : null}
      {!user ? <p className="hint" style={{ marginTop: 16 }}>Sign in with your Network Users Discord account to choose a question when it is your turn.</p> : null}
    </section>
    {feedback ? <p className="feedback">{feedback}</p> : null}
  </div>;
}
