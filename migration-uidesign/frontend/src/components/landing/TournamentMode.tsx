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
import { pickTournamentPhase } from "@/features/tournament/featuredMatch";
import { ArrowIcon, TWITCH_URL, TwitchIcon } from "./brandAssets";
import styles from "./tournament-mode.module.css";

export interface TournamentAnnouncementData {
  tournament: Tournament | null;
  teams: Team[];
  matches: Tournament["matches"];
}

function TeamIdentity({ team, side }: { team?: Team; side: "a" | "b" }) {
  const [failedSource, setFailedSource] = useState("");
  const logo = team?.logo?.startsWith("/history/") ? team.logo : resolveGenericBackendAsset(team?.logo);
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

export default function TournamentMode({ standalone = false, previewData }: { standalone?: boolean; previewData?: TournamentAnnouncementData }) {
  const [remoteData, setLoaded] = useState<TournamentAnnouncementData | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const isDevelopmentPreview = process.env.NODE_ENV === "development" && previewData !== undefined;
  const loaded = isDevelopmentPreview ? previewData ?? null : remoteData;

  useEffect(() => {
    if (isDevelopmentPreview) return;
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
    return () => {
      mounted = false;
      window.clearInterval(poll);
    };
  }, [isDevelopmentPreview]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  const tournament = loaded?.tournament ?? null;
  const divisions = useMemo(() => [...(tournament?.divisions ?? [])]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id), [tournament]);
  const teamsById = useMemo(() => new Map((loaded?.teams ?? []).map((team) => [team.id, team])), [loaded]);
  const phase = pickTournamentPhase(tournament, loaded?.matches ?? [], now);
  const match = "match" in phase ? phase.match : null;
  const teamA = match ? teamsById.get(match.teamAId) : undefined;
  const teamB = match ? teamsById.get(match.teamBId) : undefined;
  const seasonLabel = tournament ? resolveSeasonLabel(tournament) : "Season 9";
  const matchDivision = match?.divisionName
    || (teamA?.divisionId != null && teamA.divisionId === teamB?.divisionId
      ? divisions.find((division) => division.id === teamA.divisionId)?.name : null);
  const target = phase.kind === "next-match" ? phase.at : phase.kind === "preparation" ? phase.at : null;
  const countdown = countdownUnits(target, now);
  const seasonCountdown = Boolean(countdown && !match);
  const finals = match?.type === "FINALS";
  const showScore = phase.kind === "live" || phase.kind === "latest-result";
  const loading = !loaded && !error;

  return (
    <section className={`${styles.section} ${standalone ? styles.standalone : ""}`} aria-label="GGL tournament announcement" data-tournament-announcement>
      <div className={styles.heading}>
        <Link href="/schedule" className={styles.scheduleLink}>Schedule & results <ArrowIcon /></Link>
      </div>

      <article className={styles.card} data-finals={finals || undefined} data-kind={phase.kind} data-season-countdown={seasonCountdown || undefined} data-testid="tournament-card" aria-busy={loading}>
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
            <h2>{loading ? "Getting ready" : error && !loaded ? "Stay connected" : seasonLabel}</h2>
            {!seasonCountdown && <span>{loading ? "Loading the latest season information." : error && !loaded ? "Season information is temporarily unavailable." : phase.kind === "complete" ? "The season is complete. Explore the teams, standings and results." : "Teams, weekly matches and results."}</span>}
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
          <Link href={match ? match.id < 0 ? "/schedule" : `/schedule/${match.id}` : "/season-9"} className={styles.cardLink}>
            {match ? phase.kind === "latest-result" ? "View result" : phase.kind === "live" ? "Open live match" : "Match details" : "Explore the season"}<ArrowIcon />
          </Link>
        </div>
      </article>

      <div className={styles.links}>
        <Link href="/teams">Meet the teams <ArrowIcon size={14} /></Link>
        {phase.kind === "live" ? <a href={TWITCH_URL} target="_blank" rel="noopener noreferrer"><TwitchIcon size={14} /> Watch live</a> : <Link href="/standings">Standings <ArrowIcon size={14} /></Link>}
      </div>
      {error && loaded ? <p className={styles.refreshNotice} role="status">Updates are reconnecting. Showing the last available schedule.</p> : null}
    </section>
  );
}
