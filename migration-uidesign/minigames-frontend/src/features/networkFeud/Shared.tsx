"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FeudBoardAnswer, FeudProjection, FeudTeam } from "@/lib/familyFeud/types";
import styles from "./network-feud.module.css";

export function FeudLogo() {
  return <div className={styles.logo}><span className={styles.logoMark}><img src="/feud-winton.webp" alt="" /></span><span className={styles.logoText}>Family <span>Feud</span></span></div>;
}

export function ShowCover({ eyebrow, title, detail, broadcast = false, children }: { eyebrow: string; title: string; detail?: string; broadcast?: boolean; children?: ReactNode }) {
  return <section className={`${styles.showCover} ${broadcast ? styles.showCoverBroadcast : ""}`}>
    <div className={styles.showStage} />
    <img className={styles.showCoins} src="/feud-coins.webp" alt="" />
    <img className={styles.showHost} src="/feud-doomfist.webp" alt="" />
    <div className={styles.showCoverCopy}>
      <FeudLogo />
      <p className={styles.showEyebrow}>{eyebrow}</p>
      <h1>{title}</h1>
      {detail ? <p className={styles.showDetail}>{detail}</p> : null}
      {children}
    </div>
  </section>;
}

export function Avatar({ name, src, className = "" }: { name: string; src?: string | null; className?: string }) {
  return src
    ? <img className={`${styles.avatar} ${className}`} src={src} alt="" />
    : <span className={`${styles.avatar} ${styles.avatarFallback} ${className}`}>{name.slice(0, 2).toUpperCase()}</span>;
}

export function ConnectionPill({ connected }: { connected: boolean }) {
  return <span className={styles.pill} role="status"><span className={`${styles.statusDot} ${connected ? "" : styles.offline}`} aria-hidden="true" />{connected ? "Connected" : "Reconnecting"}</span>;
}

export function Timer({ endsAt, serverNow }: { endsAt: string | null; serverNow: string }) {
  const offset = useMemo(() => Date.now() - new Date(serverNow).getTime(), [serverNow]);
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const update = () => setRemaining(endsAt ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - (Date.now() - offset)) / 1000)) : 0);
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [endsAt, offset]);
  return <div className={styles.timer} aria-label={`${remaining} seconds remaining`}>{endsAt ? remaining : "—"}</div>;
}

export function ScoreStrip({ data }: { data: FeudProjection }) {
  const alpha = data.teams.find((team) => team.side === "ALPHA");
  const beta = data.teams.find((team) => team.side === "BETA");
  if (!alpha || !beta) return null;
  return <div className={styles.scoreStrip}>
    <ScoreTeam team={alpha} />
    <div className={styles.bank}><small>Round bank</small><strong key={data.round?.bank ?? 0} className={styles.scorePop}>{data.round?.bank ?? 0}</strong></div>
    <ScoreTeam team={beta} />
  </div>;
}

function ScoreTeam({ team }: { team: FeudTeam }) {
  return <div className={styles.scoreTeam} style={{ "--team": team.color } as React.CSSProperties}>
    <span className={styles.scoreTeamName}>{team.name}</span><strong key={team.score} className={`${styles.scoreNumber} ${styles.scorePop}`}>{team.score}</strong>
  </div>;
}

export function AnswerBoard({ answers, broadcast = false, previewAnswers = false }: { answers: FeudBoardAnswer[]; broadcast?: boolean; previewAnswers?: boolean }) {
  const slots: FeudBoardAnswer[] = answers.length ? answers : Array.from({ length: 6 }, (_, index) => ({ rank: index + 1, revealed: false }));
  return <div className={styles.boardStage} data-broadcast={broadcast || undefined} aria-label="Survey answer board">
    <div className={styles.boardLights} aria-hidden="true" />
    <div className={styles.board}>
      {slots.map((answer) => <div key={answer.id || answer.rank} className={`${styles.answer} ${answer.revealed ? styles.answerReveal : previewAnswers && answer.answer ? styles.answerPreview : styles.answerHidden}`} aria-label={answer.revealed ? `Answer ${answer.rank}: ${answer.answer}, ${answer.points} points` : `Answer ${answer.rank} hidden`}>
        <span className={styles.answerRank}>{answer.rank}</span>
        <span className={styles.answerText}>{answer.revealed || previewAnswers ? answer.answer : ""}</span>
        <span className={styles.answerPoints}>{answer.revealed || previewAnswers ? answer.points : ""}</span>
      </div>)}
    </div>
  </div>;
}

