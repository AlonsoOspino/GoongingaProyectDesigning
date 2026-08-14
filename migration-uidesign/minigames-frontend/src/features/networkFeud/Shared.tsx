"use client";

import { useEffect, useMemo, useState } from "react";
import type { FeudBoardAnswer, FeudProjection, FeudTeam } from "@/lib/familyFeud/types";
import styles from "./network-feud.module.css";

export function FeudLogo() {
  return <div className={styles.logo}><span className={styles.logoMark}><span>FF</span></span><span className={styles.logoText}>Family <span>Feud</span></span></div>;
}

export function Avatar({ name, src, className = "" }: { name: string; src?: string | null; className?: string }) {
  return src
    ? <img className={`${styles.avatar} ${className}`} src={src} alt="" />
    : <span className={`${styles.avatar} ${styles.avatarFallback} ${className}`}>{name.slice(0, 2).toUpperCase()}</span>;
}

export function ConnectionPill({ connected }: { connected: boolean }) {
  return <span className={styles.pill}><span className={`${styles.statusDot} ${connected ? "" : styles.offline}`} />{connected ? "Live" : "Reconnecting"}</span>;
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
    <div className={styles.bank}><small>Round bank</small><strong>{data.round?.bank ?? 0}</strong></div>
    <ScoreTeam team={beta} />
  </div>;
}

function ScoreTeam({ team }: { team: FeudTeam }) {
  return <div className={styles.scoreTeam} style={{ "--team": team.color } as React.CSSProperties}>
    <span className={styles.scoreTeamName}>{team.name}</span><strong className={styles.scoreNumber}>{team.score}</strong>
  </div>;
}

export function AnswerBoard({ answers, broadcast = false }: { answers: FeudBoardAnswer[]; broadcast?: boolean }) {
  const slots: FeudBoardAnswer[] = answers.length ? answers : Array.from({ length: 6 }, (_, index) => ({ rank: index + 1, revealed: false }));
  return <div className={styles.board} data-broadcast={broadcast || undefined}>
    {slots.map((answer) => <div key={answer.id || answer.rank} className={`${styles.answer} ${answer.revealed ? styles.answerReveal : styles.answerHidden}`}>
      <span className={styles.answerRank}>{answer.rank}</span>
      <span className={styles.answerText}>{answer.revealed || answer.answer ? answer.answer : "••••••••"}</span>
      <span className={styles.answerPoints}>{answer.revealed || answer.points !== undefined ? answer.points : ""}</span>
    </div>)}
  </div>;
}

export function Strikes({ value }: { value: number }) {
  return <div className={styles.strikes} aria-label={`${value} strikes`}>
    {[0, 1, 2].map((index) => <span key={index} className={`${styles.strike} ${index < value ? styles.strikeOn : ""}`}>×</span>)}
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
  return <div className={broadcast ? styles.broadcast : styles.shell}><div className={styles.centerState}><div><FeudLogo /><h1 className={styles.phaseHero}>{broadcast ? "Reconnecting" : "Match unavailable"}</h1><p className={styles.sectionCopy}>{broadcast ? "The board will return automatically." : message}</p></div></div></div>;
}
