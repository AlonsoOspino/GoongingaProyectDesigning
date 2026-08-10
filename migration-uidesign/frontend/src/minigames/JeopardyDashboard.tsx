"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, Gamepad2, Plus, Search, Trophy, UserRound, X } from "lucide-react";
import {
  advanceJeopardy,
  createJeopardy,
  finalizeJeopardy,
  getManagedMiniGame,
  listMiniGames,
  pickJeopardyMember,
  resolveJeopardyQuestion,
  searchMiniGameMembers,
  selectJeopardyQuestion,
  startJeopardy,
  type JeopardyCategory,
  type JeopardyGame,
  type MiniGameMember,
} from "@/lib/api/minigame";
import { readNetworkSessionToken } from "@/features/networkSession/storage";
import styles from "./jeopardy-dashboard.module.css";

const QUESTION_TEMPLATE = `CATEGORY: Overwatch
100 | Which hero says this voice line? | Answer
200 | Question text | Answer

CATEGORY: Goonginga
100 | Question text | Answer
200 | Question text | Answer`;

function parseQuestionText(value: string): JeopardyCategory[] {
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
    const [rewardRaw, questionRaw, ...answerParts] = line.split("|").map((part) => part.trim());
    const reward = Number(rewardRaw);
    const answer = answerParts.join(" | ").trim();
    if (!Number.isFinite(reward) || reward <= 0 || !questionRaw || !answer) continue;
    current.questions.push({ id: `question-${categories.length}-${current.questions.length + 1}`, reward, question: questionRaw, answer });
  }
  return categories.filter((category) => category.questions.length > 0).slice(0, 5);
}

function MemberAvatar({ member }: { member: MiniGameMember }) {
  return member.avatarUrl
    ? <img src={member.avatarUrl} alt="" className={styles.memberAvatar} />
    : <span className={styles.memberAvatar}>{member.username.slice(0, 2)}</span>;
}

