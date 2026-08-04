"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getGame, type MiniGame } from "@/lib/minigames";

export default function StreamGameView() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [game, setGame] = useState<MiniGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    const refresh = () => void getGame(slug).then((loaded) => { if (mounted) { setGame(loaded); setError(null); } }).catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : "Could not load stream board."); });
    refresh(); const interval = window.setInterval(refresh, 2000);
    return () => { mounted = false; window.clearInterval(interval); };
  }, [slug]);

  if (!game) return <div className="stream-layout"><div className="stream-board"><div className="stream-title"><h1>Loading board</h1><p>{error || "Goonginga Minigames"}</p></div></div></div>;
  const categories = game.board?.categories || [];
  const rows = Math.max(1, ...categories.map((category) => category.questions.length));
  return <div className="stream-layout"><section className="stream-board" aria-label={`${game.title} stream board`}><header className="stream-title"><h1>{game.title}</h1><p>Goonginga Minigames</p></header><div className="stream-grid">{categories.map((category) => <div className="stream-category" key={category.id}>{category.name}</div>)}{Array.from({ length: rows }).flatMap((_, row) => categories.map((category) => { const question = category.questions[row]; return <div className={`stream-value ${question?.used ? "used" : ""}`} key={`${category.id}-${row}`}>{question?.used ? "" : question ? `$${question.reward}` : ""}</div>; }))}</div></section></div>;
}
