"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useFeudGame } from "@/lib/familyFeud/useFeudGame";
import type { FeudProjection } from "@/lib/familyFeud/types";
import { AnswerBoard, ErrorState, FeudLogo, GameEffects, LoadingState, ShowCover, Strikes, Timer } from "./Shared";
import styles from "./network-feud.module.css";

export function SpectatorPage() {
  const params = useParams<{ gameId: string }>();
  const code = String(params.gameId || "").toUpperCase();
  const { data, loading, connected } = useFeudGame(code, "spectator");
  useBroadcastSounds(data);
  if (loading && !data) return <LoadingState broadcast />;
  if (!data) return <ErrorState broadcast message="" />;
  const phase = data.game.phase;
  const alpha = data.teams.find((team) => team.side === "ALPHA")!;
  const beta = data.teams.find((team) => team.side === "BETA")!;
  const faceOff = data.round?.faceOff;
  const winner = data.teams.find((team) => team.side === (data.round?.roundWinnerSide || faceOff?.familyWinnerSide));
  const matchWinner = [...data.teams].sort((a, b) => b.score - a.score)[0];

  return <div className={styles.broadcast}>
    <GameEffects data={data} />
    <div className={styles.broadcastSafe}>
      <header className={styles.broadcastTop}>
        <BroadcastTeam team={alpha} />
        <div className={styles.broadcastRound}><small>{data.game.title}</small><strong>{phase === "LOBBY" ? data.game.code : `Round ${data.round?.number || data.game.currentRound} · ×${data.round?.multiplier || 1}`}</strong></div>
        <BroadcastTeam team={beta} />
      </header>

      <main className={styles.broadcastMain}>
        {phase === "LOBBY" ? <ShowCover broadcast eyebrow={data.game.title} title="Family Feud" detail={`${alpha.name} vs ${beta.name}`}><div className={styles.coverStatus}>{alpha.captainName ? 1 : 0} / 2 captains</div></ShowCover> : null}
        {phase === "ROUND_INTRO" ? <ShowCover broadcast eyebrow={`Round ${data.round?.number || data.game.currentRound}`} title="Face-off" detail={`${alpha.name} vs ${beta.name}`} /> : null}
        {phase === "AWAITING_EXTERNAL_FACE_OFF" ? <FaceOffBroadcast alpha={faceOff?.alpha} beta={faceOff?.beta} alphaColor={alpha.color} betaColor={beta.color} /> : null}
        {(phase === "FACE_OFF_FIRST_ANSWER" || phase === "FACE_OFF_SECOND_ANSWER") && faceOff?.externalWinner ? <div className={styles.stack}>
          <div style={{ textAlign: "center", marginBottom: "2vh" }}><p className={styles.eyebrow}>Face-off advantage</p><h1 className={styles.phaseHero} style={{ margin: 0 }}>{faceOff.externalWinner.name} answers first</h1></div>
          <BoardContent data={data} />
        </div> : null}
        {["PLAY_PASS", "ROUND_PLAY", "STEAL"].includes(phase) ? <BoardContent data={data} /> : null}
        {phase === "ROUND_RESULTS" ? <BroadcastMessage eyebrow="Round winner" title={winner?.name || "Round complete"} copy={`${data.round?.bank || 0} points banked`} /> : null}
        {phase === "FAST_MONEY" ? <BroadcastMessage eyebrow={`Target · ${data.fastMoney?.target || data.game.config.fastMoneyTarget} points`} title={data.fastMoney?.complete ? `${data.fastMoney.total} points` : "Fast Money"} copy={data.fastMoney?.complete ? (data.fastMoney.total >= data.fastMoney.target ? "FAST MONEY WINNERS!" : "SO CLOSE!") : data.round?.currentPlayer ? `${data.round.currentPlayer.name} is on the clock` : "Five questions. One final push."} /> : null}
        {phase === "FINISHED" ? <BroadcastMessage eyebrow="Family Feud winner" title={matchWinner.name} copy={`Final score · ${matchWinner.score}`} /> : null}
        {phase === "PAUSED" ? <BroadcastMessage eyebrow="Production hold" title="Match paused" copy="The game will resume shortly" /> : null}
      </main>

      <footer className={styles.broadcastFoot}>
        <div className={styles.broadcastBank}><small>Round bank</small><strong key={data.round?.bank || 0} className={styles.scorePop}>{data.round?.bank || 0}</strong></div>
        <div className={styles.broadcastStatus}><small>{phase.replaceAll("_", " ")}</small><strong>{data.round?.currentPlayer?.name || (phase === "STEAL" ? `${data.teams.find((team) => team.side === data.round?.activeSide)?.name} can steal` : "Family Feud")}</strong></div>
        <div style={{ justifySelf: "end", display: "grid", justifyItems: "end", gap: 12 }}><Timer endsAt={data.game.timerEndsAt} serverNow={data.serverNow} /><Strikes value={data.round?.strikes || 0} /></div>
      </footer>
    </div>
    {!connected ? <div className={styles.reconnecting}>Reconnecting…</div> : null}
    {phase === "PAUSED" ? <div className={styles.pausedOverlay}><div><h1>Match paused</h1><p>The show will continue shortly</p></div></div> : null}
  </div>;
}

