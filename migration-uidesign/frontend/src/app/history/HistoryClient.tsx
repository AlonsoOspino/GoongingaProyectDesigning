"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import archive from "@/data/history/season-8.json";

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

const tabAliases: Record<string, TabId> = {
  teams: "rosters",
  playoffs: "results",
  stats: "players",
};

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
  return tabs.some((tab) => tab.id === value) ? value as TabId : "rosters";
}

function TeamLogo({ src, name }: { src: string | null; name: string }) {
  return src
    ? <img src={src} alt={`${name} logo`} width={48} height={48} />
    : <span aria-hidden="true">—</span>;
}

function TeamRoster({ team }: { team: (typeof archive.teams)[number] }) {
  const rosterImage = team.rosterImage?.startsWith("/history/") ? team.rosterImage : null;

  return (
    <article>
      <h3>{team.name}</h3>
      <TeamLogo src={team.logo} name={team.name} />
      {rosterImage ? (
        <img src={rosterImage} alt={`${team.name} Season 8 roster`} width={1200} height={675} />
      ) : null}
      <ul>
        {team.players.map((player) => <li key={player.legacyUserId}>{player.name}</li>)}
      </ul>
    </article>
  );
}

function PlayerLeaderboard() {
  const [metricKey, setMetricKey] = useState<MetricKey>("killsPer10");
  const [role, setRole] = useState<PlayerRole>("ALL");
  const metric = metrics.find((item) => item.key === metricKey) ?? metrics[0];

  const leaderboard = useMemo(() => {
    const filtered = role === "ALL"
      ? [...archive.playerLeaderboard]
      : archive.playerLeaderboard.filter((player) => player.role === role);

    return filtered.sort((left, right) => {
      const delta = Number(left[metricKey]) - Number(right[metricKey]);
      return metric.lowerIsBetter ? delta : -delta;
    }).slice(0, 18);
  }, [metric.lowerIsBetter, metricKey, role]);

  const leader = leaderboard[0] as Player | undefined;

  return (
    <section aria-labelledby="history-player-stats">
      <h2 id="history-player-stats">Player Stats</h2>
      <p>Final Season 8 averages per 10 minutes.</p>

      <fieldset>
        <legend>Statistic</legend>
        <ul>
          {metrics.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                aria-pressed={metricKey === item.key}
                onClick={() => setMetricKey(item.key)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend>Role</legend>
        <ul>
          {roles.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={role === item.id}
                onClick={() => setRole(item.id)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      {leader ? <p>Season leader: <strong>{leader.player}</strong> — {statFormatter.format(Number(leader[metricKey]))} {metric.short} / 10</p> : null}

      <table>
        <caption>Season 8 player ranking by {metric.label.toLowerCase()}</caption>
        <thead>
          <tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Team</th><th scope="col">Role</th><th scope="col">Maps</th><th scope="col">{metric.label} / 10</th></tr>
        </thead>
        <tbody>
          {leaderboard.map((player, index) => (
            <tr key={player.legacyUserId}>
              <td>{index + 1}</td>
              <th scope="row">{player.player}</th>
              <td>{player.team || "Free agent"}</td>
              <td>{player.role}</td>
              <td>{player.mapsPlayed}</td>
              <td>{statFormatter.format(Number(player[metricKey]))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function HistoryClient() {
  const searchParams = useSearchParams();
  const [active, setActive] = useState<TabId>(() => normalizeTab(searchParams.get("tab")));
  const grandFinal = archive.grandFinal;

  const selectTab = (tab: TabId) => {
    setActive(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  return (
    <>
      <nav aria-label="Season 8 history sections">
        <ul>
          {tabs.map((tab) => (
            <li key={tab.id}>
              <button
                id={`history-tab-${tab.id}`}
                type="button"
                aria-controls="history-panel"
                aria-pressed={active === tab.id}
                onClick={() => selectTab(tab.id)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div id="history-panel">
        {active === "rosters" ? (
          <section aria-labelledby="history-rosters">
            <h2 id="history-rosters">Rosters</h2>
            <p>The final five-player lineups for every Season 8 team.</p>
            <div>{archive.teams.map((team) => <TeamRoster team={team} key={team.id} />)}</div>
          </section>
        ) : null}

        {active === "players" ? <PlayerLeaderboard /> : null}

        {active === "standings" ? (
          <section aria-labelledby="history-standings">
            <h2 id="history-standings">Standings</h2>
            <p>The regular-season table as it stood when Season 8 closed.</p>
            <table>
              <caption>Final Season 8 standings</caption>
              <thead><tr><th scope="col">Rank</th><th scope="col">Team</th><th scope="col">Wins</th><th scope="col">Losses</th><th scope="col">Maps</th><th scope="col">Differential</th></tr></thead>
              <tbody>
                {archive.standings.map((row) => (
                  <tr key={row.teamId}>
                    <td>{row.rank}</td>
                    <th scope="row"><TeamLogo src={row.logo} name={row.team} />{row.team}</th>
                    <td>{row.wins}</td>
                    <td>{row.losses}</td>
                    <td>{row.mapWins}-{row.mapLosses}</td>
                    <td>{row.mapDifferential > 0 ? "+" : ""}{row.mapDifferential}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {active === "results" ? (
          <section aria-labelledby="history-results">
            <h2 id="history-results">Schedule &amp; Results</h2>
            <p>Season 8 playoff matches from the quarterfinals through the Grand Final.</p>
            {playoffRounds.map(([label, matches]) => (
              <section key={label} aria-labelledby={`history-round-${label.replace(/\s+/g, "-").toLowerCase()}`}>
                <h3 id={`history-round-${label.replace(/\s+/g, "-").toLowerCase()}`}>{label}</h3>
                <ul>
                  {matches.map((match) => (
                    <li key={match.legacyId}>
                      {match.title || `Best of ${match.bestOf}`}: {match.teamA.name} {match.score.teamA}–{match.score.teamB} {match.teamB.name}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </section>
        ) : null}

        {active === "finals" ? (
          <section aria-labelledby="history-finals">
            <h2 id="history-finals">Grand Finals</h2>
            <p>Played August 8, 2026. Best of {grandFinal.bestOf}.</p>
            <p><TeamLogo src={grandFinal.runnerUp.logo} name={grandFinal.runnerUp.name} /> {grandFinal.runnerUp.name}: {grandFinal.runnerUp.score}</p>
            <p><TeamLogo src={grandFinal.champion.logo} name={grandFinal.champion.name} /> {grandFinal.champion.name}: {grandFinal.champion.score} — Season 8 Champion</p>
            <h3>Grand Finals MVP</h3>
            <img src={grandFinal.mvp.image} alt={`${grandFinal.mvp.name}, Grand Finals MVP`} width={640} height={640} />
            <p><strong>{grandFinal.mvp.name}</strong> — {grandFinal.mvp.team}</p>
          </section>
        ) : null}

        {active === "wrapped" ? (
          <section aria-labelledby="history-wrapped">
            <h2 id="history-wrapped">Season 8 Wrapped</h2>
            <p>The complete recap contains the final statistics, videos, story audio, soundtrack, and artwork.</p>
            <p><Link href="/history/season-8/wrapped">Open Season 8 Wrapped</Link></p>
          </section>
        ) : null}
      </div>
    </>
  );
}
