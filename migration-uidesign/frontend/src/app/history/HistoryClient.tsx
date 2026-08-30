"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import archive from "@/data/history/season-8.json";
import { ArrowIcon } from "@/components/landing/brandAssets";
import SeasonPicker from "./SeasonPicker";
import { medalColor, roleColor, teamColor } from "./palette";
import styles from "./history.module.css";

const tabs = [
  { id: "rosters", label: "Rosters" },
  { id: "players", label: "Player Stats" },
  { id: "standings", label: "Standings" },
  { id: "results", label: "Schedule & Results" },
  { id: "finals", label: "Grand Finals" },
  { id: "wrapped", label: "Wrapped" },
] as const;

type TabId = (typeof tabs)[number]["id"];
type Player = (typeof archive.playerLeaderboard)[number];
type MetricKey = "killsPer10" | "damagePer10" | "healingPer10" | "mitigationPer10" | "assistsPer10" | "deathsPer10";
type PlayerRole = "ALL" | "TANK" | "DPS" | "SUPPORT";

const metrics: Array<{ key: MetricKey; label: string; short: string; lowerIsBetter?: boolean }> = [
  { key: "killsPer10", label: "Eliminations", short: "ELIM" },
  { key: "damagePer10", label: "Damage", short: "DMG" },
  { key: "healingPer10", label: "Healing", short: "HEAL" },
  { key: "mitigationPer10", label: "Mitigation", short: "MIT" },
  { key: "assistsPer10", label: "Assists", short: "AST" },
  { key: "deathsPer10", label: "Lowest deaths", short: "DTH", lowerIsBetter: true },
];

const roles: Array<{ id: PlayerRole; label: string }> = [
  { id: "ALL", label: "All roles" },
  { id: "TANK", label: "Tank" },
  { id: "DPS", label: "Damage" },
  { id: "SUPPORT", label: "Support" },
];

/* Enlaces antiguos que siguen circulando. /standings y /teams redirigen aqui con
   su nombre de antes, asi que se traducen en vez de caer al primer panel. */
const tabAliases: Record<string, TabId> = {
  teams: "rosters",
  playoffs: "results",
  stats: "players",
};

/* Indice de nombre de equipo a id, para poder colorear filas donde el dato solo
   trae el nombre (la tabla de jugadores) con el mismo color que en el resto. */
const teamIdByName = new Map(archive.teams.map((team) => [team.name, team.id]));

const playoffRounds = (() => {
  const groups = new Map<string, typeof archive.playoffs>();
  for (const match of archive.playoffs) {
    const label = match.type === "FINALS"
      ? "Grand Final"
      : match.round === 2
        ? "Semifinals"
        : match.round
          ? "Quarterfinals"
          : match.type;
    groups.set(label, [...(groups.get(label) ?? []), match]);
  }
  return [...groups.entries()];
})();

const statFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function normalizeTab(value: string | null): TabId {
  if (!value) return "rosters";
  const alias = tabAliases[value];
  if (alias) return alias;
  return tabs.some((tab) => tab.id === value) ? (value as TabId) : "rosters";
}

function TeamLogo({ src, name, className }: { src: string | null; name: string; className: string }) {
  if (!src) return null;
  return <img className={className} src={src} alt={`${name} logo`} loading="lazy" decoding="async" />;
}

/* Solo 7 de los 45 jugadores tienen retrato guardado en el archivo. El resto cae
   a su inicial en vez de a un hueco: una fila con imagen y otra sin ella
   descuadraria la tabla entera. */
function PlayerFace({ player }: { player: Player }) {
  const local = player.profileImage?.startsWith("/history/") ? player.profileImage : null;
  if (local) {
    return <img className={styles.portrait} src={local} alt="" loading="lazy" decoding="async" />;
  }
  return (
    <span className={styles.portraitFallback} aria-hidden="true">
      {player.player.slice(0, 1).toUpperCase()}
    </span>
  );
}

