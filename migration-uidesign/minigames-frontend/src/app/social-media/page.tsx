"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createGame, getGames, uploadCover, type MiniGame, type MiniGameType } from "@/lib/minigames";
import { hasNetworkRole, useNetworkSession } from "@/lib/networkSession";

export default function SocialMediaDashboard() {
  const router = useRouter();
  const { user, token } = useNetworkSession();
  const [games, setGames] = useState<MiniGame[]>([]);
  const [title, setTitle] = useState("");
  const [route, setRoute] = useState("");
  const [description, setDescription] = useState("");
  const [gameType, setGameType] = useState<MiniGameType>("JEOPARDY");
  const [cover, setCover] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const permitted = hasNetworkRole(user, "SOCIAL_MEDIA", "ADMIN");

  useEffect(() => { if (permitted) void getGames().then(setGames).catch(() => undefined); }, [permitted]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSaving(true); setFeedback(null);
    try {
      let game = await createGame({ title, slug: route.replace(/^\/+/, ""), description, gameType }, token);
      if (cover) game = (await uploadCover(game.slug, cover, token)).game;
      router.push(`/social-media/${game.slug}`);
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Could not create Minigame.");
    } finally { setSaving(false); }
  }

  if (!user) return <section className="staff-only"><p className="eyebrow">Social Media Dashboard</p><h1 className="font-display">Sign in first</h1><p>Use your Network Users Discord account to continue.</p><Link className="primary-button" href="/login">Sign in with Discord</Link></section>;
  if (!permitted) return <section className="staff-only"><p className="eyebrow">Social Media Dashboard</p><h1 className="font-display">Role required</h1><p>This dashboard is available to Network Users with the <b>Social Media</b> role. An administrator can grant that role in the database.</p></section>;

  return <div className="page-shell">
    <div className="manager-head"><div><p className="eyebrow">Social Media Dashboard</p><h1 className="font-display">Create a Minigame</h1></div><span className="hint">Signed in as {user.username}</span></div>
    <div className="dashboard-grid">
      <form className="panel" onSubmit={submit}>
        <h2 className="panel-title font-display">Game details</h2>
        <p className="hint">These details render directly in the Minigames library card.</p>
        <div className="field"><label htmlFor="title">Title</label><input id="title" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="GGL Jeopardy: Trivia Night" /></div>
        <div className="field"><label htmlFor="route">Route</label><div className="route-field"><span>/</span><input id="route" required value={route} onChange={(event) => setRoute(event.target.value.replace(/\s/g, "-"))} placeholder="ggl-jeopardy" /></div><span className="hint">Creates the public game route: /{route.replace(/^\/+/, "") || "xxxxxxx"}</span></div>
        <div className="field"><label htmlFor="description">Description</label><textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What players can expect from this minigame…" /></div>
        <div className="field"><label htmlFor="type">Game format</label><select id="type" value={gameType} onChange={(event) => setGameType(event.target.value as MiniGameType)}><option value="JEOPARDY">GGL Jeopardy</option><option value="FAMILY_FEUD">Family Feud</option><option value="CUSTOM">Custom game</option></select></div>
        <div className="field"><label htmlFor="cover">Intro image</label><div className="cover-upload">{cover ? <img src={URL.createObjectURL(cover)} alt="Selected game cover" /> : <span className="hint">Optional cover</span>}<input id="cover" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setCover(event.target.files?.[0] || null)} /></div></div>
        <div className="toolbar"><button className="primary-button" disabled={saving}>{saving ? "Creating…" : "Create game"}</button></div>{feedback ? <p className="feedback">{feedback}</p> : null}
      </form>
      <aside className="panel"><h2 className="panel-title font-display">Your games</h2><p className="hint">Open a game to edit its public info and run its live controls.</p><div className="toolbar">{games.length === 0 ? <span className="hint">No social games created yet.</span> : null}</div>{games.map((game) => <Link key={game.id} className="member-result" href={`/social-media/${game.slug}`}><span className="avatar avatar-fallback">{game.title.slice(0, 2)}</span><span><b>{game.title}</b><br /><small>/{game.slug} · {game.gameType}</small></span></Link>)}</aside>
    </div>
  </div>;
}
