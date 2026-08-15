"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFeudGame } from "@/lib/familyFeud/useFeudGame";
import type { TeamSide } from "@/lib/familyFeud/types";
import { AnswerBoard, ConnectionPill, ErrorState, FeudLogo, GameEffects, LoadingState, PhaseName, ScoreStrip, Strikes, TeamCard, Timer } from "./Shared";
import styles from "./network-feud.module.css";

function managerHelp(phase: string) {
  const help: Record<string, string> = {
    LOBBY: "Share the player link, check that everyone chose a team and is ready, then start the game.",
    ROUND_INTRO: "Read the question, then choose which captain answers first.",
    AWAITING_EXTERNAL_FACE_OFF: "Choose which captain answers first.",
    FACE_OFF_FIRST_ANSWER: "Wait for the first representative's answer, then match it to the board or mark it incorrect.",
    FACE_OFF_SECOND_ANSWER: "Wait for the second representative's answer, then resolve it against the board.",
    PLAY_PASS: "The face-off winner now chooses whether their team will play or pass.",
    ROUND_PLAY: "Resolve each submitted answer. The server advances turns and keeps the round score.",
    STEAL: "The other team has one chance to steal the round.",
    ROUND_RESULTS: "Review the score, then start the next round or finish the game.",
    FAST_MONEY: "Resolve each Fast Money answer as it arrives.",
    PAUSED: "The match is paused. Resume it when everyone is ready.",
    FINISHED: "The match is complete. Keep the broadcast open if you want to show the final score.",
  };
  return help[phase] || "Use the controls below to continue the match.";
}

