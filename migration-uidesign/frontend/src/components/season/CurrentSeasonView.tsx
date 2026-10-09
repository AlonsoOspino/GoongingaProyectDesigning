"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { getCurrentTournament } from "@/lib/api/admin";
import { getLeaderboard } from "@/lib/api/team";
import { getMatchesByTournament } from "@/lib/api/match";
import { getPublicPlayerStats } from "@/lib/api/playerStat";
import type { HeroRole, Match, PlayerStat, Team, Tournament } from "@/lib/api/types";
import { buildPlayerAverages, sortByMetric, type TopMetricKey } from "@/lib/stats/playerAverages";
import { resolveGenericBackendAsset } from "@/lib/assetUrls";
import { matchesSeasonNumber } from "@/features/tournament/seasonIdentity";
import { filterMatchesByDivision, groupTeamsByDivision, regularSeasonDivision, regularSeasonStats } from "@/features/tournament/divisions";
import styles from "./current-season.module.css";

type View = "schedule" | "standings" | "teams" | "stats";
const views = [
  { id: "information", href: "/season-9", label: "Information" },
  { id: "schedule", href: "/schedule", label: "Schedule" },
  { id: "teams", href: "/teams", label: "Teams" },
  { id: "stats", href: "/stats", label: "Player Stats" },
  { id: "standings", href: "/standings", label: "Standings" },
];
const titles: Record<View, string> = { schedule: "Schedule & Results", teams: "Teams", standings: "Standings", stats: "Player Stats" };
const metrics: Array<{ key: TopMetricKey; label: string }> = [
  { key: "killsPer10", label: "Eliminations" }, { key: "damagePer10", label: "Damage" },
  { key: "healingPer10", label: "Healing" }, { key: "mitigationPer10", label: "Mitigation" },
  { key: "assistsPer10", label: "Assists" }, { key: "deathsPer10", label: "Lowest deaths" },
];
const phaseLabels: Record<Tournament["state"], string> = {
  SCHEDULED: "Season preparation", ROUNDROBIN: "Regular season", PLAYOFFS: "Playoffs",
  SEMIFINALS: "Semifinals", FINALS: "Grand Final", FINISHED: "Season complete",
};
const stageLabels: Record<Match["type"], string> = {
  ROUNDROBIN: "Regular season", PLAYINS: "Play-ins", PLAYOFFS: "Playoffs",
  SEMIFINALS: "Semifinals", FINALS: "Grand Final", PRACTICE: "Practice",
};

function TeamLogo({ team }: { team?: Team }) {
  if (!team?.logo) return <span className={styles.logoFallback} aria-hidden="true">{team?.name.charAt(0) ?? "?"}</span>;
  return <img className={styles.logo} src={resolveGenericBackendAsset(team.logo)} alt="" loading="lazy" />;
}

