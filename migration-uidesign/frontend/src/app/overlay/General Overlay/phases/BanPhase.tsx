"use client";

import type { DraftState, Team } from "@/lib/api/types";
import { resolveHeroImageUrl, resolveMapImageUrl, resolveGenericBackendAsset } from "@/lib/assetUrls";
import styles from "../overlay.module.css";

export function BanPhase({
  draftState,
  teams,
  getTeamAbbr,
}: {
  draftState: DraftState;
  teams: Team[];
  getTeamAbbr: (name: string) => string;
}) {
  const teamA = teams.find((t) => t.id === draftState?.match?.teamAId);
  const teamB = teams.find((t) => t.id === draftState?.match?.teamBId);

  const actions = draftState?.actions || [];
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
          {teamA?.logo && (
            <img
              src={resolveGenericBackendAsset(teamA.logo)}
              alt={teamA.name}
              className={styles.teamLogo}
            />
          )}
          <div className={styles.teamDetails}>
            <div className={styles.teamName}>{teamA?.name}</div>
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
            <div className={styles.teamName}>{teamB?.name}</div>
            <div className={styles.teamPointsB}>{teamBPoints} pts</div>
          </div>
          {teamB?.logo && (
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
