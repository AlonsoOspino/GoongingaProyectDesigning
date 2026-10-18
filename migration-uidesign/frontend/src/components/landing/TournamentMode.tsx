"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCurrentTournament } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { getLeaderboard } from "@/lib/api/team";
import { getMatchesByTournament } from "@/lib/api/match";
import type { Team, Tournament } from "@/lib/api/types";
import { resolveGenericBackendAsset } from "@/lib/assetUrls";
import { matchesSeasonNumber, resolveSeasonLabel } from "@/features/tournament/seasonIdentity";
import { filterMatchesByDivision } from "@/features/tournament/divisions";
import { pickTournamentPhase, type TournamentPhase } from "@/features/tournament/featuredMatch";
import { ArrowIcon, TWITCH_URL, TwitchIcon } from "./brandAssets";
import styles from "./tournament-mode.module.css";

interface Loaded {
  tournament: Tournament | null;
  teams: Team[];
  matches: Tournament["matches"];
}

const labels: Record<TournamentPhase["kind"], string> = {
  "coming-soon": "Season updates",
  preparation: "Season preparation",
  complete: "Season complete",
  "next-match": "Up next",
  live: "Live now",
  "latest-result": "Latest result",
  preview: "On the schedule",
};

function TeamIdentity({ team, side }: { team?: Team; side: "a" | "b" }) {
  const [failedSource, setFailedSource] = useState("");
  const logo = resolveGenericBackendAsset(team?.logo);
  const name = team?.name || "Team to be confirmed";
  return (
    <div className={styles.team} data-side={side}>
      <div className={styles.logoPlate}>
        {logo && failedSource !== logo ? (
          <img className={styles.logo} src={logo} alt={`${name} logo`} decoding="async" onError={() => setFailedSource(logo)} />
        ) : (
          <span className={styles.logoFallback} aria-hidden="true">{team?.name?.slice(0, 2).toUpperCase() || "?"}</span>
        )}
      </div>
      <strong className={styles.teamName} title={name}>{name}</strong>
    </div>
  );
}

function countdownUnits(target: string | null, now: number) {
  if (!target) return null;
  const ms = Date.parse(target) - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return [
    { value: Math.floor(ms / 86400000), label: "Days" },
    { value: Math.floor((ms % 86400000) / 3600000), label: "Hrs" },
    { value: Math.floor((ms % 3600000) / 60000), label: "Min" },
    { value: Math.floor((ms % 60000) / 1000), label: "Sec" },
  ];
}

function formatMatchDate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Match time to be confirmed";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(value));
}

