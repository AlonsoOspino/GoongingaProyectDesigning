"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readNetworkSessionToken, readNetworkSessionUser } from "@/features/networkSession/storage";
import { initialTournamentState, tournamentTeam, type TournamentMatch, type TournamentStage, type TournamentState } from "@/lib/6v6Tournament";
import styles from "./tournament-manager.module.css";

const urls = [
  ["Manager", "/6v6tournament/manager"],
  ["Header · OBS", "/header/6v6"],
  ["Resultados · OBS", "/overlay/6v6"],
] as const;

export default function TournamentManagerPage() {
  const [state, setState] = useState<TournamentState>(initialTournamentState);
  const stateRef = useRef(state);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const [saveStatus, setSaveStatus] = useState("Cargando…");
  const [operator, setOperator] = useState("");
  const [copied, setCopied] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    setOperator(readNetworkSessionUser()?.username || "");
    fetch("/api/6v6", { cache: "no-store" })
      .then((response) => response.json())
      .then((loaded: TournamentState) => { stateRef.current = loaded; setState(loaded); setSaveStatus("Listo"); })
      .catch(() => setSaveStatus("No se pudo cargar el torneo"));
  }, []);

  const update = useCallback((change: (current: TournamentState) => TournamentState) => {
    const next = change(stateRef.current);
    stateRef.current = next;
    setState(next);
    setSaveStatus("Guardando…");
    queueRef.current = queueRef.current.catch(() => undefined).then(async () => {
      const token = readNetworkSessionToken();
      if (!token) throw new Error("Inicia sesión para guardar cambios.");
      const response = await fetch("/api/6v6", {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error((await response.json()).error || "No se pudo guardar.");
      if (stateRef.current === next) setSaveStatus("En vivo · guardado");
    }).catch((error: Error) => setSaveStatus(error.message));
  }, []);

  const patchMatch = (id: string, change: Partial<TournamentMatch>) => update((current) => ({
    ...current, matches: current.matches.map((match) => match.id === id ? { ...match, ...change } : match),
  }));

  const chooseStage = (stage: TournamentStage) => update((current) => {
    const round = current.rounds.find((item) => item.stage === stage);
    const match = current.matches.find((item) => item.roundId === round?.id);
    return { ...current, stage, activeRoundId: round?.id || current.activeRoundId, spectatedMatchId: match?.id || "" };
  });

  const chooseRound = (roundId: string) => update((current) => ({
    ...current, activeRoundId: roundId,
    spectatedMatchId: current.matches.find((match) => match.roundId === roundId)?.id || "",
  }));

  const uploadLogo = async (teamId: string, file?: File) => {
    if (!file) return;
    const token = readNetworkSessionToken();
    if (!token) { setSaveStatus("Inicia sesión para subir logos."); return; }
    setSaveStatus("Subiendo logo…");
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch("/api/6v6/logo", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo subir el logo.");
      update((current) => ({ ...current, teams: current.teams.map((team) => team.id === teamId ? { ...team, logo: data.url } : team) }));
    } catch (error) { setSaveStatus((error as Error).message); }
  };

  const addTeam = () => update((current) => ({ ...current, teams: [...current.teams, { id: crypto.randomUUID(), name: "Nuevo equipo", logo: "" }] }));
  const addMatch = () => update((current) => {
    if (current.matches.filter((match) => match.roundId === current.activeRoundId).length >= 3) return current;
    return { ...current, matches: [...current.matches, { id: crypto.randomUUID(), roundId: current.activeRoundId, teamAId: "", teamBId: "", scoreA: 0, scoreB: 0 }] };
  });

  const copy = async (path: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(path);
    window.setTimeout(() => setCopied(""), 1800);
  };

  const activeRound = state.rounds.find((round) => round.id === state.activeRoundId);
  const visibleMatches = state.matches.filter((match) => match.roundId === state.activeRoundId);

  return <main className={styles.page}>
    <div className={styles.wrap}>
      <header className={styles.top}>
        <div><span className={styles.eyebrow}>OVERTIME PRODUCTIONS / CONTROL ROOM</span><h1>6V6 TOURNAMENT</h1><p>Control en vivo para OBS · BO3 por partido</p></div>
        <div className={styles.status}><span className={styles.dot} />{saveStatus}{operator && <small>{operator}</small>}</div>
      </header>

      {!operator && <div className={styles.notice}>Para guardar cambios, inicia sesión con una cuenta de producción. <a href="/login">Ir a login →</a></div>}

      <section className={styles.links} aria-label="Enlaces para OBS">
        <div className={styles.sectionTitle}><span>01</span><h2>Links listos para pegar</h2></div>
        <div className={styles.linkGrid}>{urls.map(([label, path]) => <div className={styles.linkCard} key={path}><span>{label}</span><code>{origin ? `${origin}${path}` : path}</code><div><button onClick={() => void copy(path)}>{copied === path ? "Copiado ✓" : "Copiar URL"}</button><a href={path} target="_blank" rel="noreferrer">Abrir ↗</a></div></div>)}</div>
        <p className={styles.hint}>Fuentes de navegador OBS: 1920 × 1080, fondo transparente. Usa header y resultados como dos fuentes separadas.</p>
      </section>

      <section className={styles.control}>
        <div className={styles.sectionTitle}><span>02</span><h2>Etapa y ronda al aire</h2></div>
        <div className={styles.stageTabs}>{(["rounds", "brackets", "finals"] as const).map((stage) => <button key={stage} className={state.stage === stage ? styles.selected : ""} onClick={() => chooseStage(stage)}>{stage === "rounds" ? "ROUNDS" : stage === "brackets" ? "BRACKETS" : "FINALS"}</button>)}</div>
        <div className={styles.roundRow}><label>Ronda visible<select value={state.activeRoundId} onChange={(event) => chooseRound(event.target.value)}>{state.rounds.filter((round) => round.stage === state.stage).map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}</select></label><label>Descansan / sit<input value={activeRound?.sit || ""} onChange={(event) => update((current) => ({ ...current, rounds: current.rounds.map((round) => round.id === current.activeRoundId ? { ...round, sit: event.target.value } : round) }))} /></label></div>
      </section>

      <section className={styles.control}>
        <div className={styles.sectionTitle}><span>03</span><h2>Partidos simultáneos</h2><p>Selecciona el que estás espectando. Los otros aparecen pequeños a la derecha.</p></div>
        <div className={styles.matchGrid}>{visibleMatches.map((match, index) => <article className={`${styles.matchCard} ${state.spectatedMatchId === match.id ? styles.onAir : ""}`} key={match.id}>
          <div className={styles.matchTop}><span>MATCH {String(index + 1).padStart(2, "0")}</span><button onClick={() => update((current) => ({ ...current, spectatedMatchId: match.id }))}>{state.spectatedMatchId === match.id ? "● EN CÁMARA" : "○ SPECTEAR"}</button></div>
          <div className={styles.matchTeam}><select aria-label="Equipo A" value={match.teamAId} onChange={(event) => patchMatch(match.id, { teamAId: event.target.value })}><option value="">TBD / Elegir equipo</option>{state.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><div className={styles.score}><button onClick={() => patchMatch(match.id, { scoreA: Math.max(0, match.scoreA - 1) })}>−</button><strong>{match.scoreA}</strong><button onClick={() => patchMatch(match.id, { scoreA: Math.min(99, match.scoreA + 1) })}>+</button></div></div>
          <div className={styles.vs}>VS <span>BEST OF 3</span></div>
          <div className={styles.matchTeam}><select aria-label="Equipo B" value={match.teamBId} onChange={(event) => patchMatch(match.id, { teamBId: event.target.value })}><option value="">TBD / Elegir equipo</option>{state.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><div className={styles.score}><button onClick={() => patchMatch(match.id, { scoreB: Math.max(0, match.scoreB - 1) })}>−</button><strong>{match.scoreB}</strong><button onClick={() => patchMatch(match.id, { scoreB: Math.min(99, match.scoreB + 1) })}>+</button></div></div>
          <div className={styles.matchFooter}><span>{tournamentTeam(state, match.teamAId)?.name || "TBD"} vs {tournamentTeam(state, match.teamBId)?.name || "TBD"}</span><button onClick={() => patchMatch(match.id, { scoreA: 0, scoreB: 0 })}>Reset score</button></div>
        </article>)}</div>
        {visibleMatches.length < 3 && <button className={styles.addButton} onClick={addMatch}>+ Añadir partido a esta ronda</button>}
      </section>

      <section className={styles.control}>
        <div className={styles.sectionTitle}><span>04</span><h2>Equipos y logos</h2><p>Los cambios de nombre y logo se reflejan en ambos overlays.</p></div>
        <div className={styles.teamGrid}>{state.teams.map((team) => <div className={styles.teamCard} key={team.id}><div className={styles.logo}>{team.logo ? <img src={team.logo} alt="" /> : <span>{team.name.slice(0, 2).toUpperCase()}</span>}</div><div className={styles.teamFields}><input aria-label="Nombre del equipo" value={team.name} maxLength={80} onChange={(event) => update((current) => ({ ...current, teams: current.teams.map((item) => item.id === team.id ? { ...item, name: event.target.value } : item) }))} /><label className={styles.upload}>Subir logo<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void uploadLogo(team.id, event.target.files?.[0])} /></label></div></div>)}</div>
        <button className={styles.addButton} onClick={addTeam}>+ Añadir equipo</button>
      </section>
    </div>
  </main>;
}
