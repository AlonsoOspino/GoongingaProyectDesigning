"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useFeudGame } from "@/lib/familyFeud/useFeudGame";
import type { TeamSide } from "@/lib/familyFeud/types";
import { AnswerBoard, ConnectionPill, ErrorState, FeudLogo, LoadingState, PhaseName, ScoreStrip, Strikes, TeamCard, Timer } from "./Shared";
import styles from "./network-feud.module.css";

function managerHelp(phase: string) {
  const help: Record<string, string> = {
    LOBBY: "Share the player link, check that everyone chose a team and is ready, then start the game.",
    ROUND_INTRO: "Choose one representative from each team for the external face-off.",
    AWAITING_EXTERNAL_FACE_OFF: "Record who won the external challenge, then confirm the result.",
    FACE_OFF_FIRST_ANSWER: "Wait for the first representative's answer, then match it to the board or mark it incorrect.",
    FACE_OFF_SECOND_ANSWER: "Wait for the second representative's answer, then resolve it against the board.",
    PLAY_PASS: "The face-off winner now chooses whether their team will play or pass.",
    ROUND_PLAY: "Resolve each submitted answer. The server advances turns and keeps the round score.",
    STEAL: "The other team has one chance to steal the round.",
    ROUND_RESULTS: "Review the score, then start the next round or choose two players for Fast Money.",
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
  const [alphaRep, setAlphaRep] = useState("");
  const [betaRep, setBetaRep] = useState("");
  const [fastOne, setFastOne] = useState("");
  const [fastTwo, setFastTwo] = useState("");
  const [bank, setBank] = useState("");
  const [scores, setScores] = useState<Record<TeamSide, string>>({ ALPHA: "", BETA: "" });

  const run = async (name: string, payload: Record<string, unknown> = {}) => {
    setBusy(true); setMessage(null);
    try { await action(name, payload); return true; }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "The control action failed."); return false; }
    finally { setBusy(false); }
  };

  if (loading && !data) return <LoadingState />;
  if (!data) return <ErrorState message={error || "You do not have access to this control room."} />;
  const phase = data.game.phase;
  const alpha = data.teams.find((team) => team.side === "ALPHA")!;
  const beta = data.teams.find((team) => team.side === "BETA")!;
  const pending = data.manager?.pendingResponse;
  const leadingTeam = [...data.teams].sort((a, b) => b.score - a.score)[0];
  const fastPlayers = leadingTeam?.managerPlayers || [];

  return <div className={styles.shell}>
    <div className={`${styles.container} ${styles.wide}`}>
      <div className={styles.topline}>
        <div><FeudLogo /><p className={styles.eyebrow} style={{ marginTop: 16 }}>Manager room / {data.game.code}</p></div>
        <div className={styles.buttonRow}><Link className={`${styles.button} ${styles.buttonSecondary}`} style={{ display: "inline-grid", placeItems: "center" }} href={`/feud/spectator/${code}`} target="_blank">Open broadcast</Link><ConnectionPill connected={connected} /></div>
      </div>
      <div className={`${styles.notice} ${message || error ? styles.error : ""}`} style={{ marginBottom: 18 }}>{message || error || managerHelp(phase)}</div>
      <ScoreStrip data={data} />

      <div className={styles.managerGrid}>
        <main className={styles.stack}>
          {data.round ? <section className={`${styles.card} ${styles.cardPad}`}>
            <div className={styles.question}><small>{data.round.category} · Round {data.round.number} ×{data.round.multiplier}</small><h2>{data.round.question || "Question hidden from players"}</h2></div>
            <AnswerBoard answers={data.round.board} />
          </section> : null}

          {phase === "LOBBY" ? <LobbyControls data={data} busy={busy} run={run} /> : null}

          {phase === "ROUND_INTRO" ? <section className={styles.card}>
            <div className={styles.controlGroup}><h2 className={styles.sectionTitle}>External face-off setup</h2><p className={styles.sectionCopy}>Choose one active representative from each team. The challenge itself happens outside Network Feud.</p></div>
            <div className={styles.controlGroup}><div className={styles.selectGrid}>
              <label className={styles.field}><span>{alpha.name} representative</span><select className={styles.select} value={alphaRep} onChange={(event) => setAlphaRep(event.target.value)}><option value="">Select player</option>{alpha.managerPlayers?.map((player) => <option value={player.memberId} key={player.memberId}>{player.name}</option>)}</select></label>
              <label className={styles.field}><span>{beta.name} representative</span><select className={styles.select} value={betaRep} onChange={(event) => setBetaRep(event.target.value)}><option value="">Select player</option>{beta.managerPlayers?.map((player) => <option value={player.memberId} key={player.memberId}>{player.name}</option>)}</select></label>
            </div><div className={styles.buttonRow} style={{ marginTop: 12 }}><button className={styles.button} disabled={busy || !alphaRep || !betaRep} onClick={() => void run("SET_FACE_OFF_REPRESENTATIVES", { alphaMemberId: Number(alphaRep), betaMemberId: Number(betaRep) })}>Confirm representatives</button><button className={`${styles.button} ${styles.buttonAmber}`} disabled={busy || !data.round?.faceOff} onClick={() => void run("START_EXTERNAL_FACE_OFF")}>Start external face-off</button></div></div>
          </section> : null}

          {phase === "AWAITING_EXTERNAL_FACE_OFF" && data.round?.faceOff ? <ExternalFaceOffControls data={data} busy={busy} run={run} /> : null}

          {pending ? <section className={`${styles.card} ${styles.cardPad} ${styles.pending}`}>
            <p className={styles.eyebrow}>Submitted by {pending.playerName}</p><div className={styles.pendingAnswer}>{pending.text}</div>
            <p className={styles.controlTitle}>Match to survey answer</p>
            <div className={styles.buttonRow}>{data.round?.board.filter((answer) => !answer.revealed).map((answer) => <button className={`${styles.button} ${pending.suggestedAnswerIds.includes(answer.id!) ? styles.buttonAmber : styles.buttonSecondary}`} key={answer.id} disabled={busy} onClick={() => void run("ACCEPT_RESPONSE", { answerId: answer.id })}>#{answer.rank} {answer.answer} · {answer.points}</button>)}</div>
            <button className={`${styles.button} ${styles.buttonDanger}`} style={{ marginTop: 12 }} disabled={busy} onClick={() => void run("REJECT_RESPONSE")}>No matching answer</button>
          </section> : null}

          <div className={styles.grid2}><TeamCard team={alpha} manager /><TeamCard team={beta} manager /></div>
        </main>

        <aside className={styles.sidePanel}>
          <section className={styles.card}>
            <div className={styles.controlGroup}><p className={styles.controlTitle}>Live state</p><h2 className={styles.sectionTitle}><PhaseName phase={phase} /></h2><p className={styles.sectionCopy}>{data.round?.currentPlayer ? `Current player: ${data.round.currentPlayer.name}` : "No active player"}</p></div>
            <div className={styles.controlGroup} style={{ display: "grid", justifyItems: "center", gap: 14 }}><Timer endsAt={data.game.timerEndsAt} serverNow={data.serverNow} /><Strikes value={data.round?.strikes || 0} /></div>
            <div className={styles.controlGroup}><div className={styles.buttonRow}>{phase === "PAUSED" ? <button className={styles.button} disabled={busy} onClick={() => void run("RESUME")}>Resume match</button> : <button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy || ["LOBBY", "FINISHED"].includes(phase)} onClick={() => void run("PAUSE")}>Pause match</button>}<button className={`${styles.button} ${styles.buttonDanger}`} disabled={busy || phase === "FINISHED"} onClick={() => void run("END_GAME")}>End game</button></div></div>
          </section>

          {phase === "PLAY_PASS" ? <section className={`${styles.card} ${styles.cardPad}`}><p className={styles.controlTitle}>Play / Pass override</p><div className={styles.buttonRow}><button className={styles.button} disabled={busy} onClick={() => void run("SELECT_PLAY_PASS", { choice: "PLAY" })}>Play</button><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy} onClick={() => void run("SELECT_PLAY_PASS", { choice: "PASS" })}>Pass</button></div></section> : null}

          {data.round && ["ROUND_PLAY", "STEAL"].includes(phase) ? <section className={styles.card}>
            <div className={styles.controlGroup}><p className={styles.controlTitle}>Strikes</p><div className={styles.buttonRow}><button className={`${styles.button} ${styles.buttonDanger}`} disabled={busy || data.round.strikes >= 3} onClick={() => void run("ADD_STRIKE")}>Add strike</button><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy || data.round.strikes <= 0} onClick={() => void run("REMOVE_STRIKE")}>Remove</button></div></div>
            <div className={styles.controlGroup}><p className={styles.controlTitle}>Round bank</p><div className={styles.buttonRow}><input className={styles.input} style={{ width: 110 }} value={bank} onChange={(event) => setBank(event.target.value)} placeholder={String(data.round.bank)} inputMode="numeric" /><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy || bank === ""} onClick={() => void run("ADJUST_BANK", { value: Number(bank) })}>Set bank</button></div></div>
            <div className={styles.controlGroup}><div className={styles.buttonRow}>{phase === "ROUND_PLAY" ? <button className={`${styles.button} ${styles.buttonAmber}`} disabled={busy} onClick={() => void run("START_STEAL")}>Start steal</button> : null}<button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy} onClick={() => void run("END_ROUND", { winnerSide: data.round?.activeSide })}>End round</button></div></div>
          </section> : null}

          <section className={styles.card}>
            <div className={styles.controlGroup}><p className={styles.controlTitle}>Team scores</p>{data.teams.map((team) => <div className={styles.field} key={team.side} style={{ marginBottom: 10 }}><label>{team.name}</label><div className={styles.buttonRow}><input className={styles.input} style={{ width: 100 }} value={scores[team.side]} onChange={(event) => setScores((current) => ({ ...current, [team.side]: event.target.value }))} placeholder={String(team.score)} inputMode="numeric" /><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy || scores[team.side] === ""} onClick={() => void run("ADJUST_SCORE", { side: team.side, value: Number(scores[team.side]) })}>Set</button></div></div>)}</div>
          </section>

          {phase === "ROUND_RESULTS" ? <section className={styles.card}>
            <div className={styles.controlGroup}><p className={styles.controlTitle}>Continue the show</p><div className={styles.buttonRow}><button className={styles.button} disabled={busy || data.game.currentRound >= data.game.config.roundCount} onClick={() => void run("NEXT_ROUND")}>Next round</button></div></div>
            <div className={styles.controlGroup}><p className={styles.controlTitle}>Fast Money · {leadingTeam?.name}</p><div className={styles.stack}><select className={styles.select} value={fastOne} onChange={(event) => setFastOne(event.target.value)}><option value="">Player one</option>{fastPlayers.map((player) => <option key={player.memberId} value={player.memberId}>{player.name}</option>)}</select><select className={styles.select} value={fastTwo} onChange={(event) => setFastTwo(event.target.value)}><option value="">Player two</option>{fastPlayers.map((player) => <option key={player.memberId} value={player.memberId}>{player.name}</option>)}</select><button className={`${styles.button} ${styles.buttonAmber}`} disabled={busy || !fastOne || !fastTwo || fastOne === fastTwo} onClick={() => void run("START_FAST_MONEY", { memberIds: [Number(fastOne), Number(fastTwo)] })}>Start Fast Money</button></div></div>
          </section> : null}
        </aside>
      </div>
    </div>
  </div>;
}