function RostersPanel() {
  /*
   * A roster whose image has not been restored yet would otherwise render a
   * broken-image icon, since every team now points at a local path whether the
   * file is there or not. Falling back to the name list keeps the card useful.
   */
  const [missingArt, setMissingArt] = useState<ReadonlySet<number>>(() => new Set());

  return (
    <>
      <div className={styles.panelHead}>
        <h2 className={styles.h2}>Rosters</h2>
        <p className={styles.panelLead}>
          The final five-player lineups for every Season 8 team, with the record each one finished
          the regular season on.
        </p>
      </div>

      <div className={styles.teamGrid}>
        {archive.teams.map((team) => {
          const rosterImage =
            team.rosterImage?.startsWith("/history/") && !missingArt.has(team.id)
              ? team.rosterImage
              : null;
          return (
            <article
              key={team.id}
              className={styles.teamCard}
              style={{ "--team": teamColor(team.id) } as React.CSSProperties}
            >
              <div className={styles.teamCardHead}>
                <TeamLogo src={team.logo} name={team.name} className={styles.teamLogo} />
                <h3 className={styles.teamName}>{team.name}</h3>
                <p className={styles.teamRecord}>
                  {team.record.wins}–{team.record.losses}
                  <span className={styles.teamRecordLabel}>W–L</span>
                </p>
              </div>

              {/*
                The roster image is the card. It carries the players, their
                heroes and the team's own art direction in one picture, which
                the name list never could. The list stays only as the fallback
                for a team whose image is missing.
              */}
              {rosterImage ? (
                <img
                  className={styles.rosterImage}
                  src={rosterImage}
                  alt={`${team.name} Season 8 roster: ${team.players.map((player) => player.name).join(", ")}`}
                  width={1200}
                  height={675}
                  loading="lazy"
                  decoding="async"
                  onError={() =>
                    setMissingArt((current) =>
                      current.has(team.id) ? current : new Set(current).add(team.id)
                    )
                  }
                />
              ) : (
                <ul className={styles.roster}>
                  {team.players.map((player) => (
                    <li key={player.legacyUserId} className={styles.rosterPlayer}>
                      {player.name}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

function PlayersPanel() {
  const [metricKey, setMetricKey] = useState<MetricKey>("killsPer10");
  const [role, setRole] = useState<PlayerRole>("ALL");
  const metric = metrics.find((item) => item.key === metricKey) ?? metrics[0];

  const leaderboard = useMemo(() => {
    const filtered = role === "ALL"
      ? [...archive.playerLeaderboard]
      : archive.playerLeaderboard.filter((player) => player.role === role);

    return filtered
      .sort((left, right) => {
        const delta = Number(left[metricKey]) - Number(right[metricKey]);
        return metric.lowerIsBetter ? delta : -delta;
      })
      .slice(0, 18);
  }, [metric.lowerIsBetter, metricKey, role]);

  const leader = leaderboard[0] as Player | undefined;
  /* El tope de la metrica activa da la escala de las barras. Se toma del lider
     visible, no del maximo absoluto, para que la barra llene la columna en vez
     de quedarse en un muñon cuando se filtra por rol. */
  const peak = leaderboard.reduce((max, p) => Math.max(max, Number(p[metricKey])), 0) || 1;

  return (
    <>
      <div className={styles.panelHead}>
        <h2 className={styles.h2}>Player Stats</h2>
        <p className={styles.panelLead}>
          Final Season 8 averages per 10 minutes. Pick a statistic and a role; the table shows the
          top eighteen for that combination.
        </p>
      </div>

      <div className={styles.filters}>
        <fieldset className={styles.filterGroup}>
          <legend className={styles.filterLegend}>Statistic</legend>
          <ul className={styles.filterList}>
            {metrics.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  className={`${styles.chip} ${metricKey === item.key ? styles.chipActive : ""}`}
                  aria-pressed={metricKey === item.key}
                  onClick={() => setMetricKey(item.key)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className={styles.filterGroup}>
          <legend className={styles.filterLegend}>Role</legend>
          <ul className={styles.filterList}>
            {roles.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`${styles.chip} ${role === item.id ? styles.chipActive : ""}`}
                  aria-pressed={role === item.id}
                  onClick={() => setRole(item.id)}
                  style={
                    item.id === "ALL"
                      ? undefined
                      : ({ "--chip": roleColor(item.id) } as React.CSSProperties)
                  }
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      </div>

      {leader ? (
        <p
          className={styles.leader}
          aria-live="polite"
          style={{ "--team": teamColor(teamIdByName.get(leader.team) ?? 0) } as React.CSSProperties}
        >
          <PlayerFace player={leader} />
          <span>
            <span className={styles.leaderLabel}>Season leader · {leader.team || "Free agent"}</span>
            <span className={styles.leaderName}>{leader.player}</span>
          </span>
          <span className={styles.leaderValue}>
            {statFormatter.format(Number(leader[metricKey]))}
            <span className={styles.leaderUnit}>{metric.short} / 10 MIN</span>
          </span>
        </p>
      ) : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>Season 8 player ranking by {metric.label.toLowerCase()}</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Player</th>
              <th scope="col">Team</th>
              <th scope="col">Role</th>
              <th scope="col" className={styles.num}>Maps</th>
              <th scope="col" className={styles.numLead}>{metric.label} / 10</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((player, index) => {
              const medal = medalColor(index + 1);
              const share = Math.max(0.06, Number(player[metricKey]) / peak);
              return (
                <tr
                  key={player.legacyUserId}
                  style={
                    {
                      "--team": teamColor(teamIdByName.get(player.team) ?? 0),
                      // Feeds the staggered entrance; the CSS caps the delay.
                      "--row": index,
                    } as React.CSSProperties
                  }
                >
                  <td
                    className={styles.rank}
                    style={medal ? ({ "--medal": medal } as React.CSSProperties) : undefined}
                  >
                    <span className={medal ? styles.rankMedal : undefined}>{index + 1}</span>
                  </td>
                  <th scope="row">
                    <span className={styles.playerCell}>
                      <PlayerFace player={player} />
                      {player.player}
                    </span>
                  </th>
                  <td>
                    <span className={styles.teamTag}>{player.team || "Free agent"}</span>
                  </td>
                  <td>
                    <span
                      className={styles.roleTag}
                      style={{ "--role": roleColor(player.role) } as React.CSSProperties}
                    >
                      {player.role}
                    </span>
                  </td>
                  <td className={styles.num}>{player.mapsPlayed}</td>
                  {/* La barra hace comparable la columna de un vistazo: sin ella
                      son dieciocho numeros que hay que leer uno a uno. */}
                  <td className={styles.numLead}>
                    <span className={styles.barCell}>
                      <span
                        className={styles.bar}
                        style={{ "--share": `${(share * 100).toFixed(1)}%` } as React.CSSProperties}
                        aria-hidden="true"
                      />
                      <span className={styles.barValue}>
                        {statFormatter.format(Number(player[metricKey]))}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StandingsPanel() {
  const peak = archive.standings.reduce((max, r) => Math.max(max, r.wins + r.losses), 0) || 1;

  return (
    <>
      <div className={styles.panelHead}>
        <h2 className={styles.h2}>Standings</h2>
        <p className={styles.panelLead}>
          The regular-season table as it stood when Season 8 closed. Map differential is what broke
          ties for playoff seeding.
        </p>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>Final Season 8 standings</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Team</th>
              <th scope="col" className={styles.num}>W</th>
              <th scope="col" className={styles.num}>L</th>
              <th scope="col">Record</th>
              <th scope="col" className={styles.num}>Maps</th>
              <th scope="col" className={styles.num}>Diff</th>
            </tr>
          </thead>
          <tbody>
            {archive.standings.map((row) => {
              const medal = medalColor(row.rank);
              return (
                <tr key={row.teamId} style={{ "--team": teamColor(row.teamId) } as React.CSSProperties}>
                  <td
                    className={styles.rank}
                    style={medal ? ({ "--medal": medal } as React.CSSProperties) : undefined}
                  >
                    <span className={medal ? styles.rankMedal : undefined}>{row.rank}</span>
                  </td>
                  <th scope="row">
                    <span className={styles.teamCellInner}>
                      <TeamLogo src={row.logo} name={row.team} className={styles.tinyLogo} />
                      {row.team}
                    </span>
                  </th>
                  <td className={styles.num}>{row.wins}</td>
                  <td className={styles.num}>{row.losses}</td>
                  {/* Victorias y derrotas como una sola barra: la proporcion se
                      compara entre filas mucho mas rapido que dos cifras. */}
                  <td>
                    <span
                      className={styles.recordBar}
                      style={{ "--won": `${((row.wins / peak) * 100).toFixed(1)}%` } as React.CSSProperties}
                      aria-hidden="true"
                    />
                  </td>
                  <td className={styles.num}>{row.mapWins}–{row.mapLosses}</td>
                  <td className={`${styles.num} ${row.mapDifferential > 0 ? styles.diffPos : styles.diffNeg}`}>
                    {row.mapDifferential > 0 ? "+" : ""}
                    {row.mapDifferential}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ResultsPanel() {
  return (
    <>
      <div className={styles.panelHead}>
        <h2 className={styles.h2}>Schedule &amp; Results</h2>
        <p className={styles.panelLead}>
          Season 8 playoff matches, from the quarterfinals through the Grand Final.
        </p>
      </div>

      {playoffRounds.map(([label, matches]) => (
        <section key={label} className={styles.round}>
          <h3 className={styles.roundName}>{label}</h3>
          <ul className={styles.matchList}>
            {matches.map((match) => {
              const aWon = match.score.teamA > match.score.teamB;
              const bWon = match.score.teamB > match.score.teamA;
              return (
                <li
                  key={match.legacyId}
                  className={styles.match}
                  style={{
                    "--team-a": teamColor(match.teamA.id),
                    "--team-b": teamColor(match.teamB.id),
                  } as React.CSSProperties}
                >
                  <span className={`${styles.matchSide} ${styles.matchSideA} ${bWon ? styles.matchSideLost : ""}`}>
                    <TeamLogo src={match.teamA.logo} name={match.teamA.name} className={styles.tinyLogo} />
                    {match.teamA.name}
                  </span>
                  <span className={styles.matchScore}>
                    <span className={aWon ? styles.matchScoreWinA : undefined}>{match.score.teamA}</span>
                    <i aria-hidden="true" />
                    <span className={bWon ? styles.matchScoreWinB : undefined}>{match.score.teamB}</span>
                  </span>
                  <span className={`${styles.matchSide} ${styles.matchSideB} ${styles.matchSideRight} ${aWon ? styles.matchSideLost : ""}`}>
                    {match.teamB.name}
                    <TeamLogo src={match.teamB.logo} name={match.teamB.name} className={styles.tinyLogo} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

function FinalsPanel() {
  const final = archive.grandFinal;
  const playedOn = new Date(final.playedAt).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <div className={styles.panelHead}>
        <h2 className={styles.h2}>Grand Finals</h2>
        <p className={styles.panelLead}>
          The match that closed Season 8, and the player the broadcast team named its MVP.
        </p>
      </div>

      <article className={styles.finalCard}>
        <header className={styles.finalHead}>
          <span className={styles.finalKicker}>Season 8 · Grand Final</span>
          <span>Best of {final.bestOf} · {playedOn}</span>
        </header>

        <ul className={styles.finalSides}>
          <li
            className={`${styles.finalSide} ${styles.finalSideWon}`}
            style={{ "--team": teamColor(final.champion.id) } as React.CSSProperties}
          >
            <TeamLogo src={final.champion.logo} name={final.champion.name} className={styles.finalLogo} />
            <span className={styles.finalTeam}>
              {final.champion.name}
              <span className={styles.finalCrown}>Season 8 champion</span>
            </span>
            <span className={styles.finalScore}>{final.champion.score}</span>
          </li>
          <li
            className={styles.finalSide}
            style={{ "--team": teamColor(final.runnerUp.id) } as React.CSSProperties}
          >
            <TeamLogo src={final.runnerUp.logo} name={final.runnerUp.name} className={styles.finalLogo} />
            <span className={styles.finalTeam}>{final.runnerUp.name}</span>
            <span className={styles.finalScore}>{final.runnerUp.score}</span>
          </li>
        </ul>

        <div className={styles.mvp} style={{ "--team": teamColor(final.champion.id) } as React.CSSProperties}>
          <img
            className={styles.mvpPortrait}
            src={final.mvp.image}
            alt={`${final.mvp.name}, Grand Finals MVP`}
            width={640}
            height={640}
            loading="lazy"
            decoding="async"
          />
          <div>
            <p className={styles.mvpLabel}>Grand Finals MVP</p>
            <p className={styles.mvpName}>{final.mvp.name}</p>
            <p className={styles.mvpTeam}>{final.mvp.team}</p>
          </div>
        </div>
      </article>
    </>
  );
}

function WrappedPanel() {
  return (
    <>
      <div className={styles.panelHead}>
        <h2 className={styles.h2}>Season 8 Wrapped</h2>
        <p className={styles.panelLead}>
          The full recap: final statistics, videos, story audio, soundtrack and artwork, kept the way
          it was published.
        </p>
      </div>

      <div className={styles.wrappedCard}>
        <div className={styles.wrappedCopy}>
          <h3 className={styles.wrappedTitle}>The whole season, in one piece</h3>
          <p className={styles.panelLead}>
            Wrapped is its own experience rather than a page of tables. It opens in full screen.
          </p>
        </div>
        <Link href="/history/season-8/wrapped" className={styles.cta}>
          Open Wrapped <ArrowIcon size={14} />
        </Link>
      </div>
    </>
  );
}

/* Estado en la URL: ?season=8&tab=players.
 *
 * Abrir una temporada usa pushState y cambiar de pestana replaceState. Es la
 * diferencia entre "he entrado en algo" y "he mirado otra cosa dentro": asi
 * Atras vuelve al selector, en vez de deshacer seis pestanas una a una. */
function readUrl(): { season: number | null; tab: TabId } {
  if (typeof window === "undefined") return { season: null, tab: "rosters" };
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("season");
  const season = raw === "8" ? 8 : null;
  const tabParam = params.get("tab");
  // Un ?tab= suelto, de los enlaces antiguos, implica que se quiere el archivo.
  return { season: season ?? (tabParam ? 8 : null), tab: normalizeTab(tabParam) };
}

export function HistoryClient() {
  const [season, setSeason] = useState<number | null>(null);
  const [active, setActive] = useState<TabId>("rosters");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const syncFromUrl = useCallback(() => {
    const next = readUrl();
    setSeason(next.season);
    setActive(next.tab);
  }, []);

  useEffect(() => {
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [syncFromUrl]);

  const openSeason = (value: number) => {
    setSeason(value);
    setActive("rosters");
    const url = new URL(window.location.href);
    url.searchParams.set("season", String(value));
    url.searchParams.set("tab", "rosters");
    window.history.pushState(null, "", `${url.pathname}${url.search}`);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const closeSeason = () => {
    setSeason(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("season");
    url.searchParams.delete("tab");
    window.history.pushState(null, "", `${url.pathname}${url.search}`);
  };

  const selectTab = (tab: TabId) => {
    setActive(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = last;
    if (next === null) return;

    event.preventDefault();
    selectTab(tabs[next].id);
    tabRefs.current[next]?.focus();
  };

  if (season === null) {
    return <SeasonPicker onOpen={openSeason} />;
  }

  return (
    <>
      <div className={styles.tabRail}>
        <div className={styles.tabRailInner}>
          <button type="button" className={styles.backButton} onClick={closeSeason}>
            <span aria-hidden="true">←</span> Seasons
          </button>

          <div className={styles.tabList} role="tablist" aria-label="Season 8 history sections">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                id={`history-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={active === tab.id}
                aria-controls="history-panel"
                tabIndex={active === tab.id ? 0 : -1}
                className={`${styles.tab} ${active === tab.id ? styles.tabActive : ""}`}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        id="history-panel"
        role="tabpanel"
        aria-labelledby={`history-tab-${active}`}
        tabIndex={0}
        className={styles.panel}
      >
        {active === "rosters" ? <RostersPanel /> : null}
        {active === "players" ? <PlayersPanel /> : null}
        {active === "standings" ? <StandingsPanel /> : null}
        {active === "results" ? <ResultsPanel /> : null}
        {active === "finals" ? <FinalsPanel /> : null}
        {active === "wrapped" ? <WrappedPanel /> : null}
      </div>
    </>
  );
}
