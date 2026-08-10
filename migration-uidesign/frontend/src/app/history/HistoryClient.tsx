"use client";

import Link from "next/link";
import { useMemo, useState, type ComponentType } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  BarChart3,
  Crosshair,
  Film,
  Flame,
  GitBranch,
  HeartPulse,
  Medal,
  Shield,
  Skull,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import archive from "@/data/history/season-8.json";

const tabs = [
  { id: "standings", label: "Standings", icon: Trophy },
  { id: "players", label: "Top Players", icon: BarChart3 },
  { id: "teams", label: "Teams", icon: Users },
  { id: "playoffs", label: "Playoffs", icon: GitBranch },
  { id: "finals", label: "Grand Finals", icon: Medal },
  { id: "wrapped", label: "Wrapped", icon: Film },
] as const;

type TabId = (typeof tabs)[number]["id"];
type Player = (typeof archive.playerLeaderboard)[number];
type MetricKey = "killsPer10" | "damagePer10" | "healingPer10" | "mitigationPer10" | "assistsPer10" | "deathsPer10";
type PlayerRole = "ALL" | "TANK" | "DPS" | "SUPPORT";

type MetricOption = {
  key: MetricKey;
  label: string;
  short: string;
  icon: ComponentType<{ size?: number }>;
  tone: string;
  lowerIsBetter?: boolean;
};

const metrics: MetricOption[] = [
  { key: "killsPer10", label: "Eliminations", short: "ELIM", icon: Crosshair, tone: "cyan" },
  { key: "damagePer10", label: "Damage", short: "DMG", icon: Flame, tone: "navy" },
  { key: "healingPer10", label: "Healing", short: "HEAL", icon: HeartPulse, tone: "green" },
  { key: "mitigationPer10", label: "Mitigation", short: "MIT", icon: Shield, tone: "cyan" },
  { key: "assistsPer10", label: "Assists", short: "AST", icon: Sparkles, tone: "muted-cyan" },
  { key: "deathsPer10", label: "Lowest deaths", short: "DTH", icon: Skull, tone: "charcoal", lowerIsBetter: true },
];

const roles: Array<{ id: PlayerRole; label: string }> = [
  { id: "ALL", label: "All roles" },
  { id: "TANK", label: "Tank" },
  { id: "DPS", label: "Damage" },
  { id: "SUPPORT", label: "Support" },
];

const statFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function TeamLogo({ src, name, className = "" }: { src: string | null; name: string; className?: string }) {
  return src ? <img className={`history-logo ${className}`} src={src} alt={`${name} logo`} /> : <span className={`history-logo grid place-items-center ${className}`}><Shield size={18} /></span>;
}

function TeamRosterVisual({ team }: { team: (typeof archive.teams)[number] }) {
  const localRosterImage = team.rosterImage?.startsWith("/history/") ? team.rosterImage : null;

  return (
    <article className="roster-visual-card">
      {localRosterImage ? (
        <img className="roster-visual-art" src={localRosterImage} alt={`${team.name} Season 8 roster`} />
      ) : (
        <div className="roster-visual-fallback">
          <div className="roster-watermark"><TeamLogo src={team.logo} name={team.name} /></div>
          <div className="roster-name-list">
            {team.players.map((player, index) => (
              <span key={player.legacyUserId}><small>{String(index + 1).padStart(2, "0")}</small>{player.name}</span>
            ))}
          </div>
        </div>
      )}
      <div className="roster-visual-shade" />
      <div className="roster-logo-lockup">
        <TeamLogo src={team.logo} name={team.name} className="roster-logo" />
        <strong>{team.name}</strong>
      </div>
    </article>
  );
}

