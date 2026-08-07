"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Match, Team } from "@/lib/api/types";
import { resolveGenericBackendAsset } from "@/lib/assetUrls";
import { getSeriesLength } from "@/lib/match-format";
import { getCurrentTournament } from "@/lib/api/admin";
import { getGoongingaWrapped, resolveWrappedAssets, type WrappedSoundtrackTrack } from "@/lib/api/wrapped";
import styles from "./finals.module.css";

type PresentationPhase = "countdown" | "wrapped" | "waiting";

function initials(name?: string) {
  return (name || "TBD").split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase();
}

function StageLogo({ team, side }: { team?: Team; side: "a" | "b" }) {
  const [logoFailed, setLogoFailed] = useState(!team?.logo);
  return (
    <div className={`${styles.stageTeam} ${styles[`stageTeam${side.toUpperCase()}`]}`}>
      <div className={styles.stageLogoShell}>
        {team?.logo && !logoFailed ? (
          <img src={resolveGenericBackendAsset(team.logo)} alt={`${team.name} logo`} onError={() => setLogoFailed(true)} />
        ) : <span aria-label={`${team?.name || "Finalist"} logo`}>{initials(team?.name)}</span>}
      </div>
      <strong>{team?.name || "FINALIST TBD"}</strong>
    </div>
  );
}

function countdownParts(target: number, now: number) {
  const total = Math.max(0, Math.floor((target - now) / 1000));
  return [
    ["DAYS", Math.floor(total / 86400)],
    ["HOURS", Math.floor((total % 86400) / 3600)],
    ["MINUTES", Math.floor((total % 3600) / 60)],
    ["SECONDS", total % 60],
  ] as const;
}

