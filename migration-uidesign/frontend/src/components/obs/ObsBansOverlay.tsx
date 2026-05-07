'use client';

import { useEffect, useRef, useState } from 'react';
import { getDraftByMatchId } from '@/lib/api/draft';
import { getMatches } from '@/lib/api/match';
import type { DraftState, Match } from '@/lib/api/types';
import { obsManager } from '@/lib/obs/websocket';

interface Ban {
  heroId: number | null;
  teamId: number;
  teamName: string;
  index: number; // 0 or 1 for first or second ban
}

interface BanCycle {
  bans: Ban[];
  currentIndex: number;
}

export default function ObsBansOverlay({
  matchId,
  obsHost = 'localhost',
  obsPort = 4455,
  obsPassword = '',
}: {
  matchId: number;
  obsHost?: string;
  obsPort?: number;
  obsPassword?: string;
}) {
  const [match, setMatch] = useState<Match | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [banCycle, setBanCycle] = useState<BanCycle>({ bans: [], currentIndex: 0 });
  const [currentBan, setCurrentBan] = useState<Ban | null>(null);
  const [videoPath, setVideoPath] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const VIDEO_DURATION = 15000; // 15 seconds in milliseconds

  // Fetch match and draft data
  useEffect(() => {
    const loadData = async () => {
      try {
        const matches = await getMatches();
        const foundMatch = matches.find((m) => m.id === matchId);

        if (!foundMatch) {
          setError('Match not found');
          return;
        }

        setMatch(foundMatch);

        const draftState = await getDraftByMatchId(matchId);
        setDraft(draftState);
      } catch (err) {
        console.error('[v0] Error loading draft data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load draft');
      }
    };

    loadData();

    // Poll for draft updates every 2 seconds
    pollRef.current = setInterval(loadData, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [matchId]);

  // Connect to OBS WebSocket
  useEffect(() => {
    if (obsPassword) {
      obsManager
        .connect({
          url: `ws://${obsHost}:${obsPort}`,
          password: obsPassword,
        })
        .catch((err) => console.error('[v0] Failed to connect to OBS:', err));
    }

    return () => {
      obsManager.disconnect().catch(() => {});
    };
  }, [obsHost, obsPort, obsPassword]);

  // Organize bans into a cycle
  useEffect(() => {
    if (!draft || !match) return;

    const teamAName = (match as any).teamA?.name || 'Team A';
    const teamBName = (match as any).teamB?.name || 'Team B';

    // Get all bans from draft actions, organized by team
    const teamABans: Ban[] = [];
    const teamBBans: Ban[] = [];

    draft.actions
      .filter((action) => action.action === 'BAN')
      .sort((a, b) => a.order - b.order)
      .forEach((action) => {
        if (action.teamId === match.teamAId) {
          if (teamABans.length < 2) {
            teamABans.push({
              heroId: action.value,
              teamId: action.teamId,
              teamName: teamAName,
              index: teamABans.length,
            });
          }
        } else if (action.teamId === match.teamBId) {
          if (teamBBans.length < 2) {
            teamBBans.push({
              heroId: action.value,
              teamId: action.teamId,
              teamName: teamBName,
              index: teamBBans.length,
            });
          }
        }
      });

    // Create cycle: Team A ban 1, Team A ban 2, Team B ban 1, Team B ban 2, repeat
    const cycle: Ban[] = [];

    // Add Team A bans
    if (teamABans.length > 0) cycle.push(teamABans[0]);
    if (teamABans.length > 1) cycle.push(teamABans[1]);

    // Add Team B bans
    if (teamBBans.length > 0) cycle.push(teamBBans[0]);
    if (teamBBans.length > 1) cycle.push(teamBBans[1]);

    // If no bans yet, return early
    if (cycle.length === 0) {
      setBanCycle({ bans: [], currentIndex: 0 });
      setCurrentBan(null);
      return;
    }

    setBanCycle({ bans: cycle, currentIndex: 0 });
    setCurrentBan(cycle[0]);
  }, [draft, match]);

  // Handle video playback and ban rotation
  useEffect(() => {
    if (!currentBan || banCycle.bans.length === 0) {
      setIsPlaying(false);
      return;
    }

    const playVideo = async () => {
      setIsPlaying(true);

      // Update OBS text sources
      if (currentBan.index === 0) {
        // First ban of the team
        const isTeamA = match?.teamAId === currentBan.teamId;
        const sourcePosition = isTeamA ? 'TOPLEFT' : 'TOPRIGHT';
        const textValue = `${currentBan.teamName}'S BANS`;

        await obsManager.updateTextSource(sourcePosition, textValue);
        console.log(`[v0] Updated ${sourcePosition} to: ${textValue}`);
      }

      // Set video source path
      if (currentBan.heroId) {
        setVideoPath(`/heroes/${currentBan.heroId}.mp4`);
      } else {
        setVideoPath('');
      }

      // Play video if it exists
      if (videoRef.current && currentBan.heroId) {
        try {
          await videoRef.current.play();
        } catch (err) {
          console.warn('[v0] Could not play video:', err);
        }
      }

      // Schedule next ban after video duration
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        const nextIndex = (banCycle.currentIndex + 1) % banCycle.bans.length;
        setBanCycle((prev) => ({ ...prev, currentIndex: nextIndex }));
        setCurrentBan(banCycle.bans[nextIndex]);
      }, VIDEO_DURATION);
    };

    playVideo();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentBan, banCycle, match]);

  // Check if match is in PLAYING phase
  if (!draft || draft.phase !== 'PLAYING') {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        {error && <p className="text-red-500">{error}</p>}
        {!error && <p>Waiting for draft phase to reach PLAYING...</p>}
      </div>
    );
  }

  if (!currentBan) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <p>Loading bans...</p>
      </div>
    );
  }

  const isTeamA = match?.teamAId === currentBan.teamId;
  const titlePosition = isTeamA ? 'top-4 left-4' : 'top-4 right-4';
  const titleClass = isTeamA ? 'text-left' : 'text-right';

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Video display */}
      <div className="absolute inset-0 flex items-center justify-center">
        {videoPath && (
          <video
            ref={videoRef}
            src={videoPath}
            className="h-full w-auto object-cover"
            onEnded={() => {
              // Move to next ban when video ends
              const nextIndex = (banCycle.currentIndex + 1) % banCycle.bans.length;
              setBanCycle((prev) => ({ ...prev, currentIndex: nextIndex }));
              setCurrentBan(banCycle.bans[nextIndex]);
            }}
          />
        )}
      </div>

      {/* Team Ban Title Overlay */}
      <div className={`absolute ${titlePosition} z-10`}>
        <div className={`text-white text-3xl font-bold drop-shadow-lg ${titleClass}`}>
          {currentBan.teamName}&apos;S BANS
        </div>
      </div>

      {/* Debug info (remove in production) */}
      <div className="absolute bottom-4 left-4 text-white text-xs opacity-50">
        <p>Match: {match?.id}</p>
        <p>Phase: {draft?.phase}</p>
        <p>
          Ban {banCycle.currentIndex + 1} / {banCycle.bans.length}
        </p>
        <p>Hero: {currentBan.heroId || 'Skipped'}</p>
      </div>
    </div>
  );
}
