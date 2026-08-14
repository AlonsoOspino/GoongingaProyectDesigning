"use client";

import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useFeudGame } from "@/lib/familyFeud/useFeudGame";
import { AnswerBoard, ConnectionPill, ErrorState, FeudLogo, LoadingState, PhaseName, ScoreStrip, Strikes, Timer } from "./Shared";
import styles from "./network-feud.module.css";

export function PlayerPage() {
  const params = useParams<{ gameId: string }>();
  const code = String(params.gameId || "").toUpperCase();
  const { data, error, loading, connected, action } = useFeudGame(code, "player");
  const [answer, setAnswer] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (name: string, payload: Record<string, unknown> = {}) => {
    setBusy(true); setMessage(null);
    try { await action(name, payload); return true; }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "The action could not be completed."); return false; }
    finally { setBusy(false); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await run("SUBMIT_ANSWER", { text: answer })) setAnswer("");
  };

  if (loading && !data) return <LoadingState />;
  if (!data) return <ErrorState message={error || "This match is unavailable."} />;
  const phase = data.game.phase;
  const faceOff = data.round?.faceOff;
  const canChoose = phase === "PLAY_PASS" && data.me?.side === faceOff?.familyWinnerSide;
  const canAnswer = Boolean(data.me?.isCurrentPlayer && !data.round?.answerPending && ["FACE_OFF_FIRST_ANSWER", "FACE_OFF_SECOND_ANSWER", "ROUND_PLAY", "STEAL", "FAST_MONEY"].includes(phase));
  const activeTeam = data.teams.find((team) => team.side === data.round?.activeSide);

  return <div className={styles.shell}>
    <div className={`${styles.container} ${styles.wide}`}>
      <div className={styles.topline}><FeudLogo /><div className={styles.buttonRow}><span className={styles.pill}><PhaseName phase={phase} /></span><ConnectionPill connected={connected} /></div></div>
      <ScoreStrip data={data} />
      {message || error ? <p className={`${styles.notice} ${styles.error}`} style={{ marginBottom: 14 }}>{message || error}</p> : null}

      {["ROUND_INTRO", "AWAITING_EXTERNAL_FACE_OFF"].includes(phase) ? <section className={`${styles.card} ${styles.centerState}`}>
        <div style={{ width: "100%" }}>
          <p className={styles.eyebrow}>Round {data.round?.number} · External challenge</p>
          <h1 className={styles.phaseHero}>Overwatch face-off</h1>
          {faceOff?.alpha && faceOff.beta ? <div className={styles.versus}>
            <FaceOffPlayer name={faceOff.alpha.name} avatarUrl={faceOff.alpha.avatarUrl} color={data.teams[0]?.color} />
            <div className={styles.vs}>VS</div>
            <FaceOffPlayer name={faceOff.beta.name} avatarUrl={faceOff.beta.avatarUrl} color={data.teams[1]?.color} />
          </div> : <p className={styles.sectionCopy}>The manager is selecting the representatives.</p>}
          <p className={styles.sectionCopy} style={{ marginInline: "auto", marginTop: 24 }}>The external challenge happens outside this website. Winner answers the survey first.</p>
        </div>
      </section> : null}

      {phase === "PLAY_PASS" ? <section className={`${styles.card} ${styles.centerState}`}>
        <div><p className={styles.eyebrow}>Family Feud face-off winner</p><h1 className={styles.phaseHero}>{data.teams.find((team) => team.side === faceOff?.familyWinnerSide)?.name}</h1>
          {canChoose ? <><p className={styles.sectionCopy}>Your team controls the choice.</p><div className={styles.heroActions}><button className={styles.button} disabled={busy} onClick={() => void run("SELECT_PLAY_PASS", { choice: "PLAY" })}>Play the round</button><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy} onClick={() => void run("SELECT_PLAY_PASS", { choice: "PASS" })}>Pass the round</button></div></> : <p className={styles.sectionCopy}>Waiting for the winning team to choose PLAY or PASS.</p>}
        </div>
      </section> : null}

      {!["ROUND_INTRO", "AWAITING_EXTERNAL_FACE_OFF", "PLAY_PASS"].includes(phase) ? <div className={styles.gameLayout}>
        <main>
          <div className={styles.question}><small>{data.round?.category || `Round ${data.round?.number || 0}`}</small><h2>{data.round?.question || "Question coming up"}</h2></div>
          <AnswerBoard answers={data.round?.board || []} />
        </main>
        <aside className={styles.sidePanel}>
          <div className={`${styles.card} ${styles.turnCard}`}><small>{canAnswer ? "Your turn" : phase === "ROUND_RESULTS" ? "Round complete" : "Current player"}</small><div className={styles.turnName}>{canAnswer ? "You are up" : data.round?.currentPlayer?.name || activeTeam?.name || "Stand by"}</div></div>
          <div className={`${styles.card} ${styles.cardPad}`} style={{ display: "grid", justifyItems: "center", gap: 14 }}><Timer endsAt={data.game.timerEndsAt} serverNow={data.serverNow} /><Strikes value={data.round?.strikes || 0} /></div>
          {canAnswer ? <form className={`${styles.card} ${styles.answerForm}`} onSubmit={submit}><label className={styles.eyebrow} htmlFor="feud-answer">Your answer</label><input id="feud-answer" className={styles.input} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Type your best answer" autoComplete="off" autoFocus /><button className={styles.button} disabled={busy || !answer.trim()}>Submit answer</button></form> : <div className={`${styles.card} ${styles.cardPad}`}><p className={styles.sectionCopy}>{phase === "PAUSED" ? "The manager paused the match." : data.round?.answerPending ? "The manager is checking the submitted answer." : `Waiting for ${data.round?.currentPlayer?.name || "the next player"}.`}</p></div>}
          {phase === "STEAL" && data.me?.side === data.round?.activeSide && !data.me?.isCaptain ? <form className={`${styles.card} ${styles.answerForm}`} onSubmit={async (event) => { event.preventDefault(); if (await run("SUBMIT_STEAL_SUGGESTION", { text: suggestion })) setSuggestion(""); }}><label className={styles.eyebrow} htmlFor="steal-suggestion">Private team suggestion</label><input id="steal-suggestion" className={styles.input} value={suggestion} onChange={(event) => setSuggestion(event.target.value)} placeholder="Help your captain" /><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy || !suggestion.trim()}>Send to team</button></form> : null}
          {data.teamPrivate?.suggestions.length ? <div className={`${styles.card} ${styles.cardPad}`}><p className={styles.controlTitle}>Team discussion</p><div className={styles.stack}>{data.teamPrivate.suggestions.map((item, index) => <div className={styles.notice} key={`${item.playerName}-${index}`}><strong>{item.playerName}</strong><br />{item.text}</div>)}</div></div> : null}
        </aside>
      </div> : null}
    </div>
    {phase === "PAUSED" ? <div className={styles.pausedOverlay}><div><h1>Match paused</h1><p>The board is locked</p></div></div> : null}
  </div>;
}

function FaceOffPlayer({ name, avatarUrl, color }: { name: string; avatarUrl: string | null; color?: string }) {
  return <div className={styles.versusPlayer} style={{ "--team": color || "#36dcff" } as React.CSSProperties}>
    {avatarUrl ? <img src={avatarUrl} alt="" /> : <span className={`${styles.versusAvatar} ${styles.avatarFallback}`} style={{ display: "grid", placeItems: "center" }}>{name.slice(0, 2).toUpperCase()}</span>}
    <div className={styles.versusName}>{name}</div>
  </div>;
}