function PlayerLeaderboard() {
  const [metricKey, setMetricKey] = useState<MetricKey>("killsPer10");
  const [role, setRole] = useState<PlayerRole>("ALL");
  const metric = metrics.find((item) => item.key === metricKey) || metrics[0];

  const leaderboard = useMemo(() => {
    const filtered = role === "ALL" ? [...archive.playerLeaderboard] : archive.playerLeaderboard.filter((player) => player.role === role);
    return filtered.sort((left, right) => {
      const delta = Number(left[metricKey]) - Number(right[metricKey]);
      return metric.lowerIsBetter ? delta : -delta;
    }).slice(0, 18);
  }, [metric.lowerIsBetter, metricKey, role]);

  const leader = leaderboard[0] as Player | undefined;

  return (
    <section className="player-leaders">
      <div className="history-section-heading">
        <div><span className="ow-eyebrow">Frozen final averages</span><h2>Top players</h2></div>
        <p>Choose a category and role. Every number is the final Season 8 average per 10 minutes.</p>
      </div>

      <div className="metric-selector" aria-label="Statistic category">
        {metrics.map(({ key, label, short, icon: Icon, tone }) => (
          <button type="button" key={key} data-active={metricKey === key} data-tone={tone} onClick={() => setMetricKey(key)}>
            <span><Icon size={23} /></span>
            <small>{short}</small>
            <strong>{label}</strong>
          </button>
        ))}
      </div>

      <div className="role-selector" aria-label="Player role">
        {roles.map((item) => <button type="button" key={item.id} data-active={role === item.id} onClick={() => setRole(item.id)}>{item.label}</button>)}
      </div>

      {leader && (
        <div className="leader-spotlight" data-tone={metric.tone}>
          <div><span>Season leader</span><strong>{leader.player}</strong><small>{leader.team || "Free agent"} / {leader.role}</small></div>
          <div><strong>{statFormatter.format(Number(leader[metricKey]))}</strong><span>{metric.short} / 10</span></div>
        </div>
      )}

      <div className="history-table-wrap player-table-wrap">
        <table className="history-table player-ranking-table">
          <thead><tr><th>Rank</th><th>Player</th><th>Team</th><th>Role</th><th>Maps</th><th>{metric.label} / 10</th></tr></thead>
          <tbody>{leaderboard.map((player, index) => (
            <tr key={player.legacyUserId}>
              <td className="ranking-number">{String(index + 1).padStart(2, "0")}</td>
              <td><strong>{player.player}</strong></td>
              <td>{player.team || "Free agent"}</td>
              <td><span className="role-mark" data-role={player.role}>{player.role}</span></td>
              <td>{player.mapsPlayed}</td>
              <td className="metric-value">{statFormatter.format(Number(player[metricKey]))}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

export function HistoryClient() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") as TabId | null;
  const [active, setActive] = useState<TabId>(tabs.some((tab) => tab.id === requestedTab) ? requestedTab! : "standings");
  const playoffRounds = useMemo(() => {
    const groups = new Map<string, typeof archive.playoffs>();
    for (const match of archive.playoffs) {
      const label = match.type === "FINALS" ? "Grand Final" : match.round === 2 ? "Semifinals" : match.round ? "Quarterfinals" : match.type;
      groups.set(label, [...(groups.get(label) || []), match]);
    }
    return [...groups.entries()];
  }, []);

  const grandFinal = archive.grandFinal;

  return (
    <>
      <div className="history-tabs">
        <div className="ow-container history-tabs-inner">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className="history-tab" data-active={active === id} onClick={() => setActive(id)}>
              <Icon size={17} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="ow-container ow-section history-snapshot-content animate-fade-in" key={active}>
        {active === "standings" && (
          <section>
            <div className="history-section-heading"><div><span className="ow-eyebrow">Season complete</span><h2>Final standings</h2></div><p>The regular-season table exactly as it stood when Season 8 closed.</p></div>
            <div className="history-table-wrap"><table className="history-table standings-table"><thead><tr><th>Rank</th><th>Team</th><th>W</th><th>L</th><th>Maps</th><th>Diff.</th></tr></thead><tbody>{archive.standings.map((row) => <tr key={row.teamId}><td className="ranking-number">{String(row.rank).padStart(2, "0")}</td><td><div className="history-team"><TeamLogo src={row.logo} name={row.team} />{row.team}</div></td><td>{row.wins}</td><td>{row.losses}</td><td>{row.mapWins}-{row.mapLosses}</td><td className={row.mapDifferential >= 0 ? "text-success" : "text-danger"}>{row.mapDifferential > 0 ? "+" : ""}{row.mapDifferential}</td></tr>)}</tbody></table></div>
          </section>
        )}

        {active === "players" && <PlayerLeaderboard />}

        {active === "teams" && (
          <section>
            <div className="history-section-heading"><div><span className="ow-eyebrow">Nine lineups</span><h2>Season 8 rosters</h2></div><p>The teams that played Season 8, preserved with their final five-player lineups.</p></div>
            <div className="roster-visual-grid">{archive.teams.map((team) => <TeamRosterVisual team={team} key={team.id} />)}</div>
          </section>
        )}

        {active === "playoffs" && (
          <section>
            <div className="history-section-heading"><div><span className="ow-eyebrow">Final bracket</span><h2>Playoffs</h2></div><p>Quarterfinals through the Grand Final, with every result frozen.</p></div>
            <div className="bracket-grid">{playoffRounds.map(([label, matches]) => <div className="bracket-round" key={label}><h3>{label}</h3>{matches.map((match) => <article className="bracket-match" key={match.legacyId}><p>{match.title || `Best of ${match.bestOf}`}</p><div className="bracket-side"><span><TeamLogo src={match.teamA.logo} name={match.teamA.name} />{match.teamA.name}</span><strong>{match.score.teamA}</strong></div><div className="bracket-side"><span><TeamLogo src={match.teamB.logo} name={match.teamB.name} />{match.teamB.name}</span><strong>{match.score.teamB}</strong></div></article>)}</div>)}</div>
          </section>
        )}

        {active === "finals" && (
          <section className="grand-final-section">
            <div className="history-section-heading"><div><span className="ow-eyebrow">August 8, 2026</span><h2>Grand Finals</h2></div><p>Best of seven. The final result and published MVP are preserved as part of the season record.</p></div>
            <div className="grand-final-scoreboard">
              <div className="final-team runner-up"><TeamLogo src={grandFinal.runnerUp.logo} name={grandFinal.runnerUp.name} /><span>Runner-up</span><h3>{grandFinal.runnerUp.name}</h3><strong>{grandFinal.runnerUp.score}</strong></div>
              <div className="final-score-divider"><span>Final</span><strong>{grandFinal.runnerUp.score} : {grandFinal.champion.score}</strong><small>Best of {grandFinal.bestOf}</small></div>
              <div className="final-team champion"><TeamLogo src={grandFinal.champion.logo} name={grandFinal.champion.name} /><span>Season 8 Champion</span><h3>{grandFinal.champion.name}</h3><strong>{grandFinal.champion.score}</strong></div>
            </div>
            <div className="grand-final-mvp">
              <div className="mvp-image"><img src={grandFinal.mvp.image} alt={`${grandFinal.mvp.name}, Grand Finals MVP`} /></div>
              <div><span><Medal size={19} /> Grand Finals MVP</span><h3>{grandFinal.mvp.name}</h3><p>{grandFinal.mvp.team}</p></div>
              <div className="mvp-stamp">MVP</div>
            </div>
          </section>
        )}

        {active === "wrapped" && (
          <section className="wrapped-entry">
            <div><span className="ow-eyebrow">Season recap</span><h2>Season 8 Wrapped</h2><p>The full recap is frozen with final statistics, videos, story audio, soundtrack, and artwork.</p><Link href="/history/season-8/wrapped" className="ow-button"><Film size={19} /> Play Wrapped</Link></div>
            <div className="wrapped-entry-stats"><div><strong>{archive.wrapped.snapshot.overview.games}</strong><span>Maps</span></div><div><strong>{archive.wrapped.snapshot.overview.players}</strong><span>Players</span></div><div><strong>{Object.keys(archive.wrapped.assets.videos || {}).length}</strong><span>Videos</span></div><div><strong>{archive.teams.length}</strong><span>Teams</span></div></div>
          </section>
        )}
      </div>
    </>
  );
}