export default function TournamentMode({ standalone = false }: { standalone?: boolean }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState(false);
  const [divisionFilter, setDivisionFilter] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let mounted = true;
    let fetching = false;
    const load = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const tournament = await getCurrentTournament({ cache: "no-store" });
        if (!matchesSeasonNumber(tournament, 9)) {
          if (mounted) { setLoaded({ tournament: null, teams: [], matches: [] }); setError(false); }
          return;
        }
        const [teams, matches] = await Promise.all([getLeaderboard(tournament.id), getMatchesByTournament(tournament.id)]);
        if (mounted) {
          setLoaded({ tournament, teams, matches });
          setError(false);
        }
      } catch (reason) {
        if (!mounted) return;
        if (reason instanceof ApiError && reason.status === 404) {
          setLoaded({ tournament: null, teams: [], matches: [] });
          setError(false);
        } else setError(true);
      } finally {
        fetching = false;
      }
    };
    void load();
    const poll = window.setInterval(load, 20000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted = false;
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, []);

  const tournament = loaded?.tournament ?? null;
  const divisions = useMemo(() => [...(tournament?.divisions ?? [])]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id), [tournament]);
  const selectedDivision = divisions.find((division) => division.id === divisionFilter);
  const divisionId = selectedDivision?.id ?? null;
  const teamsById = useMemo(() => new Map((loaded?.teams ?? []).map((team) => [team.id, team])), [loaded]);
  const fixtures = useMemo(() => filterMatchesByDivision(loaded?.matches ?? [], loaded?.teams ?? [], divisionId), [loaded, divisionId]);
  const phase = pickTournamentPhase(tournament, fixtures, now);
  const match = "match" in phase ? phase.match : null;
  const teamA = match ? teamsById.get(match.teamAId) : undefined;
  const teamB = match ? teamsById.get(match.teamBId) : undefined;
  const seasonLabel = tournament ? resolveSeasonLabel(tournament) : "Season 9";
  const matchDivision = match?.divisionName
    || (teamA?.divisionId != null && teamA.divisionId === teamB?.divisionId
      ? divisions.find((division) => division.id === teamA.divisionId)?.name : null);
  const target = phase.kind === "next-match" ? phase.at : phase.kind === "preparation" ? phase.at : null;
  const countdown = countdownUnits(target, now);
  const finals = match?.type === "FINALS";
  const showScore = phase.kind === "live" || phase.kind === "latest-result";
  const divisionQuery = divisionId != null ? `?division=${divisionId}` : "";
  const scheduleHref = `/schedule${divisionQuery}`;
  const loading = !loaded && !error;

  return (
    <section className={`${styles.section} ${standalone ? styles.standalone : ""}`} aria-label="GGL tournament announcement" data-tournament-announcement>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Overtime GGL</p>
          <h2 className={styles.sectionTitle}>{seasonLabel}</h2>
        </div>
        <Link href={scheduleHref} className={styles.scheduleLink}>Schedule & results <ArrowIcon /></Link>
      </div>

      {divisions.length > 0 && (
        <div className={styles.divisions} role="group" aria-label="Featured match division">
          <button type="button" aria-pressed={divisionId === null} onClick={() => setDivisionFilter(null)}>All divisions</button>
          {divisions.map((division) => (
            <button key={division.id} type="button" aria-pressed={divisionId === division.id} onClick={() => setDivisionFilter(division.id)}>{division.name}</button>
          ))}
        </div>
      )}

      <article className={styles.card} data-finals={finals || undefined} data-kind={phase.kind} data-testid="tournament-card" aria-busy={loading}>
        <div className={styles.cardHeader}>
          <span className={styles.brand}>GGL <span>Tournament</span></span>
          <span className={styles.status} data-live={phase.kind === "live" || undefined}>
            <i aria-hidden="true" />{loading ? "Loading season" : error && !loaded ? "Season updates" : labels[phase.kind]}
          </span>
        </div>

        {match ? (
          <>
            <div className={styles.matchHeading}>
              <p>{[matchDivision, match.semanas != null ? `Week ${match.semanas}` : null, finals ? "Grand Final" : null].filter(Boolean).join(" · ") || seasonLabel}</p>
              <span>{match.title || (match.type === "ROUNDROBIN" ? "Regular season" : match.type.replaceAll("_", " "))} · Best of {match.bestOf}</span>
            </div>
            <div className={styles.matchup} aria-label={`${teamA?.name ?? "Team to be confirmed"} versus ${teamB?.name ?? "Team to be confirmed"}`}>
              <TeamIdentity team={teamA} side="a" />
              <div className={styles.matchCenter}>
                {showScore ? <strong className={styles.score}>{match.mapWinsTeamA}<span>:</span>{match.mapWinsTeamB}</strong> : <span className={styles.versus}>VS</span>}
                <span className={styles.scoreLabel}>{phase.kind === "live" ? "LIVE" : phase.kind === "latest-result" ? "FINAL" : "OVERWATCH 5v5"}</span>
              </div>
              <TeamIdentity team={teamB} side="b" />
            </div>
          </>
        ) : (
          <div className={styles.seasonCopy}>
            <p>{selectedDivision?.name || "Overwatch community league"}</p>
            <h3>{loading ? "Getting ready" : error && !loaded ? "Stay connected" : seasonLabel}</h3>
            <span>{loading ? "Loading the latest season information." : error && !loaded ? "Season information is temporarily unavailable." : phase.kind === "complete" ? "The season is complete. Explore the teams, standings and results." : selectedDivision ? "This division's matches will appear here when the schedule is published." : "Teams, weekly matches and results. Follow every division here."}</span>
          </div>
        )}

        <div className={styles.cardFooter}>
          {countdown ? (
            <div className={styles.countdown} aria-label={match ? "Time until next match" : "Time until season starts"}>
              <span className={styles.countdownLabel}>{match ? "Starts in" : "Season starts in"}</span>
              <div className={styles.clock}>
                {countdown.map((unit) => <span className={styles.clockUnit} key={unit.label}><strong>{String(unit.value).padStart(2, "0")}</strong><span>{unit.label}</span></span>)}
              </div>
            </div>
          ) : (
            <div className={styles.dateLine}>
              <span>{match ? phase.kind === "next-match" ? "Awaiting start" : phase.kind === "latest-result" ? "Match result" : phase.kind === "live" ? "On stream" : "Match day" : "Follow the season"}</span>
              {match ? <time dateTime={Number.isFinite(Date.parse(match.startDate)) ? match.startDate : undefined}>{formatMatchDate(match.startDate)}</time> : <strong>Every team. Every division.</strong>}
            </div>
          )}
          <Link href={match ? `/schedule/${match.id}` : "/season-9"} className={styles.cardLink}>
            {match ? phase.kind === "latest-result" ? "View result" : phase.kind === "live" ? "Open live match" : "Match details" : "Explore the season"}<ArrowIcon />
          </Link>
        </div>
      </article>

      <div className={styles.links}>
        <Link href={`/teams${divisionQuery}`}>Meet the teams <ArrowIcon size={14} /></Link>
        {phase.kind === "live" ? <a href={TWITCH_URL} target="_blank" rel="noopener noreferrer"><TwitchIcon size={14} /> Watch live</a> : <Link href={`/standings${divisionQuery}`}>Division standings <ArrowIcon size={14} /></Link>}
      </div>
      {error && loaded ? <p className={styles.refreshNotice} role="status">Updates are reconnecting. Showing the last available schedule.</p> : null}
    </section>
  );
}