export function ManagerPage() {
  const params = useParams<{ gameId: string }>();
  const code = String(params.gameId || "").toUpperCase();
  const { data, error, loading, connected, action } = useFeudGame(code, "manager");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [bank, setBank] = useState("");
  const [scores, setScores] = useState<Record<TeamSide, string>>({ ALPHA: "", BETA: "" });
  const [actionHistory, setActionHistory] = useState<Array<{ label: string; action: string; payload: Record<string, unknown> }>>([]);

  useEffect(() => {
    setActionHistory((current) => current.filter((item) => {
      if (item.action === "UNDO_RESPONSE") return Boolean(data?.manager?.canUndoResponse);
      if (item.action === "UNDO_STRIKE") return Boolean(data?.manager?.canUndoStrike);
      return true;
    }));
  }, [data?.manager?.canUndoResponse, data?.manager?.canUndoStrike]);

  const run = async (name: string, payload: Record<string, unknown> = {}) => {
    setBusy(true); setMessage(null);
    try { await action(name, payload); return true; }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "The control action failed."); return false; }
    finally { setBusy(false); }
  };

  const runWithUndo = async (name: string, payload: Record<string, unknown>, undo: { label: string; action: string; payload: Record<string, unknown> }) => {
    if (await run(name, payload)) setActionHistory((current) => [...current.filter((item) => !["UNDO_RESPONSE", "UNDO_STRIKE"].includes(undo.action) || item.action !== undo.action).slice(-4), undo]);
  };

  const undoLast = async () => {
    const previous = actionHistory.at(-1);
    if (!previous) return;
    if (await run(previous.action, previous.payload)) {
      setActionHistory((current) => current.slice(0, -1));
      setMessage(`Recovered: ${previous.label}`);
    }
  };

  if (loading && !data) return <LoadingState />;
  if (!data) return <ErrorState message={error || "You do not have access to this control room."} />;
  const phase = data.game.phase;
  const alpha = data.teams.find((team) => team.side === "ALPHA")!;
  const beta = data.teams.find((team) => team.side === "BETA")!;
  const pending = data.manager?.pendingResponse;

  return <div className={`${styles.shell} ${styles.managerShell}`}>
    <GameEffects data={data} />
    <div className={`${styles.container} ${styles.wide}`}>
      <div className={styles.topline}>
        <div><FeudLogo /><p className={styles.eyebrow} style={{ marginTop: 16 }}>Manager room / {data.game.code}</p></div>
        <div className={styles.buttonRow}><Link className={`${styles.button} ${styles.buttonSecondary}`} href="/admin/feud/games">All games</Link><Link className={`${styles.button} ${styles.buttonSecondary}`} style={{ display: "inline-grid", placeItems: "center" }} href={`/feud/spectator/${code}`} target="_blank">Open broadcast</Link><ConnectionPill connected={connected} /></div>
      </div>
      <div className={`${styles.notice} ${message || error ? styles.error : ""}`} style={{ marginBottom: 18 }} role="status" aria-live="polite">{message || error || managerHelp(phase)}</div>
      <ScoreStrip data={data} />

      <div className={styles.managerGrid}>
        <main className={styles.stack}>
          {data.round ? <section className={`${styles.card} ${styles.cardPad}`}>
            <div className={styles.question}><small>{data.round.category} · Round {data.round.number} ×{data.round.multiplier}</small><h2>{data.round.question || "Question hidden from players"}</h2></div>
            <AnswerBoard answers={data.round.board} previewAnswers />
          </section> : null}

          {phase === "LOBBY" ? <LobbyControls data={data} busy={busy} run={run} /> : null}

          {phase === "ROUND_INTRO" ? <section className={`${styles.card} ${styles.cardPad}`}>
            <p className={styles.eyebrow}>Start the face-off</p><h2 className={styles.sectionTitle}>Which captain answers first?</h2><p className={styles.sectionCopy}>Use your usual buzzer, voice call, or in-person signal. Then select the captain who won.</p>
            <div className={styles.faceOffChoices}><button className={styles.button} disabled={busy || !alpha.captainName} onClick={() => void run("START_FACE_OFF", { side: "ALPHA" })}>{alpha.captainName || alpha.name} answers first</button><button className={`${styles.button} ${styles.buttonPink}`} disabled={busy || !beta.captainName} onClick={() => void run("START_FACE_OFF", { side: "BETA" })}>{beta.captainName || beta.name} answers first</button></div>
          </section> : null}

          {pending ? <section className={`${styles.card} ${styles.cardPad} ${styles.pending}`}>
            <p className={styles.eyebrow}>Submitted by {pending.playerName}</p><div className={styles.pendingAnswer}>{pending.text}</div>
            <p className={styles.controlTitle}>Match to survey answer</p>
            <div className={styles.buttonRow}>{data.round?.board.filter((answer) => !answer.revealed).map((answer) => <button className={`${styles.button} ${pending.suggestedAnswerIds.includes(answer.id!) ? styles.buttonAmber : styles.buttonSecondary}`} key={answer.id} disabled={busy} onClick={() => { if (window.confirm(`Reveal #${answer.rank} ${answer.answer} for ${answer.points} points?`)) void runWithUndo("ACCEPT_RESPONSE", { answerId: answer.id }, { label: "restore the pending answer", action: "UNDO_RESPONSE", payload: {} }); }}>#{answer.rank} {answer.answer} · {answer.points}</button>)}</div>
            <button className={`${styles.button} ${styles.buttonDanger}`} style={{ marginTop: 12 }} disabled={busy} onClick={() => { if (window.confirm(`Mark “${pending.text}” incorrect and add a strike?`)) void runWithUndo("REJECT_RESPONSE", {}, { label: "restore the pending answer", action: "UNDO_RESPONSE", payload: {} }); }}>No matching answer</button>
          </section> : null}

          <div className={styles.grid2}><TeamCard team={alpha} manager /><TeamCard team={beta} manager /></div>
        </main>

        <aside className={styles.sidePanel}>
          <section className={styles.card}>
            <div className={`${styles.controlGroup} ${styles.programMonitor}`}><div className={styles.programMonitorHead}><p className={styles.controlTitle}>OBS program state</p><ConnectionPill connected={connected} /></div><h2 className={styles.sectionTitle}><PhaseName phase={phase} /></h2><p className={styles.sectionCopy}>{data.round?.question || (phase === "LOBBY" ? `${alpha.name} vs ${beta.name}` : "Program slate")}</p><span className={styles.programDetail}>{data.round?.board.filter((answer) => answer.revealed).length || 0} answers revealed · bank {data.round?.bank || 0}</span></div>
            <div className={styles.controlGroup} style={{ display: "grid", justifyItems: "center", gap: 14 }}><Timer endsAt={data.game.timerEndsAt} serverNow={data.serverNow} /><Strikes value={data.round?.strikes || 0} /></div>
            <div className={styles.controlGroup}><div className={styles.buttonRow}>{phase === "PAUSED" ? <button className={styles.button} disabled={busy} onClick={() => void run("RESUME")}>Resume match</button> : <button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy || ["LOBBY", "FINISHED"].includes(phase)} onClick={() => void run("PAUSE")}>Pause match</button>}<button className={`${styles.button} ${styles.buttonDanger}`} disabled={busy || phase === "FINISHED"} onClick={() => { if (window.confirm("End the game and put the final result on air?")) void run("END_GAME"); }}>End game</button></div></div>
            {actionHistory.length ? <div className={styles.controlGroup}><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy} onClick={() => void undoLast()}>Undo: {actionHistory.at(-1)?.label}</button></div> : null}
            {!actionHistory.length && data.manager?.canUndoResponse ? <div className={styles.controlGroup}><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy} onClick={() => void run("UNDO_RESPONSE")}>Undo last answer resolution</button></div> : null}
            {!actionHistory.length && data.manager?.canUndoStrike ? <div className={styles.controlGroup}><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy} onClick={() => void run("UNDO_STRIKE")}>Undo last strike</button></div> : null}
          </section>

          {phase === "PLAY_PASS" ? <section className={`${styles.card} ${styles.cardPad}`}><p className={styles.controlTitle}>Play / Pass override</p><div className={styles.buttonRow}><button className={styles.button} disabled={busy} onClick={() => void run("SELECT_PLAY_PASS", { choice: "PLAY" })}>Play</button><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy} onClick={() => void run("SELECT_PLAY_PASS", { choice: "PASS" })}>Pass</button></div></section> : null}

          {data.round && ["ROUND_PLAY", "STEAL"].includes(phase) ? <section className={styles.card}>
            <div className={styles.controlGroup}><p className={styles.controlTitle}>Strikes</p><div className={styles.buttonRow}><button className={`${styles.button} ${styles.buttonDanger}`} disabled={busy || data.round.strikes >= 3} onClick={() => void runWithUndo("ADD_STRIKE", {}, { label: "remove added strike", action: "UNDO_STRIKE", payload: {} })}>Add strike</button><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy || data.round.strikes <= 0} onClick={() => void runWithUndo("REMOVE_STRIKE", {}, { label: "restore removed strike", action: "ADD_STRIKE", payload: {} })}>Remove</button></div></div>
            <div className={styles.controlGroup}><p className={styles.controlTitle}>Round bank</p><div className={styles.buttonRow}><input className={styles.input} style={{ width: 110 }} value={bank} onChange={(event) => setBank(event.target.value)} placeholder={String(data.round.bank)} inputMode="numeric" /><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy || bank === ""} onClick={() => void runWithUndo("ADJUST_BANK", { value: Number(bank) }, { label: `restore bank to ${data.round?.bank || 0}`, action: "ADJUST_BANK", payload: { value: data.round?.bank || 0 } })}>Set bank</button></div></div>
            <div className={styles.controlGroup}><div className={styles.buttonRow}>{phase === "ROUND_PLAY" ? <button className={`${styles.button} ${styles.buttonAmber}`} disabled={busy} onClick={() => void run("START_STEAL")}>Start steal</button> : null}<button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy} onClick={() => { if (window.confirm("End this round using the currently active team as winner?")) void run("END_ROUND", { winnerSide: data.round?.activeSide }); }}>End round</button></div></div>
          </section> : null}

          <section className={styles.card}>
            <div className={styles.controlGroup}><p className={styles.controlTitle}>Team scores</p>{data.teams.map((team) => <div className={styles.field} key={team.side} style={{ marginBottom: 10 }}><label>{team.name}</label><div className={styles.buttonRow}><input className={styles.input} style={{ width: 100 }} value={scores[team.side]} onChange={(event) => setScores((current) => ({ ...current, [team.side]: event.target.value }))} placeholder={String(team.score)} inputMode="numeric" /><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy || scores[team.side] === ""} onClick={() => void runWithUndo("ADJUST_SCORE", { side: team.side, value: Number(scores[team.side]) }, { label: `restore ${team.name} to ${team.score}`, action: "ADJUST_SCORE", payload: { side: team.side, value: team.score } })}>Set</button></div></div>)}</div>
          </section>

          {phase === "ROUND_RESULTS" ? <section className={`${styles.card} ${styles.cardPad}`}><p className={styles.controlTitle}>Continue</p><div className={styles.buttonRow}>{data.game.currentRound < data.game.config.roundCount ? <button className={styles.button} disabled={busy} onClick={() => void run("NEXT_ROUND")}>Start next round</button> : <button className={styles.button} disabled={busy} onClick={() => { if (window.confirm("Finish Family Feud and put the final winner on air?")) void run("END_GAME"); }}>Finish Family Feud</button>}</div></section> : null}
        </aside>
      </div>
    </div>
  </div>;
}

