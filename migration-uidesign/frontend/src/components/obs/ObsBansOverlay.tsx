'use client';

import { useEffect, useRef, useState } from 'react';
import { getDraftByMatchId } from '@/lib/api/draft';
import { getMatches } from '@/lib/api/match';
import { getTeams } from '@/lib/api/team';
import type { DraftState, Match, Team } from '@/lib/api/types';
import { obsManager, OBSConnectionError } from '@/lib/obs/websocket';

interface Ban {
  heroId: number | null;
  teamId: number;
  teamName: string;
  index: number; // 0 or 1 for first or second ban
}

export default function ObsBansOverlay({
  matchId,
  obsWebsocketUrl = '',
  obsWebsocketPassword = '',
  heroVideoFolderPath = '',
}: {
  matchId: number;
  obsWebsocketUrl?: string;
  obsWebsocketPassword?: string;
  heroVideoFolderPath?: string;
}) {
  const [match, setMatch] = useState<Match | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [obsStatus, setObsStatus] = useState<
    | { state: 'idle' }
    | { state: 'connecting' }
    | { state: 'connected' }
    | { state: 'error'; message: string; hint?: string }
  >({ state: 'idle' });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const bansRef = useRef<Ban[]>([]);

  const VIDEO_DURATION = 15000; // 15 seconds in milliseconds
  
  // Derive currentBan from index
  const currentBan = bans.length > 0 && currentIndex < bans.length ? bans[currentIndex] : null;

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

        // Fetch teams for team name lookup
        const allTeams = await getTeams();
        setTeams(allTeams);

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
    if (!obsWebsocketUrl || !obsWebsocketPassword) {
      setObsStatus({
        state: 'error',
        message: 'OBS WebSocket URL or password missing.',
        hint: 'Configure them in the Manager Dashboard → Stream Settings.',
      });
      return;
    }

    let cancelled = false;
    setObsStatus({ state: 'connecting' });

    obsManager
      .connect({ url: obsWebsocketUrl, password: obsWebsocketPassword })
      .then(() => {
        if (cancelled) return;
        setObsStatus({ state: 'connected' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Failed to connect to OBS WebSocket';
        const hint = err instanceof OBSConnectionError ? err.hint : undefined;
        console.error('[v0] OBS connect error:', err);
        setObsStatus({ state: 'error', message, hint });
      });

    return () => {
      cancelled = true;
      obsManager.disconnect().catch(() => {});
    };
  }, [obsWebsocketUrl, obsWebsocketPassword]);

  // Organize bans into a cycle
  useEffect(() => {
    if (!draft || !match || teams.length === 0) {
      console.log('[v0] Not organizing bans - missing data:', {
        hasDraft: !!draft,
        hasMatch: !!match,
        teamsLength: teams.length,
      });
      return;
    }

    // Get team names from teams array
    const teamA = teams.find((t) => t.id === match.teamAId);
    const teamB = teams.find((t) => t.id === match.teamBId);

    const teamAName = teamA?.name || `Team A`;
    const teamBName = teamB?.name || `Team B`;

    console.log('[v0] Team names found:', {
      matchId: match.id,
      gameNumber: match.gameNumber,
      teamAId: match.teamAId,
      teamAName,
      teamBId: match.teamBId,
      teamBName,
    });

    // Get all bans from draft actions, organized by team for CURRENT GAME
    const teamABans: Ban[] = [];
    const teamBBans: Ban[] = [];

    let bansForThisGame = draft.actions.filter(
      (action) => action.action === 'BAN' && action.gameNumber === match.gameNumber
    );

    // If there are no bans for the current match.gameNumber (e.g. gameNumber=0),
    // fall back to the latest game's bans in the draft if present.
    if (bansForThisGame.length === 0) {
      const banActions = draft.actions.filter((a) => a.action === 'BAN');
      if (banActions.length > 0) {
        const latestGame = Math.max(...banActions.map((a) => a.gameNumber));
        console.log('[v0] No bans for current gameNumber, falling back to latestGame:', latestGame);
        bansForThisGame = banActions.filter((a) => a.gameNumber === latestGame);
      }
    }

    console.log('[v0] Bans found for game:', {
      gameNumber: match.gameNumber,
      totalBans: bansForThisGame.length,
      bans: bansForThisGame.map((b) => ({ heroId: b.value, teamId: b.teamId, order: b.order })),
    });

    bansForThisGame.sort((a, b) => a.order - b.order).forEach((action) => {
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

    if (teamABans.length > 0) cycle.push(teamABans[0]);
    if (teamABans.length > 1) cycle.push(teamABans[1]);
    if (teamBBans.length > 0) cycle.push(teamBBans[0]);
    if (teamBBans.length > 1) cycle.push(teamBBans[1]);

    console.log('[v0] Ban cycle created:', {
      teamABans: teamABans.length,
      teamBBans: teamBBans.length,
      cycleLength: cycle.length,
      cycle: cycle.map((b) => ({ hero: b.heroId, team: b.teamName, index: b.index })),
    });

    if (cycle.length === 0) {
      setBans([]);
      setCurrentIndex(0);
      return;
    }

    setBans(cycle);
    bansRef.current = cycle;
    setCurrentIndex(0);
  }, [draft, match, teams]);

  // Handle video playback and ban rotation
  useEffect(() => {
    if (!currentBan || bans.length === 0) {
      console.log('[v0] Not playing - currentBan:', currentBan, 'bans.length:', bans.length);
      return;
    }

    console.log('[v0] ***** STARTING BAN CYCLE *****', {
      currentIndex,
      totalBans: bans.length,
      ban: {
        index: currentIndex,
        heroId: currentBan.heroId,
        teamName: currentBan.teamName,
        teamId: currentBan.teamId,
        banIndex: currentBan.index,
      },
    });

    const playVideo = async () => {
      const isTeamA = match?.teamAId === currentBan.teamId;
      const textSourceName = isTeamA ? 'TOPLEFT' : 'TOPRIGHT';
      const oppositeSourceName = isTeamA ? 'TOPRIGHT' : 'TOPLEFT';

      console.log('[v0] Processing ban update:', {
        isTeamA,
        textSourceName,
        oppositeSourceName,
        obsConnected: obsManager.isConnectedToOBS(),
        hasTeamName: !!currentBan.teamName,
      });

      // Update text sources on first ban of each team (show team name)
      if (currentBan.index === 0) {
        console.log('[v0] First ban of team - updating text sources');
        
        // Clear the opposite team's text
        const clearResult = await obsManager.updateTextSource(oppositeSourceName, ' ');
        console.log(`[v0] Cleared "${oppositeSourceName}":`, clearResult);

        // Set the current team's text with actual team name
        const textValue = `${currentBan.teamName}'S BANS`;
        const updateResult = await obsManager.updateTextSource(textSourceName, textValue);
        console.log(`[v0] Updated "${textSourceName}" to "${textValue}":`, updateResult);
      } else {
        console.log('[v0] Second ban of team - only updating video');
      }

      // Update OBS media source with local file path
      if (currentBan.heroId && heroVideoFolderPath && obsManager.isConnectedToOBS()) {
        const cleanBase = heroVideoFolderPath.replace(/\/$/, '');
        const fullPath = `${cleanBase}\\${currentBan.heroId}.mp4`;
        const videoResult = await obsManager.setMediaSourceFile('HeroVideo', fullPath);
        console.log(`[v0] Set HeroVideo to "${fullPath}":`, videoResult);
      } else if (!currentBan.heroId) {
        const clearVideoResult = await obsManager.setMediaSourceFile('HeroVideo', '');
        console.log(`[v0] Cleared HeroVideo (hero is null):`, clearVideoResult);
      } else {
        console.log('[v0] Cannot update video - missing data:', {
          hasHeroId: !!currentBan.heroId,
          hasPath: !!heroVideoFolderPath,
          obsConnected: obsManager.isConnectedToOBS(),
        });
      }

      // Schedule next ban
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        console.log('[v0] Cleared existing timer');
      }

      console.log(`[v0] Setting timer for ${VIDEO_DURATION}ms until next ban`);
      timerRef.current = setTimeout(() => {
        console.log('[v0] TIMER FIRED - advancing to next ban');
        const nextIndex = (currentIndex + 1) % bansRef.current.length;
        console.log(`[v0] Next index: ${nextIndex}/${bansRef.current.length}`);
        setCurrentIndex(nextIndex);
      }, VIDEO_DURATION);
    };

    playVideo();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentBan, currentIndex, bans, match, heroVideoFolderPath]);

  // Check if match is in PLAYING phase
  if (!draft || draft.phase !== 'PLAYING') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white gap-4 p-6">
        {error && <p className="text-red-500">{error}</p>}
        {!error && <p>Waiting for draft phase to reach PLAYING...</p>}
        {obsStatus.state === 'error' && (
          <div className="max-w-xl px-4 py-3 rounded-lg bg-red-600/90 text-white text-sm">
            <p className="font-semibold">OBS WebSocket: not connected</p>
            <p className="opacity-90">{obsStatus.message}</p>
            {obsStatus.hint && <p className="opacity-80 mt-1 text-xs">{obsStatus.hint}</p>}
          </div>
        )}
        {obsStatus.state === 'connected' && (
          <p className="text-xs text-green-400">OBS WebSocket connected.</p>
        )}
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
      {/* OBS manages video playback via Media Source - overlay just updates the path */}

      {/* Team Ban Title Overlay */}
      <div className={`absolute ${titlePosition} z-10`}>
        <div className={`text-white text-3xl font-bold drop-shadow-lg ${titleClass}`}>
          {currentBan.teamName}&apos;S BANS
        </div>
      </div>

      {/* OBS connection status */}
      {obsStatus.state === 'error' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-w-xl px-4 py-3 rounded-lg bg-red-600/90 text-white text-sm shadow-lg">
          <p className="font-semibold">OBS WebSocket: not connected</p>
          <p className="opacity-90">{obsStatus.message}</p>
          {obsStatus.hint && <p className="opacity-80 mt-1 text-xs">{obsStatus.hint}</p>}
        </div>
      )}
      {obsStatus.state === 'connecting' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-yellow-500/90 text-black text-sm shadow-lg">
          Connecting to OBS WebSocket...
        </div>
      )}

      {/* Debug info (remove in production) */}
      <div className="absolute bottom-4 left-4 text-white text-xs opacity-50">
        <p>Match: {match?.id}</p>
        <p>Phase: {draft?.phase}</p>
        <p>
          Ban {currentIndex + 1} / {bans.length}
        </p>
        <p>Hero: {currentBan?.heroId || 'Skipped'}</p>
        <p>
          OBS:{' '}
          {obsStatus.state === 'connected'
            ? 'connected'
            : obsStatus.state === 'connecting'
              ? 'connecting'
              : obsStatus.state === 'error'
                ? 'error'
                : 'idle'}
        </p>
      </div>
    </div>
  );
}