export function JeopardyDashboard() {
  const [screen, setScreen] = useState<"list" | "create" | "manage">("list");
  const [games, setGames] = useState<JeopardyGame[]>([]);
  const [game, setGame] = useState<JeopardyGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [questionText, setQuestionText] = useState(QUESTION_TEMPLATE);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<MiniGameMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<MiniGameMember[]>([]);
  const [managerResponse, setManagerResponse] = useState("");
  const responseDirty = useRef(false);
  const activeQuestionRef = useRef<string | null>(null);

  const loadGames = useCallback(async () => {
    try { setGames(await listMiniGames()); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not load Minigames."); }
    finally { setLoading(false); }
  }, []);

  const loadGame = useCallback(async (slug: string, silent = false) => {
    const token = readNetworkSessionToken();
    if (!token) return;
    try {
      const next = await getManagedMiniGame(token, slug);
      setGame(next);
      if (activeQuestionRef.current !== next.gameState.currentQuestionId) {
        activeQuestionRef.current = next.gameState.currentQuestionId;
        responseDirty.current = false;
        setManagerResponse(next.state?.responseText || "");
      } else if (!responseDirty.current && next.state?.responseText !== undefined) {
        setManagerResponse(next.state.responseText);
      }
    } catch (error) {
      if (!silent) setMessage(error instanceof Error ? error.message : "Could not load Jeopardy.");
    }
  }, []);

  useEffect(() => { void loadGames(); }, [loadGames]);

  useEffect(() => {
    if (screen !== "manage" || !game?.slug) return;
    const poll = window.setInterval(() => void loadGame(game.slug, true), 1200);
    return () => window.clearInterval(poll);
  }, [screen, game?.slug, loadGame]);

  useEffect(() => {
    if (screen !== "create") return;
    const token = readNetworkSessionToken();
    if (!token) return;
    const timeout = window.setTimeout(() => {
      void searchMiniGameMembers(token, memberSearch).then(setMemberResults).catch(() => setMemberResults([]));
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [memberSearch, screen]);

  async function openGame(slug: string) {
    setScreen("manage");
    setMessage("");
    await loadGame(slug);
  }

  async function createGame() {
    const token = readNetworkSessionToken();
    if (!token) return;
    const categories = parseQuestionText(questionText);
    if (!title.trim() || !categories.length || !selectedMembers.length) {
      setMessage("Add a title, at least one valid category, and at least one participant.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const created = await createJeopardy(token, {
        title: title.trim(),
        description: description.trim(),
        coverImageUrl: coverImageUrl.trim() || undefined,
        participantIds: selectedMembers.map((member) => member.id),
        config: { categories },
      });
      setGame(created);
      setScreen("manage");
      await loadGames();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create Jeopardy.");
    } finally { setBusy(false); }
  }

  async function run(action: () => Promise<JeopardyGame>) {
    setBusy(true);
    setMessage("");
    try { setGame(await action()); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Jeopardy action failed."); }
    finally { setBusy(false); }
  }

  const token = readNetworkSessionToken();

  if (loading) return <div className={styles.loading}>Loading Minigames...</div>;

  if (screen === "list") {
    return (
      <section className={styles.dashboard}>
        <div className={styles.headingRow}>
          <div><span>Minigames</span><h2>Available games</h2><p>Select a game to open its control room.</p></div>
          <button type="button" onClick={() => setScreen("create")}><Plus size={17} /> Create Jeopardy</button>
        </div>
        {message ? <p className={styles.message}>{message}</p> : null}
        <div className={styles.gameGrid}>
          {games.map((item) => item.gameType === "JEOPARDY" ? (
            <button type="button" key={item.id} className={styles.gameCard} onClick={() => void openGame(item.slug)}>
              <span className={styles.gameCover} style={item.coverImageUrl ? { backgroundImage: `url("${item.coverImageUrl}")` } : undefined}><Gamepad2 /></span>
              <span><small>{item.phase.replace(/_/g, " ")}</small><strong>{item.title}</strong><b>{item.participants.length} players</b></span>
            </button>
          ) : (
            <Link href="/minigames?view=manager" key={item.id} className={styles.gameCard}>
              <span className={styles.gameCover}><Gamepad2 /></span>
              <span><small>{item.status.replace(/_/g, " ")}</small><strong>{item.title}</strong><b>Open manager</b></span>
            </Link>
          ))}
          {!games.some((item) => item.gameType === "FAMILY_FEUD") ? (
            <Link href="/minigames?view=manager" className={styles.gameCard}>
              <span className={styles.gameCover}><UserRound /></span>
              <span><small>Available</small><strong>Family Feud</strong><b>Open manager</b></span>
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  if (screen === "create") {
    return (
      <section className={styles.dashboard}>
        <button type="button" className={styles.backButton} onClick={() => setScreen("list")}><ArrowLeft size={17} /> All Minigames</button>
        <div className={styles.createHeading}><span>New Minigame</span><h2>Create Jeopardy</h2></div>
        <div className={styles.createLayout}>
          <div className={styles.formColumn}>
            <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Season 9 Jeopardy" /></label>
            <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Optional description" /></label>
            <label>Background image URL<input value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} placeholder="Used by the announcement and OBS output" /></label>
            <label>Categories and questions<textarea className={styles.questionEditor} value={questionText} onChange={(event) => setQuestionText(event.target.value)} spellCheck={false} /></label>
            <p className={styles.formatHelp}>Use `CATEGORY: Name`, then one line per question: `100 | Question | Answer`.</p>
          </div>
          <div className={styles.memberPicker}>
            <h3>Participants</h3>
            <div className={styles.searchBox}><Search size={17} /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search Network Members" /></div>
            <div className={styles.searchResults}>
              {memberResults.map((member) => {
                const selected = selectedMembers.some((item) => item.id === member.id);
                return <button type="button" key={member.id} onClick={() => setSelectedMembers((current) => selected ? current.filter((item) => item.id !== member.id) : [...current, member])} className={selected ? styles.memberSelected : ""}><MemberAvatar member={member} /><span>{member.username}</span>{selected ? <Check size={17} /> : <Plus size={17} />}</button>;
              })}
            </div>
            <div className={styles.selectedMembers}>
              {selectedMembers.map((member) => <button type="button" key={member.id} onClick={() => setSelectedMembers((current) => current.filter((item) => item.id !== member.id))}><MemberAvatar member={member} /> {member.username}<X size={14} /></button>)}
            </div>
          </div>
        </div>
        {message ? <p className={styles.message}>{message}</p> : null}
        <div className={styles.createFooter}><button type="button" disabled={busy} onClick={() => void createGame()}><Plus size={17} /> {busy ? "Creating..." : "Create Minigame"}</button></div>
      </section>
    );
  }

  if (!game || !token) return null;

  return (
    <section className={styles.dashboard}>
      <div className={styles.manageHeader}>
        <button type="button" className={styles.backButton} onClick={() => { setScreen("list"); void loadGames(); }}><ArrowLeft size={17} /> All Minigames</button>
        <div><span>{game.phase.replace(/_/g, " ")}</span><h2>{game.title}</h2></div>
        <Link href="/minigames/jeopardy" target="_blank">OBS / Player view <ExternalLink size={16} /></Link>
      </div>
      {message ? <p className={styles.message}>{message}</p> : null}

      {game.phase === "CREATED" ? (
        <div className={styles.phasePanel}>
          <Gamepad2 size={34} /><h3>Jeopardy is ready</h3><p>The public output is showing Starting Soon. Start when the roster and board are confirmed.</p>
          <button type="button" disabled={busy} onClick={() => void run(() => startJeopardy(token, game.slug))}>Start Jeopardy</button>
        </div>
      ) : null}

      {game.phase === "PICKING_MEMBER" ? (
        <div className={styles.managerLayout}>
          <div><span className={styles.stepLabel}>Pick a member</span><h3>Who answers next?</h3><p>The selected member will receive control of the board.</p></div>
          <div className={styles.rosterList}>
            {game.participants.map((participant) => <button type="button" key={participant.id} disabled={busy} onClick={() => void run(() => pickJeopardyMember(token, game.slug, participant.memberId))}><MemberAvatar member={participant.member} /><span><strong>{participant.member.username}</strong><small>{participant.joinedAt ? "Joined" : "Not connected"}</small></span><b>{participant.score}</b></button>)}
          </div>
          <button type="button" className={styles.finalizeButton} onClick={() => void run(() => finalizeJeopardy(token, game.slug))}>Finalize game</button>
        </div>
      ) : null}

      {game.phase === "PICKING_QUESTION" ? (
        <div className={styles.boardManager}>
          <div className={styles.selectedPlayer}><MemberAvatar member={game.currentPlayer!} /><span><small>Picking a question</small><strong>{game.currentPlayer?.username}</strong></span></div>
          <div className={styles.managerBoard}>
            {game.board?.categories.map((category) => <div key={category.id}><h3>{category.name}</h3>{category.questions.map((question) => <button type="button" key={question.id} disabled={busy || question.used || !question.requested} className={question.requested ? styles.requestedQuestion : ""} onClick={() => void run(() => selectJeopardyQuestion(token, game.slug, question.id))}>{question.used ? "Used" : question.reward}</button>)}</div>)}
          </div>
          <p className={styles.managerHint}>{game.gameState.requestedQuestionId ? "The player selection is underlined. Click it to open the question." : "Waiting for the player to choose a value."}</p>
        </div>
      ) : null}

      {game.phase === "RESPONDING" && game.currentQuestion ? (
        <div className={styles.responseManager}>
          <div className={styles.selectedPlayer}><MemberAvatar member={game.currentPlayer!} /><span><small>Responding</small><strong>{game.currentPlayer?.username}</strong></span></div>
          <span className={styles.stepLabel}>{game.currentQuestion.categoryName} / {game.currentQuestion.reward}</span>
          <h3>{game.currentQuestion.question}</h3>
          <div className={styles.answerKey}><small>Answer key</small><strong>{game.currentQuestion.answer}</strong></div>
          <label>Player response<input value={managerResponse} onChange={(event) => { responseDirty.current = true; setManagerResponse(event.target.value); }} placeholder="Player or manager response" /></label>
          <div className={styles.resolveActions}>
            <button type="button" disabled={busy} className={styles.incorrectButton} onClick={() => void run(() => resolveJeopardyQuestion(token, game.slug, managerResponse, false))}><X size={18} /> Incorrect</button>
            <button type="button" disabled={busy} className={styles.correctButton} onClick={() => void run(() => resolveJeopardyQuestion(token, game.slug, managerResponse, true))}><Check size={18} /> Correct</button>
          </div>
        </div>
      ) : null}

      {game.phase === "RESPONDED" ? (
        <div className={styles.phasePanel}>
          {game.gameState.answerCorrect ? <Check size={42} className={styles.good} /> : <X size={42} className={styles.bad} />}
          <h3>{game.gameState.responseText || "No response"}</h3>
          <p>{game.currentPlayer?.username} now has {game.participants.find((participant) => participant.memberId === game.currentPlayer?.id)?.score || 0} points.</p>
          <div className={styles.phaseActions}><button type="button" disabled={busy} onClick={() => void run(() => advanceJeopardy(token, game.slug))}>Pick next member</button><button type="button" className={styles.finalizeButton} onClick={() => void run(() => finalizeJeopardy(token, game.slug))}>Finalize game</button></div>
        </div>
      ) : null}

      {game.phase === "FINALIZED" ? (
        <div className={styles.finalManager}>
          <Trophy size={38} /><h3>Final standings</h3>
          {[...game.participants].sort((a,b) => b.score-a.score).map((participant,index) => <div key={participant.id}><span>#{index+1}</span><MemberAvatar member={participant.member} /><strong>{participant.member.username}</strong><b>{participant.score}</b></div>)}
        </div>
      ) : null}
    </section>
  );
}
