"use client";

import { useState, useEffect, useParams } from "react";
import { getDraftByMatchId } from "@/lib/api/draft";
import { getTeams } from "@/lib/api";
import type { DraftState, Team } from "@/lib/api/types";
import { resolveHeroImageUrl, resolveTeamAsset } from "@/lib/assetUrls";
import Image from "next/image";

const POLL_INTERVAL = 3000;

export default function BansOverlayPage() {
  const params = useParams();
  const matchId = Number(params.matchId);

  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const teamA = teams.find((t) => t.id === draftState?.match?.teamAId);
  const teamB = teams.find((t) => t.id === draftState?.match?.teamBId);

  const bans = draftState?.bannedHeroes || [];
  const actions = draftState?.actions || [];

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
          getDraftByMatchId(matchId),
          getTeams(),
        ]);
        setDraftState(draft);
        setTeams(teamsList);
      } catch (err) {
        console.error("Failed to load overlay data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [matchId]);

  if (loading || !draftState || !teamA || !teamB) {
    return (
      <div className="w-screen h-screen bg-transparent flex items-center justify-center">
        <div className="text-white text-2xl">Loading overlay...</div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-transparent overflow-hidden flex items-center justify-between px-4 py-2">
      {/* LEFT SIDE - TEAM A */}
      <div className="flex items-center gap-4 flex-1 max-w-sm">
        {/* Team A Bans */}
        <div className="flex gap-2">
          {[0, 1].map((idx) => {
            const ban = teamABans[idx];
            const hero = ban ? heroCache[ban.value] : null;
            return (
              <div key={idx} className="w-16 h-16 relative bg-black/40 rounded border border-red-500/50">
                {hero ? (
                  <img
                    src={resolveHeroImageUrl(hero.imgPath)}
                    alt={hero.name}
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">–</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="text-white/60 text-2xl font-bold">|</div>

        {/* Team A Info */}
        <div className="flex items-center gap-2">
          {teamA.logo && (
            <img
              src={resolveTeamAsset(teamA.logo)}
              alt={teamA.name}
              className="w-12 h-12 object-contain rounded"
            />
          )}
          <div className="flex flex-col gap-0">
            <div className="text-white font-bold text-sm">{teamA.name}</div>
            <div className="text-red-400 font-bold text-lg">{teamAPoints} pts</div>
          </div>
        </div>
      </div>

      {/* CENTER - MAP & MATCH INFO */}
      <div className="flex flex-col items-center gap-2 px-8">
        <div className="text-white font-bold text-sm">MAP {currentGame}</div>
        <div className="text-white/70 text-xs">vs</div>
        {currentMap && (
          <div className="flex items-center gap-2">
            <img
              src={resolveMapImageUrl(currentMap.imgPath)}
              alt={currentMap.description}
              className="w-24 h-24 object-cover rounded"
            />
          </div>
        )}
        <div className="text-white font-bold text-sm">Best of {draftState.match?.bestOf}</div>
        <div className="text-white/50 text-xs">First to {firstTo}</div>
      </div>

      {/* RIGHT SIDE - TEAM B */}
      <div className="flex items-center gap-4 flex-1 max-w-sm justify-end">
        {/* Team B Info */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0 text-right">
            <div className="text-white font-bold text-sm">{teamB.name}</div>
            <div className="text-blue-400 font-bold text-lg">{teamBPoints} pts</div>
          </div>
          {teamB.logo && (
            <img
              src={resolveTeamAsset(teamB.logo)}
              alt={teamB.name}
              className="w-12 h-12 object-contain rounded"
            />
          )}
        </div>

        {/* Divider */}
        <div className="text-white/60 text-2xl font-bold">|</div>

        {/* Team B Bans */}
        <div className="flex gap-2">
          {[0, 1].map((idx) => {
            const ban = teamBBans[idx];
            const hero = ban ? heroCache[ban.value] : null;
            return (
              <div key={idx} className="w-16 h-16 relative bg-black/40 rounded border border-blue-500/50">
                {hero ? (
                  <img
                    src={resolveHeroImageUrl(hero.imgPath)}
                    alt={hero.name}
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">–</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
