"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CircleHelp, Send, Trophy, X } from "lucide-react";
import {
  getActiveJeopardy,
  getActiveJeopardyPlayer,
  joinJeopardy,
  requestJeopardyQuestion,
  submitJeopardyResponse,
  type JeopardyGame,
} from "@/lib/api/minigame";
import { readNetworkSessionToken } from "@/features/networkSession/storage";
import styles from "./jeopardy.module.css";

function Avatar({ src, name, mystery = false }: { src?: string | null; name: string; mystery?: boolean }) {
  return (
    <span className={`${styles.avatar} ${mystery ? styles.mysteryAvatar : ""}`}>
      {mystery ? <CircleHelp /> : src ? <img src={src} alt="" /> : <strong>{name.slice(0, 2)}</strong>}
    </span>
  );
}

function JeopardyBoard({ game, canPick, onPick }: { game: JeopardyGame; canPick: boolean; onPick: (id: string) => void }) {
  return (
    <div className={styles.board}>
      {game.board?.categories.map((category) => (
        <div className={styles.category} key={category.id}>
          <h2>{category.name}</h2>
          {category.questions.map((question) => (
            <button
              type="button"
              key={question.id}
              disabled={question.used || !canPick}
              onClick={() => onPick(question.id)}
              className={`${question.used ? styles.used : ""} ${question.requested ? styles.requested : ""} ${question.selected ? styles.selected : ""}`}
            >
              {question.used ? "" : question.reward}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function Podium({ game }: { game: JeopardyGame }) {
  const top = [...game.participants].sort((a, b) => b.score - a.score).slice(0, 3);
  const places = [top[1], top[0], top[2]];
  return (
    <div className={styles.finals}>
      <span className={styles.finalLabel}>Final standings</span>
      <h1>Jeopardy podium</h1>
      <div className={styles.podium}>
        {places.map((participant, index) => participant ? (
          <article key={participant.id} className={`${styles.podiumPlace} ${index === 1 ? styles.winner : ""}`}>
            <span>{index === 0 ? 2 : index === 1 ? 1 : 3}</span>
            <Avatar src={participant.member.avatarUrl} name={participant.member.username} />
            <strong>{participant.member.username}</strong>
            <b>{participant.score}</b>
          </article>
        ) : <div key={index} />)}
      </div>
    </div>
  );
}

export default function JeopardyPage() {
  const [game, setGame] = useState<JeopardyGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responseText, setResponseText] = useState("");
  const [sending, setSending] = useState(false);
  const joinAttempted = useRef<string | null>(null);

  const load = useCallback(async () => {
    const token = readNetworkSessionToken();
    try {
      const next = token ? await getActiveJeopardyPlayer(token) : await getActiveJeopardy();
      if (token && next.player?.isParticipant && !next.player.joined && joinAttempted.current !== next.slug) {
        joinAttempted.current = next.slug;
        const joined = await joinJeopardy(token, next.slug);
        setGame(joined);
      } else {
        setGame(next);
      }
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Jeopardy is not available.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 1200);
    return () => window.clearInterval(poll);
  }, [load]);

  useEffect(() => {
    if (game?.phase === "RESPONDING" && game.player?.isTurn) setResponseText(game.player.responseText || "");
  }, [game?.gameState.currentQuestionId, game?.phase]);

  async function pickQuestion(questionId: string) {
    const token = readNetworkSessionToken();
    if (!token || !game) return;
    setSending(true);
    try { setGame(await requestJeopardyQuestion(token, game.slug, questionId)); }
    finally { setSending(false); }
  }

  async function sendResponse() {
    const token = readNetworkSessionToken();
    if (!token || !game) return;
    setSending(true);
    try { setGame(await submitJeopardyResponse(token, game.slug, responseText)); }
    finally { setSending(false); }
  }

  if (loading) return <main className={styles.viewport}><div className={styles.empty}>Loading Jeopardy...</div></main>;
  if (!game || error) return <main className={styles.viewport}><div className={styles.empty}>{error || "No Jeopardy game is active."}</div></main>;

  const playerCanPick = Boolean(game.player?.isTurn && game.phase === "PICKING_QUESTION" && !game.player.requestedQuestionId);
  const currentQuestion = game.gameState.currentQuestion;
  const currentPlayer = game.currentPlayer;

  return (
    <main className={styles.viewport}>
      <section className={`${styles.stage} ${game.player?.isParticipant ? styles.playerStage : ""}`} style={{ backgroundImage: game.coverImageUrl ? `url("${game.coverImageUrl}"), url("/ramattra-login-cropped.webp")` : `url("/ramattra-login-cropped.webp")` }}>
        <div className={styles.stageShade} />

        {game.phase === "CREATED" ? (
          <div className={styles.startingSoon}>
            <span>Goonginga Minigames</span>
            <h1>{game.title}</h1>
            <p>Starting soon</p>
          </div>
        ) : null}

        {game.phase !== "CREATED" && game.phase !== "FINALIZED" ? (
          <JeopardyBoard game={game} canPick={playerCanPick && !sending} onPick={pickQuestion} />
        ) : null}

        {game.phase === "PICKING_MEMBER" ? (
          <div className={styles.phaseOverlay}>
            <div className={styles.pickingMember}>
              <span className={styles.waitDots}><i /><i /><i /></span>
              <Avatar name="Next player" mystery />
              <strong>Selecting the next player</strong>
            </div>
          </div>
        ) : null}

        {game.phase === "RESPONDING" && currentPlayer && currentQuestion ? (
          <div className={styles.phaseOverlay}>
            <article className={styles.questionOverlay}>
              <div className={styles.playerIdentity}>
                <Avatar src={currentPlayer.avatarUrl} name={currentPlayer.username} />
                <div><span>Responding</span><strong>{currentPlayer.username}</strong></div>
              </div>
              <div className={styles.questionMeta}><span>{currentQuestion.categoryName}</span><b>{currentQuestion.reward}</b></div>
              <h1>{currentQuestion.question}</h1>
              {game.player?.isTurn ? (
                <div className={styles.responseInput}>
                  <input value={responseText} onChange={(event) => setResponseText(event.target.value)} placeholder="Type a response (optional)" maxLength={1000} />
                  <button type="button" onClick={sendResponse} disabled={sending} title="Send response"><Send /></button>
                </div>
              ) : null}
            </article>
          </div>
        ) : null}

        {game.phase === "RESPONDED" && currentPlayer ? (
          <div className={styles.phaseOverlay}>
            <article className={`${styles.resultOverlay} ${game.gameState.answerCorrect ? styles.correct : styles.incorrect}`}>
              <Avatar src={currentPlayer.avatarUrl} name={currentPlayer.username} />
              <span>{currentPlayer.username}</span>
              <h1>{game.gameState.responseText || "No response"}</h1>
              <div className={styles.resultMark}>{game.gameState.answerCorrect ? <Check /> : <X />}</div>
            </article>
          </div>
        ) : null}

        {game.phase === "FINALIZED" ? <Podium game={game} /> : null}

        {game.player?.isParticipant ? <div className={styles.playerStatus}><Trophy size={16} /> {game.player.score} points</div> : null}
      </section>
    </main>
  );
}
