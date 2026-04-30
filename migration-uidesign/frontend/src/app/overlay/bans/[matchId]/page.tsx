"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getDraftByMatchId } from "@/lib/api/draft";
import { getTeams, getLeaderboard, getMatchesByWeek } from "@/lib/api";
import type { DraftState, Team, Match } from "@/lib/api/types";
import { resolveHeroImageUrl, resolveMapImageUrl, resolveGenericBackendAsset } from "@/lib/assetUrls";
import styles from "../overlay.module.css";

const POLL_INTERVAL = 3000;

export default function BansOverlayPage() {
  const params = useParams();
  const matchId = Number(params.matchId);
  const searchParams = useSearchParams();
  const urlKey = searchParams?.get("key");

  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [leaderboard, setLeaderboard] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const teamA = teams.find((t) => t.id === draftState?.match?.teamAId);
  const teamB = teams.find((t) => t.id === draftState?.match?.teamBId);

  const bans = draftState?.bannedHeroes || [];
  const actions = draftState?.actions || [];

  // Helper functions
  const getTeamAbbr = (name: string) => name.substring(0, 3).toUpperCase();
  const getTournamentAbbr = (name: string) => {
    const words = name.split(" ");
    return words.map((w) => w[0]).join("").toUpperCase();
  };

  // Get team-specific bans for current game
  const currentGame = (draftState?.match?.gameNumber || 0) + 1;
  const teamABans = actions
    .filter((a) => a.action === "BAN" && a.teamId === teamA?.id && a.gameNumber === currentGame)
    .slice(0, 2);
  const teamBBans = actions
    .filter((a) => a.action === "BAN" && a.teamId === teamB?.id && a.gameNumber === currentGame)
    .slice(0, 2);

  const heroCache: Record<number, any> = {};
  draftState?.heroes?.forEach((h) => {
    heroCache[h.id] = h;
  });

  const firstTo = Math.ceil((draftState?.match?.bestOf || 5) / 2);
  const teamAPoints = draftState?.match?.mapWinsTeamA || 0;
  const teamBPoints = draftState?.match?.mapWinsTeamB || 0;

  const currentMap = draftState?.allMaps?.find((m) => m.id === draftState.currentMapId);

  useEffect(() => {
    const loadData = async () => {
      try {
          const [draft, teamsList] = await Promise.all([
            getDraftByMatchId(matchId, { key: urlKey ?? undefined }),
            getTeams(),
          ]);
        setDraftState(draft);
        setTeams(teamsList);
        
        // Fetch leaderboard and all matches for the same week
        if (draft && draft.match?.tournamentId) {
          const week = draft.match.semanas || 1;
          const [leaderboardData, matchesData] = await Promise.all([
            getLeaderboard(draft.match.tournamentId),
            getMatchesByWeek(draft.match.tournamentId, week),
          ]);
          setLeaderboard(leaderboardData);
          setMatches(matchesData);
        }
      } catch (err) {
        console.error("Failed to load overlay data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [matchId, urlKey]);

  if (loading || !draftState || !teamA || !teamB) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingText}>Loading overlay...</div>
      </div>
    );
  }

  // Render STARTING phase - Standings view
  if (draftState.phase === "STARTING") {
    return <PrematchOverlay draftState={draftState} teams={teams} leaderboard={leaderboard} matches={matches} getTeamAbbr={getTeamAbbr} getTournamentAbbr={getTournamentAbbr} />;
  }

  // Render BAN phase and other phases - Bans view
  return (
    <div className={styles.container}>
      {/* LEFT SIDE - TEAM A */}
      <div className={styles.sectionLeft}>
        {/* Team A Bans */}
        <div className={styles.bansContainer}>
          {[0, 1].map((idx) => {
            const ban = teamABans[idx];
            const hero = ban && ban.value != null ? heroCache[ban.value] : null;
            return (
              <div key={idx} className={styles.banSlotA}>
                {hero ? (
                  <img
                    src={resolveHeroImageUrl(hero.imgPath)}
                    alt={hero.name}
                    className={styles.banImage}
                  />
                ) : (
                  <div className={styles.emptyBan}>–</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className={styles.divider}>|</div>

        {/* Team A Info */}
        <div className={styles.teamInfo}>
          {teamA.logo && (
            <img
              src={resolveGenericBackendAsset(teamA.logo)}
              alt={teamA.name}
              className={styles.teamLogo}
            />
          )}
          <div className={styles.teamDetails}>
            <div className={styles.teamName}>{teamA.name}</div>
            <div className={styles.teamPointsA}>{teamAPoints} pts</div>
          </div>
        </div>
      </div>

      {/* CENTER - MAP & MATCH INFO */}
      <div className={styles.centerSection}>
        <div className={styles.mapNumber}>MAP {currentGame}</div>
        {currentMap && (
          <img
            src={resolveMapImageUrl(currentMap.imgPath)}
            alt={currentMap.description}
            className={styles.mapImage}
          />
        )}
        <div className={styles.bestOfInfo}>
          <div className={styles.bestOf}>Best of {draftState.match?.bestOf}</div>
          <div className={styles.firstTo}>First to {firstTo}</div>
        </div>
      </div>

      {/* RIGHT SIDE - TEAM B */}
      <div className={styles.sectionRight}>
        {/* Team B Info */}
        <div className={styles.teamInfoRight}>
          <div className={styles.teamDetailsRight}>
            <div className={styles.teamName}>{teamB.name}</div>
            <div className={styles.teamPointsB}>{teamBPoints} pts</div>
          </div>
          {teamB.logo && (
            <img
              src={resolveGenericBackendAsset(teamB.logo)}
              alt={teamB.name}
              className={styles.teamLogo}
            />
          )}
        </div>

        {/* Divider */}
        <div className={styles.divider}>|</div>

        {/* Team B Bans */}
        <div className={styles.bansContainer}>
          {[0, 1].map((idx) => {
            const ban = teamBBans[idx];
            const hero = ban && ban.value != null ? heroCache[ban.value] : null;
            return (
              <div key={idx} className={styles.banSlotB}>
                {hero ? (
                  <img
                    src={resolveHeroImageUrl(hero.imgPath)}
                    alt={hero.name}
                    className={styles.banImage}
                  />
                ) : (
                  <div className={styles.emptyBan}>–</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==================== PREMATCH OVERLAY ====================

function PrematchOverlay({
  draftState,
  teams,
  leaderboard,
  matches,
  getTeamAbbr,
  getTournamentAbbr,
}: {
  draftState: DraftState;
  teams: Team[];
  leaderboard: Team[];
  matches: Match[];
  getTeamAbbr: (name: string) => string;
  getTournamentAbbr: (name: string) => string;
}) {
  const teamA = teams.find((t) => t.id === draftState?.match?.teamAId);
  const teamB = teams.find((t) => t.id === draftState?.match?.teamBId);

  return (
    <div className={`${styles.container} ${styles.prematchBackground}`}>
      {/* LEFT SIDE - STANDINGS */}
      <div className={styles.prematchLeft}>
        {/* Tournament Header */}
        <div className={styles.prematchTournamentHeader}>
          <div className={styles.prematchTournamentTitle}>
          </div>
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
        <div className={styles.prematchTournamentBadge}>
          <div className={styles.prematchBadgeCircle}>
            <div className={styles.prematchBadgeText}>
              GGL
              <br />
              {getTournamentAbbr(draftState.match.toString())}
            </div>
          </div>
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
