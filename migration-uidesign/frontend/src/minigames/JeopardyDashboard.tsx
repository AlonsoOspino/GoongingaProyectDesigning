"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, Gamepad2, Plus, Search, Trash2, Trophy, X } from "lucide-react";
import {
  awardJeopardyQuestion,
  createJeopardy,
  deleteMiniGame,
  finalizeJeopardy,
  getManagedMiniGame,
  listMiniGames,
  searchMiniGameMembers,
  startJeopardy,
  type JeopardyCategory,
  type JeopardyGame,
  type MiniGameMember,
} from "@/lib/api/minigame";
import { readNetworkSessionToken } from "@/features/networkSession/storage";
import styles from "./jeopardy-dashboard.module.css";

const QUESTION_TEMPLATE = `CATEGORY: Overwatch
100 | Question text | Answer
200 | Question text | Answer

CATEGORY: Goonginga
100 | Question text | Answer
200 | Question text | Answer`;

function parseQuestions(value: string): JeopardyCategory[] {
  const categories: JeopardyCategory[] = [];
  let current: JeopardyCategory | null = null;
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^category\s*:/i.test(line)) {
      const name = line.replace(/^category\s*:/i, "").trim();
      current = { id: `category-${categories.length + 1}`, name, questions: [] };
      if (name) categories.push(current);
      continue;
    }
    if (!current) continue;
    const [rewardRaw, question, ...answerParts] = line.split("|").map((part) => part.trim());
    const reward = Number(rewardRaw);
    const answer = answerParts.join(" | ").trim();
    if (reward > 0 && question && answer) {
      current.questions.push({ id: `question-${categories.length}-${current.questions.length + 1}`, reward, question, answer });
    }
  }
  return categories.filter((category) => category.questions.length).slice(0, 5);
}

function Avatar({ member }: { member: MiniGameMember }) {
  return member.avatarUrl
    ? <img className={styles.avatar} src={member.avatarUrl} alt="" />
    : <span className={styles.avatar}>{member.username.slice(0, 2)}</span>;
}

function QuestionResult({ game, memberId, unanswered, scoreDelta }: { game: JeopardyGame; memberId: number | null; unanswered: boolean; scoreDelta: number }) {
  if (unanswered) return <X />;
  const participant = game.participants.find((item) => item.memberId === memberId);
  return participant ? <span className={styles.recordedResult}><Avatar member={participant.member} /><b>{scoreDelta > 0 ? "+" : ""}{scoreDelta}</b></span> : <X />;
}