export function Strikes({ value }: { value: number }) {
  return <div className={styles.strikes} aria-label={`${value} strikes`}>
    {[0, 1, 2].map((index) => <span key={index} className={`${styles.strike} ${index < value ? styles.strikeOn : ""}`}><span aria-hidden="true">×</span></span>)}
  </div>;
}

export function GameEffects({ data }: { data: FeudProjection }) {
  const previous = useRef<{ version: number; revealed: number; strikes: number; eventId: string | null } | null>(null);
  const [effect, setEffect] = useState<{ type: "answer" | "strike"; id: string; label: string } | null>(null);

  useEffect(() => {
    const current = {
      version: data.game.version,
      revealed: data.round?.board.filter((answer) => answer.revealed).length || 0,
      strikes: data.round?.strikes || 0,
      eventId: data.game.lastEvent?.id || null,
    };
    const before = previous.current;
    previous.current = current;
    if (!before || before.version === current.version) return;
    const eventChanged = Boolean(current.eventId && current.eventId !== before.eventId);
    const explicitType = eventChanged ? data.game.lastEvent?.type : null;
    const type = explicitType === "CORRECT" ? "answer" : explicitType === "INCORRECT" || explicitType === "NO_ANSWER" ? "strike" : current.strikes > before.strikes ? "strike" : current.revealed > before.revealed ? "answer" : null;
    if (!type) return;
    setEffect({ type, id: current.eventId || String(current.version), label: data.game.lastEvent?.label || (type === "strike" ? "INCORRECT" : "") });
    const timer = window.setTimeout(() => setEffect(null), type === "strike" ? 1450 : 850);
    return () => window.clearTimeout(timer);
  }, [data]);

  if (!effect) return null;
  return <div key={effect.id} className={`${styles.gameEffect} ${effect.type === "strike" ? styles.effectStrike : styles.effectAnswer}`} aria-hidden="true">
    {effect.type === "strike" ? <div className={styles.wrongAnswerMark}><span>×</span><strong>{effect.label}</strong></div> : <div className={styles.correctAnswerFlash}><span /></div>}
  </div>;
}

export function TeamCard({ team, manager = false }: { team: FeudTeam; manager?: boolean }) {
  const players = manager && team.managerPlayers ? team.managerPlayers : team.players;
  return <section className={`${styles.card} ${styles.teamCard}`} style={{ "--team": team.color } as React.CSSProperties}>
    <div className={styles.teamHead}><div><h2 className={styles.teamName}>{team.name}</h2><span className={styles.teamMeta}>{players.length} players · Captain: {team.captainName || "Not assigned"}</span></div><strong className={styles.teamScore}>{team.score}</strong></div>
    <div className={styles.stack}>{players.map((player, index) => <div className={styles.playerRow} key={`${player.name}-${index}`}>
      <Avatar name={player.name} src={player.avatarUrl} />
      <span className={styles.playerName}>{player.name}</span>
      <span className={styles.pill}><span className={`${styles.statusDot} ${player.connected ? "" : styles.offline}`} />{player.ready ? "Ready" : "Not ready"}</span>
    </div>)}</div>
  </section>;
}

export function PhaseName({ phase }: { phase: string }) {
  return <>{phase.replaceAll("_", " ")}</>;
}

export function LoadingState({ broadcast = false }: { broadcast?: boolean }) {
  return <div className={broadcast ? styles.broadcast : styles.shell}><div className={styles.centerState}><div><FeudLogo /><p className={styles.eyebrow} style={{ marginTop: 24 }}>Connecting to the match</p></div></div></div>;
}

export function ErrorState({ message, broadcast = false }: { message: string; broadcast?: boolean }) {
  return <div className={broadcast ? styles.broadcast : styles.shell}><div className={styles.centerState}><div><FeudLogo /><h1 className={styles.phaseHero}>{broadcast ? "Stand by" : "Match unavailable"}</h1><p className={styles.sectionCopy}>{broadcast ? "The program will resume automatically." : message}</p>{!broadcast ? <button type="button" className={styles.button} style={{ marginTop: 18 }} onClick={() => location.reload()}>Try again</button> : null}</div></div></div>;
}