function LobbyControls({ data, busy, run }: { data: NonNullable<ReturnType<typeof useFeudGame>["data"]>; busy: boolean; run: (name: string, payload?: Record<string, unknown>) => Promise<boolean> }) {
  const copy = (value: string) => navigator.clipboard.writeText(value);
  const players = data.manager?.participants.filter((participant) => participant.role === "PLAYER") || [];
  const alphaPlayers = players.filter((player) => player.teamSide === "ALPHA");
  const betaPlayers = players.filter((player) => player.teamSide === "BETA");
  const readyCount = players.filter((player) => player.ready).length;
  const canStart = alphaPlayers.length > 0 && betaPlayers.length > 0 && readyCount === players.length;
  return <section className={styles.card}>
    <div className={styles.controlGroup}><div className={styles.lobbyHeading}><div><p className={styles.eyebrow}>Player code</p><div className={styles.lobbyCode}>{data.game.code}</div></div><div className={styles.lobbyReadiness}><strong>{readyCount}/{players.length}</strong><span>players ready</span></div></div><p className={styles.sectionCopy}>Ask players to open the lobby link, choose a team, and press Ready.</p></div>
    <div className={styles.controlGroup}><div className={styles.buttonRow}><button className={styles.button} onClick={() => void copy(`${location.origin}/feud/lobby/${data.game.code}`)}>Copy player link</button><Link className={`${styles.button} ${styles.buttonSecondary}`} href={`/feud/lobby/${data.game.code}`} target="_blank">Open player lobby</Link><button className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => void copy(`${location.origin}/feud/spectator/${data.game.code}`)}>Copy broadcast link</button></div></div>
    <div className={styles.controlGroup}><div className={styles.startRow}><div><strong>{canStart ? "Ready to start" : "Waiting for both teams"}</strong><p>{canStart ? "Everyone is ready. Starting will lock the teams." : "Each team needs at least one player, and every player must be ready."}</p></div><button className={styles.button} disabled={busy || !canStart} onClick={() => void run("START_GAME")}>Start game</button></div></div>
    {players.length ? <div className={styles.controlGroup}><p className={styles.controlTitle}>Player assignments</p><div className={styles.stack}>{players.map((player) => <div className={styles.playerRow} key={player.memberId}><span className={`${styles.statusDot} ${player.ready ? "" : styles.offline}`} /><span className={styles.playerName}>{player.name}{player.ready ? "" : " (not ready)"}</span><select className={styles.select} style={{ width: 140 }} value={player.teamSide || "ALPHA"} onChange={(event) => void run("MOVE_PLAYER", { memberId: player.memberId, side: event.target.value })}><option value="ALPHA">{data.teams.find((team) => team.side === "ALPHA")?.name}</option><option value="BETA">{data.teams.find((team) => team.side === "BETA")?.name}</option></select><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy} onClick={() => void run("SET_CAPTAIN", { memberId: player.memberId })}>Make captain</button><button className={`${styles.button} ${styles.buttonDanger}`} disabled={busy} onClick={() => void run("REMOVE_PLAYER", { memberId: player.memberId })}>Remove</button></div>)}</div></div> : null}
  </section>;
}

