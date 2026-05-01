"use client";

import type { DraftState, Team, Match } from "@/lib/api/types";
import { resolveGenericBackendAsset } from "@/lib/assetUrls";
import styles from "../overlay.module.css";

export function StartingPhase({
  draftState,
  teams,
  leaderboard,
  matches,
  getTeamAbbr,
}: {
  draftState: DraftState;
  teams: Team[];
  leaderboard: Team[];
  matches: Match[];
  getTeamAbbr: (name: string) => string;
}) {
  const teamA = teams.find((t) => t.id === draftState?.match?.teamAId);
  const teamB = teams.find((t) => t.id === draftState?.match?.teamBId);

  return (
    <div className={`${styles.container} ${styles.prematchBackground}`}>
      {/* LEFT SIDE - STANDINGS */}
      <div className={styles.prematchLeft}>
        {/* Tournament Header */}
        <div className={styles.prematchTournamentHeader}>
          <div className={styles.prematchTournamentTitle}></div>
        </div>

        {/* Leaderboard Table */}
        <div className={styles.prematchLeaderboardTable}>
          <div className={styles.prematchTableHeader}>
            <div className={styles.prematchTeamColumn}></div>
            <div className={styles.prematchWlColumn}></div>
            <div className={styles.prematchMapColumn}></div>
          </div>

          <div className={styles.prematchTableBody}>
            {leaderboard.slice(0, 8).map((team) => (
              <div key={team.id} className={styles.prematchTableRow}>
                <div className={styles.prematchTeamCell}>
                  <div className={styles.prematchTeamIcon}>
                    {team.logo ? (
                      <img
                        src={resolveGenericBackendAsset(team.logo)}
                        alt={team.name}
                        className={styles.prematchTeamLogo}
                      />
                    ) : (
                      <div className={styles.prematchTeamLogoPlaceholder} aria-hidden="true" />
                    )}
                  </div>
                </div>
                <div className={styles.prematchWlCell}>&nbsp;&nbsp;{team.victories}-{team.defeats}</div>
                <div className={styles.prematchMapCell}>
                  {team.mapWins}-{team.mapLoses}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - TOURNAMENT HEADER & FEATURED MATCH */}
      <div className={styles.prematchRight}>
        {/* Tournament Badge */}
        <div className={styles.prematchBadgeText}>
          <br />
          <span className={styles.prematchBadgeWeek}>
            {draftState.match?.type === "PLAYOFFS"
              ? "PLAYOFFS"
              : draftState.match?.type === "PLAYINS"
                ? "PLAYINS"
                : `Week ${draftState.match?.semanas || 1}`}
          </span>
        </div>

        {/* Week Matches */}
        <div className={styles.prematchWeekMatches}>
          {matches.map((match) => {
            const matchTeamA = teams.find((t) => t.id === match.teamAId);
            const matchTeamB = teams.find((t) => t.id === match.teamBId);

            // Determine if score should be shown
            const isFinished = match.status === "PENDINGREGISTERS" || match.status === "FINISHED";
            const scoreDisplay = `${match.mapWinsTeamA}-${match.mapWinsTeamB}`;

            return (
              <div key={match.id} className={styles.prematchMatchRow}>
                <div className={styles.prematchMatchTeam}>
                  <div className={styles.prematchMatchTeamLogo}>
                    {matchTeamA?.logo ? (
                      <img src={resolveGenericBackendAsset(matchTeamA.logo)} alt={matchTeamA.name} />
                    ) : (
                      <div className={styles.prematchTeamLogoPlaceholder} aria-hidden="true" />
                    )}
                  </div>
                  <div className={styles.prematchMatchTeamAbbrA}>{getTeamAbbr(matchTeamA?.name || "")}</div>
                </div>

                <div className={styles.prematchMatchCenter}>
                  {isFinished ? (
                    <div className={styles.prematchScore}>{scoreDisplay}</div>
                  ) : (
                    <div className={styles.prematchMatchVersus}>VS</div>
                  )}
                </div>

                <div className={styles.prematchMatchTeam}>
                  <div className={styles.prematchMatchTeamAbbrB}>{getTeamAbbr(matchTeamB?.name || "")}</div>
                  <div className={styles.prematchMatchTeamLogo}>
                    {matchTeamB?.logo ? (
                      <img src={resolveGenericBackendAsset(matchTeamB.logo)} alt={matchTeamB.name} />
                    ) : (
                      <div className={styles.prematchTeamLogoPlaceholder} aria-hidden="true" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
