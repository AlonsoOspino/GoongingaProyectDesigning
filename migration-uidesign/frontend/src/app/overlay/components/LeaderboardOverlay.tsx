import type { CSSProperties } from "react";
import type { LeaderboardOverlaySettings, Match, Team } from "@/lib/api/types";
import { resolveGenericBackendAsset } from "@/lib/assetUrls";
import { teamAbbreviation } from "@/lib/overlay/leaderboardOverlay";
import styles from "./leaderboard-overlay.module.css";

type MatchCardEntry = {
  id: number;
  teamA: Team | null;
  teamB: Team | null;
  centerText: string;
};

interface LeaderboardOverlayViewProps {
  weekLabel: string;
  leaderboard: Team[];
  matches: MatchCardEntry[];
  settings: LeaderboardOverlaySettings;
  backgroundImageUrl?: string | null;
}

const finalizedStatuses = new Set(["PENDINGREGISTERS", "FINISHED"]);

function logoUrl(value?: string | null) {
  if (!value) return "";
  const resolved = resolveGenericBackendAsset(value);
  return `/api/logo-square?src=${encodeURIComponent(resolved)}`;
}

function buildMatchCardEntries(weekMatches: Match[], teamsById: Map<number, Team>) {
  return weekMatches.map((match) => {
    const teamA = teamsById.get(match.teamAId) ?? null;
    const teamB = teamsById.get(match.teamBId) ?? null;
    const isFinalized = finalizedStatuses.has(match.status);

    return {
      id: match.id,
      teamA,
      teamB,
      centerText: isFinalized ? `${match.mapWinsTeamA}-${match.mapWinsTeamB}` : "VS",
    };
  });
}

export function LeaderboardOverlayView({
  weekLabel,
  leaderboard,
  matches,
  settings,
  backgroundImageUrl,
}: LeaderboardOverlayViewProps) {
  const titleStyle: CSSProperties = {
    color: settings.title.color,
    fontFamily: settings.title.fontFamily,
    fontSize: `${settings.title.fontSize}px`,
    transform: `translate(calc(-50% + ${settings.title.offsetX}px), ${settings.title.offsetY}px)`,
  };

  const leaderboardWrapStyle: CSSProperties = {
    transform: `translate(calc(-50% + ${settings.leaderboard.offsetX}px), ${settings.leaderboard.offsetY}px) scale(${settings.leaderboard.scale})`,
  };

  const leaderboardListStyle: CSSProperties = {
    rowGap: `${settings.leaderboard.rowGap}px`,
  };

  const leaderboardRowStyle: CSSProperties = {
    columnGap: `${settings.leaderboard.columnGap}px`,
    color: settings.leaderboard.color,
    fontFamily: settings.leaderboard.fontFamily,
    fontSize: `${settings.leaderboard.fontSize}px`,
    fontWeight: 700,
  };

  const matchesWrapStyle: CSSProperties = {
    transform: `translate(calc(-50% + ${settings.matches.offsetX}px), ${settings.matches.offsetY}px) scale(${settings.matches.scale})`,
  };

  const matchListStyle: CSSProperties = {
    rowGap: `${settings.matches.rowGap}px`,
  };

  const matchRowStyle: CSSProperties = {
    columnGap: `${settings.matches.columnGap}px`,
    color: settings.matches.color,
    fontFamily: settings.matches.fontFamily,
    fontSize: `${settings.matches.fontSize}px`,
    fontWeight: 700,
  };

  return (
    <div className={styles.root}>
      {backgroundImageUrl ? <img src={backgroundImageUrl} alt="" className={styles.backgroundImage} /> : null}

      <div className={styles.content}>
        <h1 className={styles.title} style={titleStyle}>
          {weekLabel}
        </h1>

        <section className={styles.leaderboardWrap} style={leaderboardWrapStyle}>
          <div className={styles.leaderboardList} style={leaderboardListStyle}>
            {leaderboard.map((team) => (
              <div key={team.id} className={styles.leaderboardRow} style={leaderboardRowStyle}>
                <div className={styles.logoCell}>
                  {team.logo ? (
                    <img src={logoUrl(team.logo)} alt={team.name} className={styles.logo} />
                  ) : (
                    <div className={styles.logoFallback}>{teamAbbreviation(team.name)}</div>
                  )}
                </div>
                <span>{team.victories}-{team.defeats}</span>
                <span>{team.mapWins}-{team.mapLoses}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.matchesWrap} style={matchesWrapStyle}>
          <div className={styles.matchesList} style={matchListStyle}>
            {matches.length > 0 ? (
              matches.map((entry) => (
                <div key={entry.id} className={styles.matchRow} style={matchRowStyle}>
                  <div className={styles.matchLogoCell}>
                    {entry.teamA?.logo ? (
                      <img src={logoUrl(entry.teamA.logo)} alt={entry.teamA.name} className={styles.matchLogo} />
                    ) : (
                      <div className={styles.logoFallback}>{teamAbbreviation(entry.teamA?.name || "")}</div>
                    )}
                  </div>
                  <span>{teamAbbreviation(entry.teamA?.name || "")}</span>
                  <span className={styles.centerText}>{entry.centerText}</span>
                  <span>{teamAbbreviation(entry.teamB?.name || "")}</span>
                  <div className={styles.matchLogoCell}>
                    {entry.teamB?.logo ? (
                      <img src={logoUrl(entry.teamB.logo)} alt={entry.teamB.name} className={styles.matchLogo} />
                    ) : (
                      <div className={styles.logoFallback}>{teamAbbreviation(entry.teamB?.name || "")}</div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p style={matchRowStyle}>No matches for this week.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

interface LeaderboardOverlayDataProps {
  match: Match;
  allTeams: Team[];
  leaderboard: Team[];
  weekMatches: Match[];
  settings: LeaderboardOverlaySettings;
  backgroundImageUrl?: string | null;
}

export function LeaderboardOverlayFromData({
  match,
  allTeams,
  leaderboard,
  weekMatches,
  settings,
  backgroundImageUrl,
}: LeaderboardOverlayDataProps) {
  const teamsById = new Map(allTeams.map((team) => [team.id, team]));
  const safeWeek = Number.isInteger(Number(settings.weekNumber))
    ? Number(settings.weekNumber)
    : Number.isInteger(Number(match.semanas))
    ? Number(match.semanas)
    : 1;

  return (
    <LeaderboardOverlayView
      weekLabel={`Week ${safeWeek > 0 ? safeWeek : 1}`}
      leaderboard={leaderboard}
      matches={buildMatchCardEntries(weekMatches, teamsById)}
      settings={settings}
      backgroundImageUrl={backgroundImageUrl}
    />
  );
}

export function LeaderboardOverlayStatus({ message }: { message: string }) {
  return (
    <div className={styles.statusScreen}>
      <p>{message}</p>
    </div>
  );
}
