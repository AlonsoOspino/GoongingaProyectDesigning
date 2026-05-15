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
  leaderboardAfterText?: string | null;
}

const finalizedStatuses = new Set(["PENDINGREGISTERS", "FINISHED"]);

const matchStatusPriority: Record<Match["status"], number> = {
  PENDINGREGISTERS: 0,
  FINISHED: 1,
  ACTIVE: 2,
  SCHEDULED: 3,
};

function getTextWidthCh(values: Array<string | number>, minWidth = 3) {
  const widest = values.reduce<number>((max, value) => Math.max(max, String(value).length), 0);
  return `${Math.max(minWidth, widest)}ch`;
}

function logoUrl(value?: string | null) {
  if (!value) return "";
  const resolved = resolveGenericBackendAsset(value);
  return `/api/logo-square?src=${encodeURIComponent(resolved)}`;
}

function buildMatchCardEntries(weekMatches: Match[], teamsById: Map<number, Team>) {
  const sortedWeekMatches = [...weekMatches].sort((a, b) => {
    const priorityDiff = matchStatusPriority[a.status] - matchStatusPriority[b.status];
    if (priorityDiff !== 0) return priorityDiff;
    return a.id - b.id;
  });

  return sortedWeekMatches.map((match) => {
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
  leaderboardAfterText,
}: LeaderboardOverlayViewProps) {
  const leaderboardPrimaryStatWidth = getTextWidthCh(
    leaderboard.map((team) => `${team.victories}-${team.defeats}`),
    3
  );
  const leaderboardSecondaryStatWidth = getTextWidthCh(
    leaderboard.map((team) => `${team.mapWins}-${team.mapLoses}`),
    3
  );
  const matchTeamWidth = getTextWidthCh(
    matches.flatMap((entry) => [teamAbbreviation(entry.teamA?.name || ""), teamAbbreviation(entry.teamB?.name || "")]),
    3
  );
  const matchCenterWidth = getTextWidthCh(matches.map((entry) => entry.centerText), 4);

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
    gridTemplateColumns: `88px ${leaderboardPrimaryStatWidth} ${leaderboardSecondaryStatWidth}`,
  };

  const matchesWrapStyle: CSSProperties = {
    transform: `translate(calc(-50% + ${settings.matches.offsetX}px), ${settings.matches.offsetY}px) scale(${settings.matches.scale})`,
  };

  const matchListStyle: CSSProperties = {
    rowGap: `${settings.matches.rowGap}px`,
  };

  const matchLogoSize = settings.matches.logoSize || 84;
  const matchRowStyle: CSSProperties = {
    columnGap: `${settings.matches.columnGap}px`,
    color: settings.matches.color,
    // row should not force font family/size so children can be styled individually
    gridTemplateColumns: `${matchLogoSize}px ${matchTeamWidth} ${matchCenterWidth} ${matchTeamWidth} ${matchLogoSize}px`,
  };

  const matchLogoCellStyle: CSSProperties = {
    width: `${matchLogoSize}px`,
    height: `${matchLogoSize}px`,
  };

  const teamTextStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: matchTeamWidth,
    textAlign: "center",
    fontFamily: settings.matches.fontFamily,
    fontSize: `${settings.matches.fontSize}px`,
    fontVariantNumeric: "tabular-nums",
  };

  const centerTextStyle: CSSProperties = {
    display: "inline-block",
    width: matchCenterWidth,
    textAlign: "center",
    justifySelf: "center",
    fontFamily: settings.matches.centerFontFamily ?? settings.title.fontFamily,
    fontSize: `${settings.matches.centerFontSize ?? Math.max(10, Math.round(settings.matches.fontSize * 1.6))}px`,
    transform: `translate(${settings.matches.centerOffsetX ?? 0}px, ${settings.matches.centerOffsetY ?? 0}px)`,
    fontVariantNumeric: "tabular-nums",
  };

  const leftGridStyle: CSSProperties = {
    display: "grid",
    gridColumn: "1 / 3",
    gridTemplateColumns: `${matchLogoSize}px ${matchTeamWidth}`,
    columnGap: `${settings.matches.teamAColumnGap ?? settings.matches.columnGap}px`,
    alignItems: "center",
    transform: `translate(${settings.matches.teamAOffsetX ?? 0}px, ${settings.matches.teamAOffsetY ?? 0}px)`,
  };

  const rightGridStyle: CSSProperties = {
    display: "grid",
    gridColumn: "4 / 6",
    gridTemplateColumns: `${matchTeamWidth} ${matchLogoSize}px`,
    columnGap: `${settings.matches.teamBColumnGap ?? settings.matches.columnGap}px`,
    alignItems: "center",
    transform: `translate(${settings.matches.teamBOffsetX ?? 0}px, ${settings.matches.teamBOffsetY ?? 0}px)`,
  };

  const leaderboardStatStyle: CSSProperties = {
    display: "inline-block",
    minWidth: leaderboardPrimaryStatWidth,
    textAlign: "center",
    fontFamily: settings.leaderboard.fontFamily,
    transform: `translate(${settings.leaderboard.statOffsetX ?? 0}px, ${settings.leaderboard.statOffsetY ?? 0}px)`,
    fontVariantNumeric: "tabular-nums",
  };

  const leaderboardSecondaryStatStyle: CSSProperties = {
    display: "inline-block",
    minWidth: leaderboardSecondaryStatWidth,
    textAlign: "center",
    fontFamily: settings.leaderboard.fontFamily,
    transform: `translate(${settings.leaderboard.statOffsetX ?? 0}px, ${settings.leaderboard.statOffsetY ?? 0}px)`,
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <div className={styles.root}>
      {backgroundImageUrl ? <img src={backgroundImageUrl} alt="" className={styles.backgroundImage} /> : null}

      <div className={styles.content}>
        <h1 className={styles.title} style={titleStyle}>
          {weekLabel}
        </h1>

        {leaderboardAfterText && (
          <div className={styles.leaderboardAfterBanner}>
            {leaderboardAfterText}
          </div>
        )}

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
                <span style={leaderboardStatStyle}>{team.victories}-{team.defeats}</span>
                <span style={leaderboardSecondaryStatStyle}>{team.mapWins}-{team.mapLoses}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.matchesWrap} style={matchesWrapStyle}>
          <div className={styles.matchesList} style={matchListStyle}>
            {matches.length > 0 ? (
              matches.map((entry) => (
                <div key={entry.id} className={styles.matchRow} style={matchRowStyle}>
                  <div style={leftGridStyle}>
                    <div className={styles.matchLogoCell} style={matchLogoCellStyle}>
                      {entry.teamA?.logo ? (
                        <img src={logoUrl(entry.teamA.logo)} alt={entry.teamA.name} className={styles.matchLogo} />
                      ) : (
                        <div className={styles.logoFallback}>{teamAbbreviation(entry.teamA?.name || "")}</div>
                      )}
                    </div>
                    <div style={teamTextStyle}>{teamAbbreviation(entry.teamA?.name || "")}</div>
                  </div>
                  <span className={styles.centerText} style={centerTextStyle}>{entry.centerText}</span>
                  <div style={rightGridStyle}>
                    <div style={teamTextStyle}>{teamAbbreviation(entry.teamB?.name || "")}</div>
                    <div className={styles.matchLogoCell} style={matchLogoCellStyle}>
                      {entry.teamB?.logo ? (
                        <img src={logoUrl(entry.teamB.logo)} alt={entry.teamB.name} className={styles.matchLogo} />
                      ) : (
                        <div className={styles.logoFallback}>{teamAbbreviation(entry.teamB?.name || "")}</div>
                      )}
                    </div>
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
  const safeWeek = Number.isInteger(Number(match.semanas))
    ? Number(match.semanas)
    : Number.isInteger(Number(settings.weekNumber))
    ? Number(settings.weekNumber)
    : 1;

  const lastPendingMatch = [...weekMatches]
    .filter((m) => m.status === "PENDINGREGISTERS")
    .sort((a, b) => b.id - a.id)[0];

  const leaderboardAfterText = lastPendingMatch
    ? `LEADERBOARD AFTER ${teamsById.get(lastPendingMatch.teamAId)?.name || ""} VS ${teamsById.get(lastPendingMatch.teamBId)?.name || ""}`
    : null;

  return (
    <LeaderboardOverlayView
      weekLabel={`Week ${safeWeek > 0 ? safeWeek : 1}`}
      leaderboard={leaderboard}
      matches={buildMatchCardEntries(weekMatches, teamsById)}
      settings={settings}
      backgroundImageUrl={backgroundImageUrl}
      leaderboardAfterText={leaderboardAfterText}
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