function ExternalFaceOffControls({ data, busy, run }: { data: NonNullable<ReturnType<typeof useFeudGame>["data"]>; busy: boolean; run: (name: string, payload?: Record<string, unknown>) => Promise<boolean> }) {
  const faceOff = data.round!.faceOff!;
  const participants = data.manager!.participants;
  const alphaId = participants.find((participant) => participant.name === faceOff.alpha?.name && participant.teamSide === "ALPHA")?.memberId;
  const betaId = participants.find((participant) => participant.name === faceOff.beta?.name && participant.teamSide === "BETA")?.memberId;
  return <section className={`${styles.card} ${styles.centerState}`}><div style={{ width: "100%" }}><p className={styles.eyebrow}>External Overwatch face-off</p><h2 className={styles.phaseHero}>{faceOff.alpha?.name} <span style={{ color: "#ffd45f" }}>VS</span> {faceOff.beta?.name}</h2>
    {faceOff.pendingWinnerName ? <><p className={styles.sectionCopy}>{faceOff.pendingWinnerName} won the external challenge and will answer first.</p><div className={styles.heroActions}><button className={`${styles.button} ${styles.buttonAmber}`} disabled={busy} onClick={() => void run("CONFIRM_EXTERNAL_WINNER")}>Confirm result</button><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy} onClick={() => void run("RECORD_EXTERNAL_WINNER", { memberId: faceOff.pendingWinnerName === faceOff.alpha?.name ? betaId : alphaId })}>Change winner</button></div></> : <div className={styles.heroActions}><button className={styles.button} disabled={busy || !alphaId} onClick={() => void run("RECORD_EXTERNAL_WINNER", { memberId: alphaId })}>{faceOff.alpha?.name} won</button><button className={`${styles.button} ${styles.buttonPink}`} disabled={busy || !betaId} onClick={() => void run("RECORD_EXTERNAL_WINNER", { memberId: betaId })}>{faceOff.beta?.name} won</button></div>}
  </div></section>;
}
