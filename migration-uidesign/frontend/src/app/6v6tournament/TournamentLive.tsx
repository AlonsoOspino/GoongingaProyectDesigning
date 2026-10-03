"use client";

import { useEffect, useState } from "react";
import { activeTournamentMatch, tournamentTeam, type TournamentState } from "@/lib/6v6Tournament";
import styles from "./tournament-live.module.css";

function useTournament() {
  const [state, setState] = useState<TournamentState | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => { void fetch("/api/6v6", { cache: "no-store" }).then((response) => response.json()).then((data: TournamentState) => { if (live) setState(data); }).catch(() => undefined); };
    load();
    const interval = window.setInterval(load, 1500);
    return () => { live = false; window.clearInterval(interval); };
  }, []);
  return state;
}

function Logo({ url, name }: { url?: string; name: string }) {
  return <span className={styles.logo}>{url ? <img src={url} alt="" /> : <b>{name === "TBD" ? "?" : name.slice(0, 2).toUpperCase()}</b>}</span>;
}

export function TournamentHeader() {
  const state = useTournament();
  // The finals banner owns the top of the program frame so two OBS sources never overlap.
  if (!state || state.stage === "finals") return null;
  const match = activeTournamentMatch(state);
  if (!match) return null;
  const a = tournamentTeam(state, match.teamAId);
  const b = tournamentTeam(state, match.teamBId);
  const round = state.rounds.find((item) => item.id === match.roundId);
  return <div className={styles.headerPage} data-6v6-header>
    <div className={styles.header}>
      <div className={styles.headerMeta}><span>OT<span className={styles.red}>/</span>P</span><span>{round?.name.toUpperCase() || "6V6"}</span><span>BO3</span></div>
      <div className={styles.headerTeam}><Logo url={a?.logo} name={a?.name || "TBD"} /><strong>{a?.name || "TBD"}</strong></div>
      <div className={styles.headerScores}><b>{match.scoreA}</b><span>:</span><b>{match.scoreB}</b></div>
      <div className={`${styles.headerTeam} ${styles.headerTeamB}`}><strong>{b?.name || "TBD"}</strong><Logo url={b?.logo} name={b?.name || "TBD"} /></div>
    </div>
  </div>;
}

export function TournamentGeneralOverlay() {
  const state = useTournament();
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--overlay-width", "1920px");
    root.style.setProperty("--overlay-height", "1080px");
    return () => { root.style.removeProperty("--overlay-width"); root.style.removeProperty("--overlay-height"); };
  }, []);
  if (!state) return null;
  const active = activeTournamentMatch(state);
  const others = state.matches.filter((match) => match.roundId === state.activeRoundId && match.id !== active?.id).slice(0, 2);
  if (state.stage === "finals") {
    const a = active ? tournamentTeam(state, active.teamAId) : undefined;
    const b = active ? tournamentTeam(state, active.teamBId) : undefined;
    return <div className={styles.finals}>
      <div className={styles.finalsRail}>OVERTIME PRODUCTIONS <span>◆</span> 6V6 CHAMPIONSHIP</div>
      <div className={styles.finalsMain}><div className={styles.finalsTeam}><Logo url={a?.logo} name={a?.name || "TBD"} /><strong>{a?.name || "TBD"}</strong></div><div className={styles.finalsTitle}><small>THE LAST MATCH</small><b>FINALS</b><small>BO3 · {active?.scoreA || 0} : {active?.scoreB || 0}</small></div><div className={`${styles.finalsTeam} ${styles.finalsTeamB}`}><strong>{b?.name || "TBD"}</strong><Logo url={b?.logo} name={b?.name || "TBD"} /></div></div>
      <div className={styles.finalsLine} />
    </div>;
  }
  if (state.stage === "brackets") {
    const semis = state.matches.filter((match) => match.roundId === "bracket").slice(0, 2);
    const final = state.matches.find((match) => match.roundId === "final");
    const bracketTeam = (id: string) => tournamentTeam(state, id)?.name || "TBD";
    return <div className={styles.bracket}>
      <div className={styles.bracketHeading}><span>6V6 / PLAYOFFS</span><b>BRACKET</b></div>
      <div className={styles.bracketBody}>
        <div className={styles.bracketSemis}>{semis.map((match, index) => <div className={styles.bracketMatch} key={match.id}><small>SEMIFINAL {index + 1}</small><div><span>{bracketTeam(match.teamAId)}</span><b>{match.scoreA}</b></div><div><span>{bracketTeam(match.teamBId)}</span><b>{match.scoreB}</b></div></div>)}</div>
        <svg className={styles.bracketLines} viewBox="0 0 60 174" aria-hidden="true"><path d="M0 44 H27 V87 H60 M0 130 H27 V87" fill="none" stroke="#969696" strokeWidth="2" /></svg>
        <div className={styles.bracketFinal}><small>CHAMPIONSHIP</small><div><span>{bracketTeam(final?.teamAId || "")}</span><b>{final?.scoreA || 0}</b></div><div><span>{bracketTeam(final?.teamBId || "")}</span><b>{final?.scoreB || 0}</b></div></div>
      </div>
    </div>;
  }
  if (!others.length) return null;
  return <div className={styles.otherResults}><div className={styles.otherHeading}><span className={styles.liveDot} /> OTROS PARTIDOS <span>{state.rounds.find((round) => round.id === state.activeRoundId)?.name.toUpperCase()}</span></div>{others.map((match) => {
    const a = tournamentTeam(state, match.teamAId);
    const b = tournamentTeam(state, match.teamBId);
    return <div className={styles.otherMatch} key={match.id}><div className={styles.otherTeam}><Logo url={a?.logo} name={a?.name || "TBD"} /><span>{a?.name || "TBD"}</span><b>{match.scoreA}</b></div><div className={styles.otherVs}>VS</div><div className={styles.otherTeam}><Logo url={b?.logo} name={b?.name || "TBD"} /><span>{b?.name || "TBD"}</span><b>{match.scoreB}</b></div></div>;
  })}</div>;
}