export function JeopardyDashboard() {
  const [screen, setScreen] = useState<"list" | "create" | "manage">("list");
  const [games, setGames] = useState<JeopardyGame[]>([]);
  const [game, setGame] = useState<JeopardyGame | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [questionText, setQuestionText] = useState(QUESTION_TEMPLATE);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<MiniGameMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<MiniGameMember[]>([]);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);

  const loadGames = useCallback(async () => {
    try { setGames(await listMiniGames()); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not load Minigames."); }
    finally { setLoading(false); }
  }, []);

  const loadGame = useCallback(async (slug: string) => {
    const token = readNetworkSessionToken();
    if (!token) return;
    setGame(await getManagedMiniGame(token, slug));
  }, []);

  useEffect(() => { void loadGames(); }, [loadGames]);
  useEffect(() => {
    if (screen !== "create") return;
    const token = readNetworkSessionToken();
    if (!token) return;
    const timeout = window.setTimeout(() => void searchMiniGameMembers(token, memberSearch).then(setMemberResults), 200);
    return () => window.clearTimeout(timeout);
  }, [screen, memberSearch]);

  const selectedQuestion = useMemo(() => game?.config?.categories
    .flatMap((category) => category.questions.map((question) => ({ ...question, categoryName: category.name })))
    .find((question) => question.id === selectedQuestionId) || null, [game, selectedQuestionId]);

  async function openGame(slug: string) {
    setMessage("");
    setScreen("manage");
    await loadGame(slug);
  }

  async function run(action: () => Promise<JeopardyGame>) {
    setBusy(true);
    setMessage("");
    try { setGame(await action()); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Jeopardy action failed."); }
    finally { setBusy(false); }
  }

  async function saveResult(memberId: number | null, result: "ADD" | "SUBTRACT" | "NO_ANSWER") {
    const token = readNetworkSessionToken();
    if (!token || !game || !selectedQuestionId) return;
    await run(() => awardJeopardyQuestion(token, game.slug, selectedQuestionId, memberId, result));
    setSelectedQuestionId(null);
  }

  async function createGame() {
    const token = readNetworkSessionToken();
    if (!token) return;
    const categories = parseQuestions(questionText);
    if (!title.trim() || !categories.length || !selectedMembers.length) {
      setMessage("Add a title, valid questions, and at least one participant.");
      return;
    }
    setBusy(true);
    try {
      const created = await createJeopardy(token, {
        title: title.trim(), description: description.trim(), coverImageUrl: coverImageUrl.trim() || undefined,
        participantIds: selectedMembers.map((member) => member.id), config: { categories },
      });
      setGame(created);
      setScreen("manage");
      await loadGames();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create Jeopardy."); }
    finally { setBusy(false); }
  }

  async function removeGame(slug: string) {
    if (deleteSlug !== slug) {
      setDeleteSlug(slug);
      setMessage("Click Delete again to confirm.");
      return;
    }
    const token = readNetworkSessionToken();
    if (!token) return;
    setBusy(true);
    setMessage("");
    try {
      await deleteMiniGame(token, slug);
      setGames((current) => current.filter((item) => item.slug !== slug));
      setDeleteSlug(null);
      setMessage("Jeopardy game deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete this Jeopardy game.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className={styles.loading}>Loading Minigames...</div>;

  if (screen === "list") return (
    <section className={styles.dashboard}>
      <header className={styles.heading}><div><span>Minigames</span><h2>Available games</h2></div><button onClick={() => setScreen("create")}><Plus size={17} /> Create Jeopardy</button></header>
      {message ? <p className={styles.message}>{message}</p> : null}
      <div className={styles.gameGrid}>
        {games.filter((item) => item.gameType === "JEOPARDY").map((item) => <article className={styles.gameItem} key={item.id}><button className={styles.gameCard} onClick={() => void openGame(item.slug)}><Gamepad2 /><span><small>{item.phase.replace(/_/g," ")}</small><strong>{item.title}</strong><b>{item.participants.length} players</b></span></button><button className={`${styles.deleteGame} ${deleteSlug===item.slug?styles.deleteConfirm:""}`} disabled={busy} onClick={()=>void removeGame(item.slug)} title={deleteSlug===item.slug?"Confirm deletion":"Delete Jeopardy"}><Trash2 size={16}/>{deleteSlug===item.slug?"Confirm":"Delete"}</button></article>)}
        <Link className={styles.gameCard} href="/minigames?view=manager"><Gamepad2 /><span><small>Available</small><strong>Family Feud</strong><b>Open manager</b></span></Link>
      </div>
    </section>
  );

  if (screen === "create") return (
    <section className={styles.dashboard}>
      <button className={styles.back} onClick={() => setScreen("list")}><ArrowLeft size={17} /> All Minigames</button>
      <div className={styles.createTitle}><span>New Minigame</span><h2>Create Jeopardy</h2></div>
      <div className={styles.createGrid}>
        <div className={styles.form}>
          <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Description<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label>Background image URL<input value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} /></label>
          <label>Questions<textarea className={styles.questionInput} value={questionText} onChange={(event) => setQuestionText(event.target.value)} spellCheck={false} /></label>
          <p>Format: `CATEGORY: Name`, then `100 | Question | Answer`.</p>
        </div>
        <div className={styles.members}>
          <h3>Participants</h3>
          <div className={styles.search}><Search size={17} /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search Network Members" /></div>
          <div className={styles.memberResults}>{memberResults.map((member) => { const selected=selectedMembers.some((item)=>item.id===member.id); return <button className={selected?styles.memberSelected:""} key={member.id} onClick={() => setSelectedMembers((current)=>selected?current.filter((item)=>item.id!==member.id):[...current,member])}><Avatar member={member}/><span>{member.username}</span>{selected?<Check size={16}/>:<Plus size={16}/>}</button>; })}</div>
          <div className={styles.chips}>{selectedMembers.map((member)=><button key={member.id} onClick={()=>setSelectedMembers((current)=>current.filter((item)=>item.id!==member.id))}><Avatar member={member}/>{member.username}<X size={13}/></button>)}</div>
        </div>
      </div>
      {message ? <p className={styles.message}>{message}</p> : null}
      <footer className={styles.createFooter}><button disabled={busy} onClick={() => void createGame()}><Plus size={17}/>{busy?"Creating...":"Create Jeopardy"}</button></footer>
    </section>
  );

  if (!game) return null;
  const token = readNetworkSessionToken();
  if (!token) return null;
  const answered = game.gameState.questionResults.length;
  const total = game.config?.categories.reduce((sum, category) => sum + category.questions.length, 0) || 0;

  return (
    <section className={styles.dashboard}>
      <header className={styles.manageHeader}>
        <button className={styles.back} onClick={() => { setScreen("list"); void loadGames(); }}><ArrowLeft size={17}/> All Minigames</button>
        <div><span>{game.phase.replace(/_/g," ")}</span><h2>{game.title}</h2><p>{answered} / {total} questions recorded</p></div>
        <nav><Link href="/minigames/jeopardy-overview" target="_blank">Score overlay <ExternalLink size={15}/></Link><Link href="/minigames/jeopardy" target="_blank">Podium overlay <ExternalLink size={15}/></Link></nav>
      </header>
      {message ? <p className={styles.message}>{message}</p> : null}

      {game.phase === "CREATED" ? <div className={styles.ready}><Gamepad2 size={36}/><h3>Board ready</h3><p>Starting the game opens the private board. Nothing from this screen is sent to OBS.</p><button disabled={busy} onClick={()=>void run(()=>startJeopardy(token,game.slug))}>Start Jeopardy</button></div> : null}

      {game.phase === "PICKING_QUESTION" ? <>
        <div className={styles.board}>
          {game.board?.categories.map((category)=><div key={category.id}><h3>{category.name}</h3>{category.questions.map((question)=><button key={question.id} disabled={question.used||busy} className={question.used?styles.used:""} onClick={()=>setSelectedQuestionId(question.id)}>{question.used?<QuestionResult game={game} memberId={question.answeredMemberId} unanswered={question.unanswered} scoreDelta={question.scoreDelta}/>:question.reward}</button>)}</div>)}
        </div>
        <div className={styles.boardFooter}><span>Select a question, then assign the points.</span><button disabled={!answered||busy} onClick={()=>void run(()=>finalizeJeopardy(token,game.slug))}><Trophy size={16}/> Finalize and reveal podium</button></div>
      </> : null}

      {game.phase === "FINALIZED" ? <div className={styles.finalized}><Trophy size={42}/><h3>Podium ready</h3><p>The final standings are now available on the stream output.</p><Link href="/minigames/jeopardy" target="_blank">Open podium <ExternalLink size={16}/></Link></div> : null}

      {selectedQuestion ? <div className={styles.resultDialog} role="dialog" aria-modal="true"><div className={styles.dialogPanel}><button className={styles.close} onClick={()=>setSelectedQuestionId(null)} aria-label="Close"><X/></button><span>{selectedQuestion.categoryName} / {selectedQuestion.reward}</span><h3>{selectedQuestion.question}</h3><p className={styles.answer}>Answer: <strong>{selectedQuestion.answer}</strong></p><h4>Assign the result</h4><div className={styles.awardList}>{game.participants.map((participant)=><div className={styles.awardRow} key={participant.id}><Avatar member={participant.member}/><span>{participant.member.username}<small>{participant.score} points</small></span><div className={styles.scoreActions}><button disabled={busy} className={styles.addScore} onClick={()=>void saveResult(participant.memberId,"ADD")} aria-label={`Add ${selectedQuestion.reward} points to ${participant.member.username}`}>+{selectedQuestion.reward}</button><button disabled={busy} className={styles.subtractScore} onClick={()=>void saveResult(participant.memberId,"SUBTRACT")} aria-label={`Subtract ${selectedQuestion.reward} points from ${participant.member.username}`}>-{selectedQuestion.reward}</button></div></div>)}</div><button disabled={busy} className={styles.noAnswer} onClick={()=>void saveResult(null,"NO_ANSWER")}><X size={18}/> No one answered</button></div></div> : null}
    </section>
  );
}
