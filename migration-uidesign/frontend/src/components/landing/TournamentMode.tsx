"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCurrentTournament } from "@/lib/api/admin";
import { getLeaderboard } from "@/lib/api/team";
import { getMatches } from "@/lib/api/match";
import type { Match, Team, Tournament } from "@/lib/api/types";
import styles from "./tournament-mode.module.css";

/*
 * The automatic tournament announcement.
 *
 * Nobody writes this. It reads the live tournament state and shows the one
 * thing that matters at that moment, following a fixed set of rules:
 *
 *   no live season   -> "Next season coming soon"
 *   scheduled        -> countdown to the season start
 *   in play          -> countdown to the next match, or the latest result, or a
 *                       taste of the nearest week if neither exists
 *   grand final      -> the same, but staged bigger
 *
 * Data is scoped to the current tournament so the developer sandbox season can
 * never leak onto the homepage.
 */

type Phase =
  | { kind: "coming-soon" }
  | { kind: "starts-in"; at: string }
  | { kind: "next-match"; match: Match; at: string }
  | { kind: "live"; match: Match }
  | { kind: "latest-result"; match: Match }
  | { kind: "preview"; match: Match };

interface Loaded {
  tournament: Tournament;
  phase: Phase;
  teamsById: Map<number, Team>;
  finals: boolean;
}

const POLL_MS = 20000;
const IN_PLAY = new Set(["ROUNDROBIN", "PLAYOFFS", "SEMIFINALS", "FINALS"]);

function pickPhase(tournament: Tournament, matches: Match[]): Phase {
  const state = tournament.state;

  if (state === "SCHEDULED") {
    return tournament.startDate
      ? { kind: "starts-in", at: tournament.startDate }
      : { kind: "coming-soon" };
  }

  if (!IN_PLAY.has(state)) return { kind: "coming-soon" };

  const live = matches.find((m) => m.status === "ACTIVE");
  if (live) return { kind: "live", match: live };

  const nextScheduled = matches
    .filter((m) => m.status === "SCHEDULED" && m.startDate)
    .sort(
      (a, b) => new Date(a.startDate as string).getTime() - new Date(b.startDate as string).getTime()
    )[0];
  if (nextScheduled) return { kind: "next-match", match: nextScheduled, at: nextScheduled.startDate as string };

  const lastFinished = matches
    .filter((m) => m.status === "FINISHED")
    .sort((a, b) => (b.gameNumber || 0) - (a.gameNumber || 0))[0];
  if (lastFinished) return { kind: "latest-result", match: lastFinished };

  // Nothing scheduled and nothing played: show a match from the nearest week.
  const nearest = matches
    .filter((m) => Number.isFinite(m.semanas))
    .sort((a, b) => (a.semanas || 0) - (b.semanas || 0))[0];
  if (nearest) return { kind: "preview", match: nearest };

  return { kind: "coming-soon" };
}

function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (!target) return null;
  const ms = new Date(target).getTime() - now;
  if (!Number.isFinite(ms)) return null;
  const clamped = Math.max(0, ms);
  const days = Math.floor(clamped / 86400000);
  const hours = Math.floor((clamped % 86400000) / 3600000);
  const mins = Math.floor((clamped % 3600000) / 60000);
  const secs = Math.floor((clamped % 60000) / 1000);
  return { days, hours, mins, secs, done: ms <= 0 };
}