function useBroadcastSounds(data: FeudProjection | null) {
  const previous = useRef<{ version: number; phase: string; revealed: number; strikes: number } | null>(null);
  useEffect(() => {
    if (!data) return;
    const current = { version: data.game.version, phase: data.game.phase, revealed: data.round?.board.filter((answer) => answer.revealed).length || 0, strikes: data.round?.strikes || 0 };
    const before = previous.current;
    previous.current = current;
    if (!before || before.version === current.version) return;
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    let context: AudioContext | null = null;
    try {
      context = new AudioContextClass();
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.14, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55);
      gain.connect(context.destination);
      const frequencies = current.strikes > before.strikes ? [120, 88] : current.revealed > before.revealed ? [520, 760, 980] : current.phase !== before.phase ? [260, 390] : [];
      frequencies.forEach((frequency, index) => {
        const oscillator = context!.createOscillator();
        oscillator.type = current.strikes > before.strikes ? "sawtooth" : "sine";
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start(context!.currentTime + index * 0.09);
        oscillator.stop(context!.currentTime + 0.32 + index * 0.09);
      });
    } catch {
      context?.close().catch(() => undefined);
      return;
    }
    const closeTimer = window.setTimeout(() => context?.close().catch(() => undefined), 900);
    return () => window.clearTimeout(closeTimer);
  }, [data]);
}

function BroadcastTeam({ team }: { team: { name: string; score: number; color: string } }) {
  return <div className={styles.broadcastTeam} style={{ "--team": team.color } as React.CSSProperties}><div><div className={styles.broadcastTeamName}>{team.name}</div><div key={team.score} className={`${styles.broadcastScore} ${styles.scorePop}`}>{team.score}</div></div></div>;
}

function BroadcastMessage({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div style={{ textAlign: "center" }}><FeudLogo /><p className={styles.eyebrow} style={{ marginTop: "4vh" }}>{eyebrow}</p><h1 className={styles.phaseHero}>{title}</h1><p className={styles.subhead} style={{ marginInline: "auto" }}>{copy}</p></div>;
}

function FaceOffBroadcast({ alpha, beta, alphaColor, betaColor }: { alpha?: { name: string; avatarUrl: string | null } | null; beta?: { name: string; avatarUrl: string | null } | null; alphaColor: string; betaColor: string }) {
  if (!alpha || !beta) return <BroadcastMessage eyebrow="Round face-off" title="Get ready" copy="The manager is choosing who answers first" />;
  return <div style={{ textAlign: "center" }}><p className={styles.eyebrow}>Family Feud face-off</p><div className={styles.versus} style={{ margin: "3vh auto 0" }}>
    <SpectatorPlayer player={alpha} color={alphaColor} /><span className={styles.vs}>VS</span><SpectatorPlayer player={beta} color={betaColor} />
  </div></div>;
}

function SpectatorPlayer({ player, color }: { player: { name: string; avatarUrl: string | null }; color: string }) {
  return <div className={styles.versusPlayer} style={{ "--team": color } as React.CSSProperties}>{player.avatarUrl ? <img src={player.avatarUrl} alt="" /> : <span className={`${styles.versusAvatar} ${styles.avatarFallback}`} style={{ display: "grid", placeItems: "center" }}>{player.name.slice(0, 2)}</span>}<div className={styles.versusName}>{player.name}</div></div>;
}

function BoardContent({ data }: { data: NonNullable<ReturnType<typeof useFeudGame>["data"]> }) {
  return <><div className={styles.question}><small>{data.round?.category || "Survey"}</small><h2>{data.round?.question || "Question incoming"}</h2></div><AnswerBoard answers={data.round?.board || []} broadcast /></>;
}
