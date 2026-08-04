"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  findMembers, getManagedGame, newJeopardyQuestion, resolveQuestion, saveGame, selectQuestion, setTurn, uploadCover,
  type JeopardyCategory, type ManagedMiniGame, type MiniGameMember,
} from "@/lib/minigames";
import { hasNetworkRole, useNetworkSession } from "@/lib/networkSession";

function parseQuestionBlocks(value: string) {
  const parsed: Array<{ question: string; answer: string; reward: number }> = [];
  const rejected: string[] = [];
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^#(.+?)\s*!([\s\S]+?)\s*\$([0-9]+)\s*$/);
    if (!match) { rejected.push(line); continue; }
    parsed.push({ question: match[1].trim(), answer: match[2].trim(), reward: Number(match[3]) });
  }
  return { parsed, rejected };
}

function activeQuestion(game: ManagedMiniGame) {
  const activeId = game.state.currentQuestionId;
  if (!activeId) return null;
  for (const category of game.config.categories) {
    const question = category.questions.find((item) => item.id === activeId);
    if (question) return { ...question, categoryName: category.name };
  }
  return null;
}

function ProfileAvatar({ member }: { member: MiniGameMember }) {
  return member.avatarUrl ? <img className="avatar" src={member.avatarUrl} alt="" /> : <span className="avatar avatar-fallback">{member.username.slice(0, 2)}</span>;
}