export function FinalsPresentationStage({
  match,
  teamA,
  teamB,
  isManager,
  children,
}: {
  match: Match;
  teamA?: Team;
  teamB?: Team;
  isManager: boolean;
  children: ReactNode;
}) {
  const [now, setNow] = useState<number | null>(null);
  const [tournamentState, setTournamentState] = useState<string | null>(null);
  const [countdownTrack, setCountdownTrack] = useState<WrappedSoundtrackTrack | null>(null);
  const [countdownMetadataDuration, setCountdownMetadataDuration] = useState<number | null>(null);
  const countdownAudioRef = useRef<HTMLAudioElement>(null);
  const countdownStartedKeyRef = useRef<string | null>(null);
  const effectiveStart = match.presentationStartDate || match.startDate;
  const startMs = useMemo(() => {
    if (!effectiveStart) return null;
    const parsed = new Date(effectiveStart).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }, [effectiveStart]);
  const presentationKey = `${match.id}:${match.presentationVersion || 0}:${startMs || "soon"}`;
  const [phase, setPhase] = useState<PresentationPhase>("countdown");

  useEffect(() => {
    const completedKey = window.sessionStorage.getItem(`ggl-finals-complete:${match.id}`);
    if (startMs === null || startMs > Date.now()) setPhase("countdown");
    else setPhase(completedKey === presentationKey ? "waiting" : "wrapped");
  }, [match.id, presentationKey, startMs]);

  useEffect(() => {
    let cancelled = false;
    const loadFinalsState = async () => {
      const [tournament, wrapped] = await Promise.all([
        getCurrentTournament({ cache: "no-store" }).catch(() => null),
        getGoongingaWrapped().catch(() => null),
      ]);
      if (cancelled) return;
      setTournamentState(tournament?.state || null);
      setCountdownTrack(wrapped ? resolveWrappedAssets(wrapped.assets).soundtrack.countdown || null : null);
    };
    void loadFinalsState();
    const timer = window.setInterval(loadFinalsState, 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (phase === "countdown" && startMs !== null && now !== null && now >= startMs) setPhase("wrapped");
  }, [now, phase, startMs]);

  useEffect(() => {
    const audio = countdownAudioRef.current;
    if (!audio) return;
    countdownStartedKeyRef.current = null;
    audio.pause();
    try { audio.currentTime = 0; } catch { /* metadata can still be loading */ }
  }, [presentationKey, countdownTrack?.url]);

  useEffect(() => {
    const audio = countdownAudioRef.current;
    if (!audio || !countdownTrack || phase !== "countdown" || startMs === null || now === null || tournamentState !== "FINALS") {
      if (audio && phase !== "countdown") audio.pause();
      return;
    }
    const remainingSeconds = (startMs - now) / 1000;
    const duration = countdownTrack.durationSeconds || countdownMetadataDuration;
    if (!duration || remainingSeconds <= 0 || remainingSeconds > duration) return;
    if (countdownStartedKeyRef.current === presentationKey) return;

    countdownStartedKeyRef.current = presentationKey;
    audio.loop = false;
    audio.volume = 1;
    try {
      audio.currentTime = Math.min(Math.max(0, duration - remainingSeconds), Math.max(0, duration - 0.05));
    } catch {
      countdownStartedKeyRef.current = null;
      return;
    }
    void audio.play().catch(() => {
      // A browser can briefly reject autoplay while the route is settling.
      // Clear the marker so the next countdown tick can retry.
      countdownStartedKeyRef.current = null;
    });
  }, [countdownMetadataDuration, countdownTrack, now, phase, presentationKey, startMs, tournamentState]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== "goonginga-wrapped-complete") return;
      window.sessionStorage.setItem(`ggl-finals-complete:${match.id}`, presentationKey);
      setPhase("waiting");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [match.id, presentationKey]);

  if (tournamentState !== "FINALS") {
    return (
      <div className={styles.presentationOverlay}>
        <div className={styles.countdownStage}>
          <div className={styles.stageGrid} aria-hidden="true" />
          <p className={styles.stageKicker}>GOONGINGA LEAGUE</p>
          <div className={styles.stageSoon}>FINALS EXPERIENCE <strong>LOCKED</strong></div>
          <p className={styles.stageFooter}>AVAILABLE WHEN THE TOURNAMENT ENTERS FINALS</p>
        </div>
      </div>
    );
  }

  if (phase === "waiting") return <>{children}</>;

  if (phase === "wrapped") {
    return (
      <div className={styles.presentationOverlay}>
        <iframe className={styles.wrappedFrame} src={`/finals?autostart=finals&revision=${match.presentationVersion || 0}`} title="Goonginga League Finals recap" allow="autoplay" />
        {isManager && (
          <button
            type="button"
            className={styles.skipButton}
            onClick={() => {
              window.sessionStorage.setItem(`ggl-finals-complete:${match.id}`, presentationKey);
              setPhase("waiting");
            }}
          >
            SKIP TO CAPTAIN CHECK-IN
          </button>
        )}
      </div>
    );
  }

  const parts = startMs === null || now === null ? null : countdownParts(startMs, now);
  return (
    <div className={styles.presentationOverlay}>
      {countdownTrack?.url && (
        <audio
          ref={countdownAudioRef}
          src={countdownTrack.url}
          preload="auto"
          onLoadedMetadata={(event) => {
            const duration = event.currentTarget.duration;
            setCountdownMetadataDuration(Number.isFinite(duration) && duration > 0 ? duration : null);
          }}
        />
      )}
      <div className={styles.countdownStage}>
        <div className={styles.stageGrid} aria-hidden="true" />
        <p className={styles.stageKicker}>GOONGINGA LEAGUE · GRAND FINAL</p>
        <div className={styles.stageVersus}>
          <StageLogo team={teamA} side="a" />
          <div className={styles.stageVs}><span>BEST OF {getSeriesLength(match)}</span><strong>VS</strong></div>
          <StageLogo team={teamB} side="b" />
        </div>
        {parts ? (
          <div className={styles.stageCountdown}>
            {parts.map(([label, value]) => <div key={label}><b>{String(value).padStart(2, "0")}</b><small>{label}</small></div>)}
          </div>
        ) : (
          <div className={styles.stageSoon}>FINALS BEGIN <strong>SOON</strong></div>
        )}
        <p className={styles.stageFooter}>THE SEASON ENDS HERE</p>
      </div>
    </div>
  );
}
