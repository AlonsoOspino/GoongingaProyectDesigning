"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getMatchById } from "@/lib/api/admin";
import { getDraftByMatchId } from "@/lib/api/draft";
import { getTeams } from "@/lib/api/team";
import type { DraftState, Hero, Match, Team } from "@/lib/api/types";
import { isDevMatchReference, type MatchReference } from "@/lib/matchReference";
import { resolveGenericBackendAsset, resolveHeroImageUrl } from "@/lib/assetUrls";
import styles from "./match-header-overlay.module.css";

interface MatchHeaderOverlayProps {
  matchId: MatchReference | null;
  reverseSides?: boolean;
}

const POLL_INTERVAL_MS = 10000;

function teamAssetUrl(pathValue?: string | null) {
  if (!pathValue) return "";
  return resolveGenericBackendAsset(pathValue);
}

export function MatchHeaderOverlay({ matchId, reverseSides = false }: MatchHeaderOverlayProps) {
  const searchParams = useSearchParams();
  const shareKey = searchParams.get("key") || undefined;
  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const isDevMatch = matchId === "dev";
  const headerBanSlots = isDevMatch ? 1 : 2;

  useEffect(() => {
    if (matchId === null) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const [loadedMatch, loadedTeams] = await Promise.all([
          getMatchById(matchId),
          getTeams({ includeDev: isDevMatchReference(matchId) }),
        ]);
        const loadedDraft = await getDraftByMatchId(matchId, { key: shareKey }).catch(() => undefined);

        if (cancelled) return;
        setMatch(loadedMatch);
        setTeams(loadedTeams);
        if (loadedDraft !== undefined) setDraft(loadedDraft);
      } catch {
        if (cancelled) return;
        // Keep the last confirmed program frame during recoverable failures.
      }
    };

    void load();
    const pollId = window.setInterval(() => {
      void load();
    }, isDevMatchReference(matchId) ? 1200 : POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [matchId, shareKey]);

  const teamsById = useMemo(() => {
    const result = new Map<number, Team>();
    for (const team of teams) {
      result.set(team.id, team);
    }
    return result;
  }, [teams]);

  const teamA = useMemo(
    () => (match ? teamsById.get(match.teamAId) ?? null : null),
    [match, teamsById]
  );

  const teamB = useMemo(
    () => (match ? teamsById.get(match.teamBId) ?? null : null),
    [match, teamsById]
  );

  const currentGameNumber = useMemo(() => {
    if (!match) return null;
    const nextGame = (match.gameNumber ?? 0) + 1;
    return nextGame < 1 ? 1 : nextGame;
  }, [match]);

  const heroesById = useMemo(() => {
    const result = new Map<number, Hero>();
    for (const hero of draft?.heroes ?? []) {
      result.set(hero.id, hero);
    }
    return result;
  }, [draft?.heroes]);

  const bansByTeam = useMemo(() => {
    const result = new Map<number, Array<number | null>>();
    if (!draft || !currentGameNumber) return result;

    const actions = Array.isArray(draft.actions) ? draft.actions : [];
    for (const action of actions) {
      if (action.action !== "BAN" || action.gameNumber !== currentGameNumber) continue;
      const list = result.get(action.teamId) ?? [];
      if (list.length >= headerBanSlots) continue;
      list.push(action.value ?? null);
      result.set(action.teamId, list);
    }

    return result;
  }, [draft, currentGameNumber, headerBanSlots]);

  const teamABans = useMemo(() => {
    const list = match ? bansByTeam.get(match.teamAId) ?? [] : [];
    const filled = [...list];
    while (filled.length < headerBanSlots) filled.push(null);
    return filled.slice(0, headerBanSlots);
  }, [bansByTeam, headerBanSlots, match]);

  const teamBBans = useMemo(() => {
    const list = match ? bansByTeam.get(match.teamBId) ?? [] : [];
    const filled = [...list];
    while (filled.length < headerBanSlots) filled.push(null);
    return filled.slice(0, headerBanSlots);
  }, [bansByTeam, headerBanSlots, match]);

  const leftTeam = reverseSides ? teamB : teamA;
  const rightTeam = reverseSides ? teamA : teamB;
  const leftTeamBans = reverseSides ? teamBBans : teamABans;
  const rightTeamBans = reverseSides ? teamABans : teamBBans;
  const leftScore = reverseSides ? match?.mapWinsTeamB ?? 0 : match?.mapWinsTeamA ?? 0;
  const rightScore = reverseSides ? match?.mapWinsTeamA ?? 0 : match?.mapWinsTeamB ?? 0;

  const renderTeamBanner = (team: Team | null, side: "left" | "right") => {
    const roster = team?.roster?.trim();
    const rosterArtwork = roster && /^(https?:\/\/|data:image\/|blob:|\/)/.test(roster) ? roster : null;
    const banner = (side === "left" ? team?.bannerLeft : team?.bannerRight) || rosterArtwork;
    const teamName = team?.name || "TEAM";

    return (
      <div className={styles.bannerFrame}>
        {banner ? (
          <div className={styles.bannerIdentity}>
            <img className={styles.bannerImage} src={teamAssetUrl(banner)} alt="" />
            <span className={styles.bannerName}>{teamName}</span>
          </div>
        ) : team?.logo ? (
          <div className={side === "right" ? `${styles.logoFallback} ${styles.logoFallbackRight}` : styles.logoFallback}>
            <img className={styles.logoFallbackImage} src={teamAssetUrl(team.logo)} alt="" />
            <span>{teamName}</span>
          </div>
        ) : (
          <div className={styles.fallback}>{teamName}</div>
        )}
      </div>
    );
  };

  const renderBans = (bans: Array<number | null>) => (
    <div className={styles.banStack}>
      {bans.map((heroId, index) => {
        const hero = heroId ? heroesById.get(heroId) : null;
        return (
          <div key={index} className={styles.banSlot}>
            {hero?.imgPath ? (
              <img className={styles.banImage} src={resolveHeroImageUrl(hero.imgPath)} alt={hero.name || ""} />
            ) : (
              <div className={styles.banFallback}>-</div>
            )}
          </div>
        );
      })}
    </div>
  );

  if (!match) {
    return <div className={styles.root} data-dev={isDevMatch}><div className={styles.standby} role="status">Match header · stand by</div></div>;
  }

  return (
    <div className={styles.root} data-dev={isDevMatch}>
      <header className={styles.headerBar}>
        <div className={styles.decor} aria-hidden />

        <div className={styles.content}>
          <section className={styles.lane}>
            {renderTeamBanner(leftTeam, "left")}
            {renderBans(leftTeamBans)}
            <div className={styles.scoreValue}>{leftScore}</div>
          </section>

          <section className={styles.centerBlank} />

          <section className={styles.laneRight}>
            <div className={styles.scoreValue}>{rightScore}</div>
            {renderBans(rightTeamBans)}
            {renderTeamBanner(rightTeam, "right")}
          </section>
        </div>
      </header>
    </div>
  );
}