export default function GameSocialMediaDashboard() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const { user, token } = useNetworkSession();
  const permitted = hasNetworkRole(user, "SOCIAL_MEDIA", "ADMIN");
  const [game, setGame] = useState<ManagedMiniGame | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [questionInput, setQuestionInput] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [members, setMembers] = useState<MiniGameMember[]>([]);

  useEffect(() => {
    if (!permitted || !token || !slug) return;
    void getManagedGame(slug, token).then((loaded) => {
      setGame(loaded); setCategoryId(loaded.config.categories[0]?.id || "");
    }).catch((reason) => setFeedback(reason instanceof Error ? reason.message : "Could not load this game."));
  }, [permitted, slug, token]);

  useEffect(() => {
    if (!token || !permitted || memberSearch.trim().length < 2) { setMembers([]); return; }
    const timer = window.setTimeout(() => { void findMembers(memberSearch, token).then(setMembers).catch(() => setMembers([])); }, 250);
    return () => window.clearTimeout(timer);
  }, [memberSearch, permitted, token]);

  const currentQuestion = useMemo(() => game ? activeQuestion(game) : null, [game]);

  function replaceCategory(updated: JeopardyCategory) {
    setGame((current) => current ? { ...current, config: { categories: current.config.categories.map((category) => category.id === updated.id ? updated : category) } } : current);
  }

  async function saveDetails() {
    if (!game || !token) return;
    setSaving(true); setFeedback(null);
    try {
      const updated = await saveGame(game.slug, { title: game.title, slug: game.slug, description: game.description, coverImageUrl: game.coverImageUrl, config: game.config }, token);
      setGame(updated);
      if (updated.slug !== slug) router.replace(`/social-media/${updated.slug}`);
      setFeedback("Saved.");
    } catch (reason) { setFeedback(reason instanceof Error ? reason.message : "Could not save game."); }
    finally { setSaving(false); }
  }

  async function handleCover(file?: File) {
    if (!game || !token || !file) return;
    setSaving(true); setFeedback(null);
    try { setGame((await uploadCover(game.slug, file, token)).game); setFeedback("Cover image uploaded."); }
    catch (reason) { setFeedback(reason instanceof Error ? reason.message : "Could not upload image."); }
    finally { setSaving(false); }
  }

  function addImportedQuestions() {
    if (!game) return;
    const category = game.config.categories.find((item) => item.id === categoryId);
    if (!category) return;
    const { parsed, rejected } = parseQuestionBlocks(questionInput);
    const remaining = Math.max(0, 5 - category.questions.length);
    const accepted = parsed.slice(0, remaining).map((item) => newJeopardyQuestion(item.question, item.answer, item.reward));
    if (!accepted.length) { setFeedback(rejected.length ? "No valid lines found. Use #question !answer $reward." : "This category already has five questions."); return; }
    replaceCategory({ ...category, questions: [...category.questions, ...accepted] });
    setQuestionInput("");
    setFeedback(`${accepted.length} question${accepted.length === 1 ? "" : "s"} added. Save the board to publish it.${rejected.length ? ` ${rejected.length} line(s) were skipped.` : ""}`);
  }

  async function chooseTurn(member: MiniGameMember) {
    if (!game || !token) return;
    try { setGame(await setTurn(game.slug, member.id, token)); setMemberSearch(""); setMembers([]); setFeedback(`${member.username} is now on turn.`); }
    catch (reason) { setFeedback(reason instanceof Error ? reason.message : "Could not change turn."); }
  }

  async function chooseQuestion(questionId: string) {
    if (!game || !token) return;
    try { setGame(await selectQuestion(game.slug, questionId, token)); setFeedback("Question sent to the player."); }
    catch (reason) { setFeedback(reason instanceof Error ? reason.message : "Could not select question."); }
  }

  async function questionAction(action: "reveal" | "complete") {
    if (!game || !token) return;
    try { setGame(await resolveQuestion(game.slug, action, token)); setFeedback(action === "reveal" ? "Answer revealed to the manager." : "Question marked as used."); }
    catch (reason) { setFeedback(reason instanceof Error ? reason.message : "Could not update question."); }
  }

  if (!user) return <section className="staff-only"><p className="eyebrow">Social Media Dashboard</p><h1 className="font-display">Sign in first</h1><p>Use your Network Users Discord account to manage this game.</p><Link className="primary-button" href="/login">Sign in</Link></section>;
  if (!permitted) return <section className="staff-only"><p className="eyebrow">Social Media Dashboard</p><h1 className="font-display">Role required</h1><p>Only Network Users with the Social Media role can run a Minigame.</p></section>;
  if (!game) return <section className="staff-only"><p className="eyebrow">Social Media Dashboard</p><h1 className="font-display">Loading game…</h1><p>{feedback || "Preparing controls."}</p></section>;

  return <div className="page-shell">
    <div className="manager-head"><div><p className="eyebrow">Social Media Dashboard · /{game.slug}</p><h1 className="font-display">{game.title}</h1></div><div className="toolbar"><Link className="secondary-button" href={`/${game.slug}`}>Player view</Link><Link className="secondary-button" href={`/${game.slug}/stream`} target="_blank">Open stream</Link></div></div>
    <div className="dashboard-grid">
      <section className="panel">
        <h2 className="panel-title font-display">Public card</h2>
        <div className="field"><label htmlFor="edit-title">Title</label><input id="edit-title" value={game.title} onChange={(event) => setGame({ ...game, title: event.target.value })} /></div>
        <div className="field"><label htmlFor="edit-route">Route</label><div className="route-field"><span>/</span><input id="edit-route" value={game.slug} onChange={(event) => setGame({ ...game, slug: event.target.value.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase() })} /></div></div>
        <div className="field"><label htmlFor="edit-description">Description</label><textarea id="edit-description" value={game.description} onChange={(event) => setGame({ ...game, description: event.target.value })} /></div>
        <div className="field"><label htmlFor="edit-cover">Intro image</label><div className="cover-upload">{game.coverImageUrl ? <img src={game.coverImageUrl} alt="Current game cover" /> : <span className="hint">No cover yet</span>}<input id="edit-cover" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => void handleCover(event.target.files?.[0])} /></div></div>
        <div className="toolbar"><button className="primary-button" onClick={() => void saveDetails()} disabled={saving}>{saving ? "Saving…" : "Save details & board"}</button></div>
      </section>
      <section className="panel">
        <h2 className="panel-title font-display">Live turn</h2>
        <p className="hint">Pick a Network User. Only they can request a question from their player screen.</p>
        {game.currentPlayer ? <div className="turn-banner"><ProfileAvatar member={game.currentPlayer} /><span><b>{game.currentPlayer.username}</b><br /><small>Current player</small></span></div> : <p className="hint">No player has the turn yet.</p>}
        <div className="field turn-search"><label htmlFor="member-search">Find Network User</label><input id="member-search" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search by Discord name" />{members.length ? <div className="search-results">{members.map((member) => <button className="member-result" key={member.id} onClick={() => void chooseTurn(member)}><ProfileAvatar member={member} /><span>{member.username}</span></button>)}</div> : null}</div>
      </section>
    </div>

    {game.gameType === "JEOPARDY" ? <>
      <section className="panel" style={{ marginTop: 22 }}>
        <h2 className="panel-title font-display">GGL Jeopardy board</h2>
        <p className="hint">The board follows the original GGL Jeopardy palette: deep blue, black cells, white category labels, and yellow rewards.</p>
        <div className="categories">{game.config.categories.map((category) => <div className="category-column" key={category.id}><input aria-label="Category name" value={category.name} onChange={(event) => replaceCategory({ ...category, name: event.target.value })} />{category.questions.length ? category.questions.map((question) => <div className="question-mini" key={question.id}><b>${question.reward}</b>{question.question}<br /><em>! {question.answer}</em></div>) : <span className="hint">No questions.</span>}</div>)}</div>
        <div className="dashboard-grid" style={{ marginTop: 22 }}>
          <div><div className="field"><label htmlFor="question-category">Add to category</label><select id="question-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{game.config.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div className="field"><label htmlFor="question-import">Questions in the exact import format</label><textarea className="question-import" id="question-import" value={questionInput} onChange={(event) => setQuestionInput(event.target.value)} placeholder={"#I'm putting a rock in this one! !Who is Mei $100\n#Get ready for a shock! !Who is Sombra $300"} /></div><button className="secondary-button" onClick={addImportedQuestions}>Add formatted questions</button></div>
          <div><p className="eyebrow">Format</p><p className="hint"><b>#question</b> <b>!answer</b> <b>$reward</b></p><p className="hint">One question per line. The parser keeps the answer private from player and stream views. A category supports up to five questions, matching the Jeopardy board.</p></div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 22 }}>
        <h2 className="panel-title font-display">Manager selection</h2>
        <p className="hint">A requested cell glows pink. You can honor it or select any other available question.</p>
        <div className="manager-board">{game.board?.categories.map((category) => <div key={category.id}><div className="board-category">{category.name}</div>{category.questions.map((question) => <button key={question.id} disabled={question.used} className={`board-cell ${question.requested ? "requested" : ""} ${question.selected ? "selected" : ""}`} onClick={() => void chooseQuestion(question.id)}>${question.reward}</button>)}</div>)}</div>
        {currentQuestion ? <div className="active-question"><p className="eyebrow">Selected · {currentQuestion.categoryName} · ${currentQuestion.reward}</p><h3>{currentQuestion.question}</h3>{game.state.revealed ? <p className="answer"><b>Answer:</b> {currentQuestion.answer}</p> : <p className="hint">Answer stays hidden until you reveal it.</p>}<div className="toolbar"><button className="secondary-button" onClick={() => void questionAction("reveal")}>Reveal answer</button><button className="primary-button" onClick={() => void questionAction("complete")}>Mark question used</button></div></div> : null}
      </section>
    </> : <section className="panel" style={{ marginTop: 22 }}><h2 className="panel-title font-display">Game ready</h2><p className="hint">This format has its public card and routes. The live manager board is currently implemented for Jeopardy.</p></section>}
    {feedback ? <p className="feedback">{feedback}</p> : null}
  </div>;
}
