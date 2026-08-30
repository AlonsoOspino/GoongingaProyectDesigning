"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentTournament } from "@/lib/api/admin";
import { getLeaderboard } from "@/lib/api/team";
import { getMatches } from "@/lib/api/match";
import type { Match, Team, Tournament } from "@/lib/api/types";
import styles from "./league-now.module.css";

/*
 * The state of the league, from the league's own tables.
 *
 * Everything here is scoped to the current tournament on purpose. /team and
 * /match return every row across every season, including the developer sandbox
 * season, so an unscoped read would put "Sandbox Alpha" on the public landing.
 */

interface LeagueState {
  tournament: Tournament;
  standings: Team[];
  nextMatch: Match | null;
  liveMatch: Match | null;
  teamsById: Map<number, Team>;
}

const POLL_MS = 30000;

function formatKickoff(value: string | null | undefined) {
  if (!value) return "Date to be confirmed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date to be confirmed";
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LeagueNow() {
  const [state, setState] = useState<LeagueState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const tournament = await getCurrentTournament();
        const [standings, matches] = await Promise.all([
          getLeaderboard(tournament.id),
          getMatches(),
        ]);
        if (!mounted) return;

        const seasonMatches = matches.filter((match) => match.tournamentId === tournament.id);
        const teamsById = new Map(standings.map((team) => [team.id, team] as const));

        const liveMatch = seasonMatches.find((match) => match.status === "ACTIVE") ?? null;
        const nextMatch =
          seasonMatches
            .filter((match) => match.status === "SCHEDULED" && match.startDate)
            .sort(
              (a, b) =>
                new Date(a.startDate as string).getTime() -
                new Date(b.startDate as string).getTime()
            )[0] ?? null;

        setState({ tournament, standings, nextMatch, liveMatch, teamsById });
        setFailed(false);
      } catch {
        if (mounted) setFailed(true);
      }
    };

    void load();
    const poll = window.setInterval(load, POLL_MS);
    return () => {
      mounted = false;
      window.clearInterval(poll);
    };
  }, []);

  // A landing section that says "could not load" is worse than one that is not
  // there, so this simply stands down when the league has nothing to report.
  if (failed || !state) return null;
  if (state.standings.length === 0) return null;

  const { tournament, standings, nextMatch, liveMatch, teamsById } = state;
  const featured = liveMatch ?? nextMatch;
  const teamName = (id: number) => teamsById.get(id)?.name ?? "TBD";
  const top = standings.slice(0, 5);

  return (
    <section className={styles.section} aria-label="League status">
      <div className={styles.inner}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>
            <span className={styles.dot} aria-hidden="true" />
            {tournament.name}
          </p>
          <h2 className={styles.title}>The league right now</h2>
        </header>

        <div className={styles.grid}>
          <article className={styles.matchCard} data-live={liveMatch ? "true" : "false"}>
            <p className={styles.cardLabel}>{liveMatch ? "Playing now" : "Next on the schedule"}</p>

            {featured ? (
              <>
                <div className={styles.matchTeams}>
                  <span className={styles.matchTeam}>{teamName(featured.teamAId)}</span>
                  <span className={styles.matchVersus}>
                    {liveMatch ? `${featured.mapWinsTeamA}–${featured.mapWinsTeamB}` : "vs"}
                  </span>
                  <span className={styles.matchTeam}>{teamName(featured.teamBId)}</span>
                </div>
                <p className={styles.matchMeta}>
                  {liveMatch
                    ? `Game ${(featured.gameNumber || 0) + 1} · best of ${featured.bestOf}`
                    : formatKickoff(featured.startDate)}
                </p>
              </>
            ) : (
              <p className={styles.matchIdle}>
                The schedule for the next stage has not been drawn yet.
              </p>
            )}

            <Link href="/schedule" className={styles.cardLink}>
              Full schedule
            </Link>
          </article>

          <article className={styles.standingsCard}>
            <p className={styles.cardLabel}>Standings</p>
            <ol className={styles.standingsList}>
              {top.map((team, index) => (
                <li key={team.id} className={styles.standingsRow}>
                  <span className={styles.standingsRank}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.standingsTeam}>{team.name}</span>
                  <span className={styles.standingsRecord}>
                    {team.victories}<i>–</i>{team.defeats}
                  </span>
                  <span className={styles.standingsMaps}>
                    {team.mapWins - team.mapLoses > 0 ? "+" : ""}
                    {team.mapWins - team.mapLoses}
                  </span>
                </li>
              ))}
            </ol>
            <Link href="/history?tab=standings" className={styles.cardLink}>
              Full table
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
