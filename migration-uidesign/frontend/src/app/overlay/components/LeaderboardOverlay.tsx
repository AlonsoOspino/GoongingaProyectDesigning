import type { CSSProperties } from "react";
import type { LeaderboardOverlaySettings, Match, Team } from "@/lib/api/types";
import { resolveGenericBackendAsset } from "@/lib/assetUrls";
import { resolveTeamAbbreviation } from "@/lib/overlay/leaderboardOverlay";
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

function sortMatchesByScheduledDate(matches: Match[]) {
  return [...matches].sort((a, b) => {
    const aDate = a.startDate ? new Date(a.startDate).getTime() : Number.POSITIVE_INFINITY;
    const bDate = b.startDate ? new Date(b.startDate).getTime() : Number.POSITIVE_INFINITY;
    const aHasValidDate = Number.isFinite(aDate);
    const bHasValidDate = Number.isFinite(bDate);

    if (aHasValidDate && !bHasValidDate) return -1;
    if (!aHasValidDate && bHasValidDate) return 1;

    if (aHasValidDate && bHasValidDate) {
      const dateDiff = aDate - bDate;
      if (dateDiff !== 0) return dateDiff;
    }

    if (!aHasValidDate && !bHasValidDate) {
      const priorityDiff = matchStatusPriority[a.status] - matchStatusPriority[b.status];
      if (priorityDiff !== 0) return priorityDiff;
    }

    return a.id - b.id;
  });
}

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
  const sortedWeekMatches = sortMatchesByScheduledDate(weekMatches);

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
  const baseLeaderboardFontSize = 42;
  const leaderboardFontScale = settings.leaderboard.fontSize / baseLeaderboardFontSize;
  const teamCode = (team: Team | null | undefined) => resolveTeamAbbreviation(team, settings.teamAbbreviations);
  const matchTeamWidth = getTextWidthCh(
    matches.flatMap((entry) => [teamCode(entry.teamA), teamCode(entry.teamB)]),
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: leaderboardPrimaryStatWidth,
    height: `${baseLeaderboardFontSize}px`,
    textAlign: "center",
    fontFamily: settings.leaderboard.fontFamily,
    transform: `translate(${settings.leaderboard.statOffsetX ?? 0}px, ${settings.leaderboard.statOffsetY ?? 0}px)`,
    fontVariantNumeric: "tabular-nums",
    overflow: "visible",
  };

  const leaderboardSecondaryStatStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: leaderboardSecondaryStatWidth,
    height: `${baseLeaderboardFontSize}px`,
    textAlign: "center",
    fontFamily: settings.leaderboard.fontFamily,
    transform: `translate(${settings.leaderboard.statOffsetX ?? 0}px, ${settings.leaderboard.statOffsetY ?? 0}px)`,
    fontVariantNumeric: "tabular-nums",
    overflow: "visible",
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
                    <div className={styles.logoFallback}>{teamCode(team)}</div>
                  )}
                </div>
                <span style={leaderboardStatStyle}>
                  <span
                    style={{
                      display: "inline-block",
                      fontFamily: settings.leaderboard.fontFamily,
                      fontSize: `${baseLeaderboardFontSize}px`,
                      transform: `scale(${leaderboardFontScale})`,
                      transformOrigin: "center",
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {team.victories}-{team.defeats}
                  </span>
                </span>
                <span style={leaderboardSecondaryStatStyle}>
                  <span
                    style={{
                      display: "inline-block",
                      fontFamily: settings.leaderboard.fontFamily,
                      fontSize: `${baseLeaderboardFontSize}px`,
                      transform: `scale(${leaderboardFontScale})`,
                      transformOrigin: "center",
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {team.mapWins}-{team.mapLoses}
                  </span>
                </span>
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
                        <div className={styles.logoFallback}>{teamCode(entry.teamA)}</div>
                      )}
                    </div>
                    <div style={teamTextStyle}>{teamCode(entry.teamA)}</div>
                  </div>
                  <span className={styles.centerText} style={centerTextStyle}>{entry.centerText}</span>
                  <div style={rightGridStyle}>
                    <div style={teamTextStyle}>{teamCode(entry.teamB)}</div>
                    <div className={styles.matchLogoCell} style={matchLogoCellStyle}>
                      {entry.teamB?.logo ? (
                        <img src={logoUrl(entry.teamB.logo)} alt={entry.teamB.name} className={styles.matchLogo} />
                      ) : (
                        <div className={styles.logoFallback}>{teamCode(entry.teamB)}</div>
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