export default function CurrentSeasonView({ view }: { view: View }) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [metricKey, setMetricKey] = useState<TopMetricKey>("killsPer10");
  const [role, setRole] = useState<"ALL" | HeroRole>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [divisionFilter, setDivisionFilter] = useState("");

  const load = useCallback(async (isMounted: () => boolean = () => true) => {
    setLoading(true);
    setError(null);
    try {
      const current = await getCurrentTournament({ cache: "no-store" });
      if (!isMounted()) return;
      if (!matchesSeasonNumber(current, 9)) {
        setTournament(null);
        setTeams([]);
        setMatches([]);
        setStats([]);
        return;
      }
      const [nextTeams, nextMatches] = await Promise.all([
        getLeaderboard(current.id), getMatchesByTournament(current.id),
      ]);
      if (!isMounted()) return;
      setTournament(current);
      setTeams(nextTeams);
      setMatches(nextMatches.filter((match) => match.type !== "PRACTICE"));
      const currentStats = view === "stats" && nextMatches.some((match) => match.type === "ROUNDROBIN")
        ? await getPublicPlayerStats() : [];
      if (!isMounted()) return;
      setStats(regularSeasonStats(currentStats, nextMatches, nextTeams, null));
    } catch (reason) {
      if (!isMounted()) return;
      if (reason instanceof ApiError && reason.status === 404) {
        setTournament(null);
        setTeams([]);
        setMatches([]);
        setStats([]);
      } else {
        setError("The season could not be loaded. Please try again.");
      }
    } finally {
      if (isMounted()) setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    let mounted = true;
    void load(() => mounted);
    return () => { mounted = false; };
  }, [load]);

  const divisions = tournament?.divisions ?? [];
  const divisionId = divisionFilter ? Number(divisionFilter) : null;
  const groups = useMemo(() => groupTeamsByDivision(teams, divisions)
    .filter((group) => divisionId == null || group.id === divisionId), [teams, divisions, divisionId]);
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const playerRows = useMemo(() => sortByMetric(buildPlayerAverages(regularSeasonStats(stats, matches, teams, divisionId))
    .filter((player) => role === "ALL" || player.role === role), metricKey), [stats, matches, teams, divisionId, role, metricKey]);
  const activeMetric = metrics.find((metric) => metric.key === metricKey) ?? metrics[0];
  const fixtureGroups = useMemo(() => {
    const grouped = new Map<string, { label: string; order: number; matches: Match[] }>();
    for (const match of filterMatchesByDivision(matches, teams, divisionId)) {
      const division = regularSeasonDivision(match, teamsById);
      const divisionName = divisions.find((item) => item.id === division)?.name;
      const regular = match.type === "ROUNDROBIN";
      const label = regular
        ? `Week ${match.semanas ?? "TBA"}${divisionName ? ` · ${divisionName}` : ""}`
        : match.title || stageLabels[match.type];
      const key = regular ? `week-${match.semanas}-${division ?? "all"}` : `stage-${match.playoffRound ?? match.type}-${label}`;
      const order = regular ? (match.semanas ?? 99) * 10 + (divisions.find((item) => item.id === division)?.sortOrder ?? 0)
        : 1000 + (match.playoffRound ?? (match.type === "FINALS" ? 3 : 0));
      const group = grouped.get(key) ?? { label, order, matches: [] };
      group.matches.push(match);
      grouped.set(key, group);
    }
    return [...grouped.values()].sort((left, right) => left.order - right.order)
      .map((group) => ({ ...group, matches: [...group.matches].sort((left, right) =>
        (left.startDate ? Date.parse(left.startDate) : Infinity) - (right.startDate ? Date.parse(right.startDate) : Infinity) || left.id - right.id) }));
  }, [matches, teams, teamsById, divisions, divisionId]);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>GGL Tournament · Season 9</p>
          <h1>{titles[view]}</h1>
          <p className={styles.lead}>{view === "schedule" ? "Regular-season opponents come from the same division."
            : view === "standings" ? "Regular-season records, ranked within each division."
              : view === "stats" ? "Season 9 regular-season averages per 10 minutes. Filter by division and role."
                : "Teams are constructed by the committee for competitive balance."}</p>
          {tournament && <p className={styles.status}>{phaseLabels[tournament.state]}{tournament.startDate ? ` · Starts ${new Date(tournament.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : ""}</p>}
        </header>
        <nav className={styles.navigation} aria-label="Season 9">
          {views.map((item) => <Link key={item.id} href={item.href} aria-current={view === item.id ? "page" : undefined}>{item.label}</Link>)}
        </nav>
        {divisions.length > 0 && (
          <div className={styles.filters}>
            <label htmlFor="division-filter">Division</label>
            <select id="division-filter" value={divisionFilter} onChange={(event) => setDivisionFilter(event.target.value)}>
              <option value="">All divisions</option>
              {divisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}
            </select>
          </div>
        )}
        {view === "stats" && (
          <div className={styles.filters}>
            <label htmlFor="stats-metric">Statistic</label>
            <select id="stats-metric" value={metricKey} onChange={(event) => setMetricKey(event.target.value as TopMetricKey)}>
              {metrics.map((metric) => <option key={metric.key} value={metric.key}>{metric.label}</option>)}
            </select>
            <label htmlFor="stats-role">Role</label>
            <select id="stats-role" value={role} onChange={(event) => setRole(event.target.value as "ALL" | HeroRole)}>
              <option value="ALL">All roles</option><option value="TANK">Tank</option><option value="DPS">Damage</option><option value="SUPPORT">Support</option>
            </select>
          </div>
        )}
        {loading ? <p className={styles.empty} role="status">Loading Season 9…</p> : error ? (
          <div className={styles.empty} role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>Try again</button></div>
        ) : !tournament ? (
          <div className={styles.empty}><p>Season 9 is being prepared. Teams and fixtures will appear here when they are published.</p><Link href="/history?season=8">Season 8 results →</Link></div>
        ) : view === "stats" ? playerRows.length ? (
          <div className={styles.sections}><div className={styles.tableWrap}><table className={styles.table}>
            <caption>Season 9 player averages by {activeMetric.label.toLowerCase()}</caption>
            <thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Role</th><th scope="col">Maps</th><th scope="col">{activeMetric.label} / 10</th></tr></thead>
            <tbody>{playerRows.map((player, index) => <tr key={player.userId}><td>{index + 1}</td><th scope="row"><Link href={`/stats/${player.userId}?tournamentId=${tournament.id}`}>{player.nickname}</Link></th><td>{player.role}</td><td>{player.games}</td><td>{new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(player[metricKey])}</td></tr>)}</tbody>
          </table></div></div>
        ) : <p className={styles.empty}>Player stats will appear after Season 9 match data is published.</p> : view === "schedule" ? fixtureGroups.length ? (
          <div className={styles.sections}>{fixtureGroups.map((group) => (
            <section key={group.label} className={styles.division}>
              <h2>{group.label}</h2>
              <ul className={styles.matches}>{group.matches.map((match) => {
                const a = teamsById.get(match.teamAId);
                const b = teamsById.get(match.teamBId);
                const finished = match.status === "FINISHED";
                return (
                  <li key={match.id}>
                    <Link href={`/schedule/${match.id}`} className={styles.match}>
                      <span className={styles.matchMeta}>{match.status === "ACTIVE" ? "Live" : finished ? "Final" : match.startDate ? new Date(match.startDate).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Date to be announced"}<span>Best of {match.bestOf}</span></span>
                      <span className={`${styles.matchTeam} ${finished && match.mapWinsTeamA > match.mapWinsTeamB ? styles.winner : ""}`}><TeamLogo team={a} />{a?.name ?? `Team ${match.teamAId}`}</span>
                      <span className={styles.score}>{match.status === "SCHEDULED" ? "VS" : `${match.mapWinsTeamA}–${match.mapWinsTeamB}`}</span>
                      <span className={`${styles.matchTeam} ${styles.matchTeamB} ${finished && match.mapWinsTeamB > match.mapWinsTeamA ? styles.winner : ""}`}>{b?.name ?? `Team ${match.teamBId}`}<TeamLogo team={b} /></span>
                    </Link>
                  </li>
                );
              })}</ul>
            </section>
          ))}</div>
        ) : <p className={styles.empty}>The Season 9 schedule has not been published yet.</p> : (
          <div className={styles.sections}>{groups.map((group) => (
            <section key={group.id ?? "unassigned"} className={styles.division}>
              <div className={styles.divisionHead}><h2>{group.name}</h2><span>{group.teams.length} teams</span></div>
              {!group.teams.length ? <p className={styles.empty}>Teams will be announced here.</p> : view === "teams" ? (
                <div className={styles.teams}>{group.teams.map((team) => (
                  <article key={team.id} className={styles.team}>
                    <Link href={`/teams/${team.id}`} className={styles.teamHead}><TeamLogo team={team} /><h3>{team.name}</h3><span aria-hidden="true">↗</span></Link>
                    {team.roster ? <img className={styles.roster} src={resolveGenericBackendAsset(team.roster)} alt={`${team.name} roster`} loading="lazy" /> : <p className={styles.rosterPending}>Roster to be announced</p>}
                  </article>
                ))}</div>
              ) : (
                <div className={styles.tableWrap}><table className={styles.table}>
                  <caption>{group.name} · Season 9 regular-season standings</caption>
                  <thead><tr><th scope="col">#</th><th scope="col">Team</th><th scope="col">W</th><th scope="col">L</th><th scope="col">Maps</th><th scope="col">Diff</th></tr></thead>
                  <tbody>{group.teams.map((team, index) => {
                    const diff = team.mapWins - team.mapLoses;
                    return <tr key={team.id}><td>{index + 1}</td><th scope="row"><Link href={`/teams/${team.id}`}><TeamLogo team={team} />{team.name}</Link></th><td>{team.victories}</td><td>{team.defeats}</td><td>{team.mapWins}–{team.mapLoses}</td><td className={diff > 0 ? styles.winner : undefined}>{diff > 0 ? "+" : ""}{diff}</td></tr>;
                  })}</tbody>
                </table></div>
              )}
            </section>
          ))}{groups.length === 0 && <p className={styles.empty}>Season 9 teams have not been announced yet.</p>}</div>
        )}
      </div>
    </main>
  );
}