function LobbyControls({ data, busy, run }: { data: NonNullable<ReturnType<typeof useFeudGame>["data"]>; busy: boolean; run: (name: string, payload?: Record<string, unknown>) => Promise<boolean> }) {
  const copy = (value: string) => navigator.clipboard.writeText(value);
  const alpha = data.teams.find((team) => team.side === "ALPHA")!;
  const beta = data.teams.find((team) => team.side === "BETA")!;
  const invites = data.manager?.captainInvites;
  const captainLink = (side: TeamSide) => `${location.origin}/feud/lobby/${data.game.code}?captain=${side}&invite=${encodeURIComponent(side === "ALPHA" ? invites?.alpha || "" : invites?.beta || "")}`;
  const developmentLink = `${location.origin}/feud/lobby/${data.game.code}?development=1`;
  const canStart = Boolean(alpha.captainName && beta.captainName);
  return <section className={styles.card}>
    <div className={styles.controlGroup}><h2 className={styles.sectionTitle}>Send one invitation to each captain</h2><p className={styles.sectionCopy}>Each link is tied to a team. The captain signs in, is assigned automatically, and appears here.</p></div>
    <div className={styles.controlGroup}><div className={styles.captainInviteGrid}>
      {[alpha, beta].map((team) => <article className={styles.captainInvite} style={{ "--team": team.color } as React.CSSProperties} key={team.side}>
        <p>{team.name}</p><strong>{team.captainName || "Waiting for captain"}</strong>
        <button className={`${styles.button} ${team.captainName ? styles.buttonSecondary : ""}`} disabled={!invites} onClick={() => void copy(captainLink(team.side))}>{team.captainName ? "Copy invitation again" : "Copy captain invitation"}</button>
      </article>)}
    </div></div>
    {data.game.developmentMode ? <div className={styles.controlGroup}><div className={styles.developmentLobbyCallout}><div><p className={styles.eyebrow}>Development mode</p><strong>Test without Discord accounts</strong><span>Copy this link and open it in one tab per player. The first test player on each team becomes its captain.</span></div><button className={`${styles.button} ${styles.buttonAmber}`} onClick={() => void copy(developmentLink)}>Copy test-player link</button></div></div> : null}
    <div className={styles.controlGroup}><div className={styles.buttonRow}><Link className={`${styles.button} ${styles.buttonSecondary}`} href={`/feud/spectator/${data.game.code}`} target="_blank">Open broadcast</Link><button className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => void copy(`${location.origin}/feud/spectator/${data.game.code}`)}>Copy broadcast link</button></div></div>
    <div className={styles.controlGroup}><div className={styles.startRow}><div><strong>{canStart ? "Both captains are connected" : "Waiting for both captains"}</strong><p>{canStart ? "You can start Family Feud now." : "The start button unlocks after both invitation links have been accepted."}</p></div><button className={styles.button} disabled={busy || !canStart} onClick={() => void run("START_GAME")}>Start Family Feud</button></div></div>
  </section>;
}