export default function TournamentMode() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const tournament = await getCurrentTournament();
        const finished = tournament.state === "FINISHED";
        const [standings, matches] = await Promise.all([
          getLeaderboard(tournament.id).catch(() => [] as Team[]),
          getMatches().catch(() => [] as Match[]),
        ]);
        if (!mounted) return;
        const seasonMatches = matches.filter((m) => m.tournamentId === tournament.id);
        const teamsById = new Map(standings.map((t) => [t.id, t] as const));
        const phase = finished ? ({ kind: "coming-soon" } as Phase) : pickPhase(tournament, seasonMatches);
        setLoaded({ tournament, phase, teamsById, finals: tournament.state === "FINALS" });
      } catch {
        if (mounted) setLoaded(null);
      }
    };
    void load();
    const poll = window.setInterval(load, POLL_MS);
    return () => {
      mounted = false;
      window.clearInterval(poll);
    };
  }, []);

  const countdownTarget = useMemo(() => {
    if (!loaded) return null;
    if (loaded.phase.kind === "starts-in") return loaded.phase.at;
    if (loaded.phase.kind === "next-match") return loaded.phase.at;
    return null;
  }, [loaded]);

  const countdown = useCountdown(countdownTarget);

  if (!loaded) return null;

  const { phase, teamsById, finals } = loaded;
  const teamName = (id: number) => teamsById.get(id)?.name ?? "TBD";

  const matchup = (m: Match) => (
    <p className={styles.matchup}>
      <span className={styles.teamA}>{teamName(m.teamAId)}</span>
      <span className={styles.versus}>vs</span>
      <span className={styles.teamB}>{teamName(m.teamBId)}</span>
    </p>
  );

  const clock = countdown ? (
    <div className={styles.clock} aria-hidden="false">
      {[
        { v: countdown.days, l: "Days" },
        { v: countdown.hours, l: "Hrs" },
        { v: countdown.mins, l: "Min" },
        { v: countdown.secs, l: "Sec" },
      ].map((u) => (
        <span key={u.l} className={styles.clockUnit}>
          <span className={styles.clockValue}>{String(u.v).padStart(2, "0")}</span>
          <span className={styles.clockLabel}>{u.l}</span>
        </span>
      ))}
    </div>
  ) : null;

  return (
    <section
      className={styles.section}
      data-finals={finals ? "true" : "false"}
      data-kind={phase.kind}
      aria-label="Tournament status"
    >
      <div className={styles.inner}>
        <p className={styles.eyebrow}>
          <span className={styles.dot} aria-hidden="true" />
          {finals ? "Grand Final" : "Overtime GGL"}
        </p>

        {phase.kind === "coming-soon" && (
          <>
            <h2 className={styles.headline}>Next season</h2>
            <p className={styles.subhead}>Coming soon</p>
            <p className={styles.note}>The next season is being drawn up. New teams, new schedule.</p>
          </>
        )}

        {phase.kind === "starts-in" && (
          <>
            <h2 className={styles.headline}>Season starts in</h2>
            {clock}
            <Link href="/schedule" className={styles.link}>
              See the schedule
            </Link>
          </>
        )}

        {phase.kind === "next-match" && (
          <>
            <p className={styles.kicker}>Next match</p>
            {matchup(phase.match)}
            {clock}
            <Link href="/schedule" className={styles.link}>
              Full schedule
            </Link>
          </>
        )}

        {phase.kind === "live" && (
          <>
            <p className={styles.kicker} data-live="true">
              <span className={styles.liveDot} aria-hidden="true" /> Playing now
            </p>
            {matchup(phase.match)}
            <p className={styles.score}>
              {phase.match.mapWinsTeamA} <span>–</span> {phase.match.mapWinsTeamB}
            </p>
          </>
        )}

        {phase.kind === "latest-result" && (
          <>
            <p className={styles.kicker}>Latest result</p>
            {matchup(phase.match)}
            <p className={styles.score}>
              {phase.match.mapWinsTeamA} <span>–</span> {phase.match.mapWinsTeamB}
            </p>
            <Link href="/history?tab=results" className={styles.link}>
              All results
            </Link>
          </>
        )}

        {phase.kind === "preview" && (
          <>
            <p className={styles.kicker}>Week {phase.match.semanas ?? "?"} · Coming soon</p>
            {matchup(phase.match)}
            <Link href="/schedule" className={styles.link}>
              Full schedule
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
