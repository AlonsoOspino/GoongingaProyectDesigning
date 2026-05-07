'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getDraftByMatchId } from '@/lib/api/draft';
import { getMatches } from '@/lib/api/match';
import { getTeams } from '@/lib/api/team';
import type {
  DraftState,
  Match,
  Team,
} from '@/lib/api/types';
import {
  obsManager,
  OBSConnectionError,
} from '@/lib/obs/websocket';

interface Ban {
  heroId: number | null;
  teamId: number;
  teamName: string;
  index: number;
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
  /*
    =========================================================
    STATE
    =========================================================
  */

  const [match, setMatch] =
    useState<Match | null>(null);

  const [draft, setDraft] =
    useState<DraftState | null>(null);

  const [teams, setTeams] = useState<Team[]>(
    []
  );

  const [bans, setBans] = useState<Ban[]>(
    []
  );

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [error, setError] = useState<
    string | null
  >(null);

  const [obsStatus, setObsStatus] = useState<
    | { state: 'idle' }
    | { state: 'connecting' }
    | { state: 'connected' }
    | {
        state: 'error';
        message: string;
        hint?: string;
      }
  >({
    state: 'idle',
  });

  /*
    =========================================================
    REFS
    =========================================================
  */

  const pollRef = useRef<NodeJS.Timeout | null>(
    null
  );

  const rotationTimerRef =
    useRef<NodeJS.Timeout | null>(null);

  const lastPlayedBanRef = useRef<string>('');

  /*
    =========================================================
    DOUBLE-BUFFER MEDIA PLAYBACK STATE
    =========================================================

    We drive two OBS media sources, HeroVideoA and HeroVideoB,
    so transitions between hero videos are seamless:

      - One source is currently visible and playing.
      - The other source stays hidden and preloads the NEXT
        hero video file.
      - On transition we just toggle scene-item visibility:
        show the preloaded one, hide the previous one.
      - Then we preload the next-next video into the now-hidden
        source so the next switch is also seamless.

    `activeSourceRef`  -> which source ('A' | 'B') is currently
                          visible. `null` means nothing has been
                          shown yet (initial state).
    `loadedFileRef`    -> tracks which absolute file path is
                          currently loaded into each source so we
                          don't redundantly re-set the same file.
    `mediaInitialized` -> flips true once both sources have been
                          hidden on (re)connect, so the playback
                          effect knows it's safe to start.
  */

  const activeSourceRef = useRef<
    'A' | 'B' | null
  >(null);

  const loadedFileRef = useRef<{
    A: string;
    B: string;
  }>({
    A: '',
    B: '',
  });

  const [mediaInitialized, setMediaInitialized] =
    useState(false);

  /*
    =========================================================
    CONFIG
    =========================================================
  */

  const VIDEO_DURATION = 15000;

  /*
    =========================================================
    FETCH DATA
    =========================================================
  */

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const matches = await getMatches();

        const foundMatch = matches.find(
          (m) => m.id === matchId
        );

        if (!foundMatch) {
          if (!cancelled) {
            setError('Match not found');
          }

          return;
        }

        const [allTeams, draftState] =
          await Promise.all([
            getTeams(),
            getDraftByMatchId(matchId),
          ]);

        if (cancelled) {
          return;
        }

        setMatch(foundMatch);
        setTeams(allTeams);
        setDraft(draftState);

        setError(null);
      } catch (err) {
        console.error(
          '[v0] Error loading draft data:',
          err
        );

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load draft'
          );
        }
      }
    };

    loadData();

    pollRef.current = setInterval(() => {
      loadData();
    }, 2000);

    return () => {
      cancelled = true;

      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [matchId]);

  /*
    =========================================================
    OBS CONNECTION
    =========================================================
  */

  useEffect(() => {
    if (
      !obsWebsocketUrl ||
      !obsWebsocketPassword
    ) {
      setObsStatus({
        state: 'error',
        message:
          'OBS WebSocket URL or password missing.',
        hint:
          'Configure them in dashboard stream settings.',
      });

      return;
    }

    let cancelled = false;

    const connect = async () => {
      try {
        setObsStatus({
          state: 'connecting',
        });

        await obsManager.connect({
          url: obsWebsocketUrl,
          password: obsWebsocketPassword,
        });

        if (cancelled) {
          return;
        }

        console.log(
          '[v0] OBS WebSocket connected successfully'
        );

        setObsStatus({
          state: 'connected',
        });
      } catch (err) {
        console.error(
          '[v0] OBS connect error:',
          err
        );

        if (cancelled) {
          return;
        }

        setObsStatus({
          state: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Failed to connect to OBS',
          hint:
            err instanceof OBSConnectionError
              ? err.hint
              : undefined,
        });
      }
    };

    connect();

    return () => {
      cancelled = true;

      obsManager.disconnect().catch(() => {});
    };
  }, [
    obsWebsocketUrl,
    obsWebsocketPassword,
  ]);

  /*
    =========================================================
    DOUBLE-BUFFER MEDIA INITIALIZATION

    Runs once OBS reports `connected`. Hides BOTH HeroVideoA
    and HeroVideoB so the overlay always starts from a known
    blank state. Resets ref-tracked state so a fresh reconnect
    behaves exactly like a first connection.

    `mediaInitialized` only flips true once both hides complete,
    which is the gate the playback effect waits on before doing
    any preload / show work.
    =========================================================
  */

  useEffect(() => {
    if (
      obsStatus.state !== 'connected'
    ) {
      setMediaInitialized(false);

      activeSourceRef.current = null;

      loadedFileRef.current = {
        A: '',
        B: '',
      };

      lastPlayedBanRef.current = '';

      return;
    }

    let cancelled = false;

    const initSources = async () => {
      try {
        await obsManager.setSceneItemEnabled(
          'HeroVideoA',
          false
        );

        await obsManager.setSceneItemEnabled(
          'HeroVideoB',
          false
        );

        if (cancelled) {
          return;
        }

        activeSourceRef.current = null;

        loadedFileRef.current = {
          A: '',
          B: '',
        };

        lastPlayedBanRef.current = '';

        setMediaInitialized(true);

        console.log(
          '[v0] Double-buffer media sources initialized'
        );
      } catch (err) {
        console.error(
          '[v0] Failed to initialize double-buffer media sources:',
          err
        );
      }
    };

    initSources();

    return () => {
      cancelled = true;
    };
  }, [obsStatus.state]);

  /*
    =========================================================
    COMPUTE BANS
    =========================================================
  */

  const computedBans = useMemo(() => {
    if (
      !draft ||
      !match ||
      teams.length === 0
    ) {
      return [];
    }

    const teamA = teams.find(
      (t) => t.id === match.teamAId
    );

    const teamB = teams.find(
      (t) => t.id === match.teamBId
    );

    const teamAName =
      teamA?.name || 'Team A';

    const teamBName =
      teamB?.name || 'Team B';

    const bansForThisGame =
      draft.actions.filter(
        (action) =>
          action.action === 'BAN' &&
          Number(action.gameNumber) ===
            Number(match.gameNumber)
      );

    console.log(
      '[v0] Bans found for game:',
      {
        gameNumber: match.gameNumber,
        totalBans: bansForThisGame.length,
      }
    );

    const teamABans: Ban[] = [];
    const teamBBans: Ban[] = [];

    bansForThisGame
      .sort((a, b) => a.order - b.order)
      .forEach((action) => {
        if (
          action.teamId === match.teamAId
        ) {
          if (teamABans.length < 2) {
            teamABans.push({
              heroId: action.value,
              teamId: action.teamId,
              teamName: teamAName,
              index: teamABans.length,
            });
          }
        }

        if (
          action.teamId === match.teamBId
        ) {
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

    const cycle: Ban[] = [];

    if (teamABans[0]) {
      cycle.push(teamABans[0]);
    }

    if (teamABans[1]) {
      cycle.push(teamABans[1]);
    }

    if (teamBBans[0]) {
      cycle.push(teamBBans[0]);
    }

    if (teamBBans[1]) {
      cycle.push(teamBBans[1]);
    }

    console.log(
      '[v0] Ban cycle created:',
      {
        cycleLength: cycle.length,
      }
    );

    return cycle;
  }, [draft, match, teams]);

  /*
    =========================================================
    UPDATE BANS STATE
    =========================================================
  */

  useEffect(() => {
    const oldJson = JSON.stringify(bans);

    const newJson =
      JSON.stringify(computedBans);

    if (oldJson === newJson) {
      return;
    }

    console.log(
      '[v0] Ban cycle changed'
    );

    setBans(computedBans);

    setCurrentIndex((prev) => {
      if (
        computedBans.length === 0
      ) {
        return 0;
      }

      if (
        prev >= computedBans.length
      ) {
        return 0;
      }

      return prev;
    });
  }, [computedBans]);

  /*
    =========================================================
    CURRENT BAN
    =========================================================
  */

  const currentBan =
    bans[currentIndex] || null;

  /*
    =========================================================
    PLAY CURRENT BAN (DOUBLE-BUFFERED)

    Strategy:

      1. Compute the absolute file path for the CURRENT ban
         and (if any) the NEXT ban.
      2. Update the team title text sources (unchanged).
      3. Decide which source ('A' | 'B') should become the new
         visible source. On first run that's always 'A'. On
         subsequent runs it's whichever source is NOT currently
         visible (and which we already preloaded last cycle).
      4. Make absolutely sure the target source has the current
         file loaded. Normally it already does (because we
         preloaded it last cycle). If for any reason it doesn't
         (cold start, bans list mutated, skipped ban, etc.) we
         set the file path now and wait briefly so OBS can
         decode the first frame BEFORE we make it visible.
      5. Toggle visibility: show target, hide previous active.
         OBS restarts playback on the now-active source because
         "Restart playback when source becomes active" is ON.
      6. Preload the NEXT ban's file into the now-hidden source
         so the next switch is also seamless.

    Guards:

      - We never call `setMediaSourceFile` (which restarts
        playback) on the visible source.
      - We never make a source visible without first making sure
        a file path is set on it.
      - The dedupe key on `lastPlayedBanRef` prevents the same
        ban from being re-played if React re-runs the effect.
    =========================================================
  */

  const buildHeroVideoPath = (
    heroId: number | null
  ): string => {
    if (
      !heroId ||
      !heroVideoFolderPath
    ) {
      return '';
    }

    const cleanBase =
      heroVideoFolderPath.replace(
        /[\/\\]$/,
        ''
      );

    return `${cleanBase}\\${heroId}.mp4`;
  };

  useEffect(() => {
    if (!currentBan) {
      return;
    }

    if (!mediaInitialized) {
      return;
    }

    if (
      !obsManager.isConnectedToOBS()
    ) {
      return;
    }

    const uniqueKey = JSON.stringify({
      currentIndex,
      heroId: currentBan.heroId,
      teamId: currentBan.teamId,
      index: currentBan.index,
    });

    /*
      PREVENT DUPLICATE EXECUTION
    */

    if (
      lastPlayedBanRef.current === uniqueKey
    ) {
      return;
    }

    lastPlayedBanRef.current = uniqueKey;

    console.log(
      '[v0] Ban transition triggered',
      {
        currentIndex,
        heroId: currentBan.heroId,
        activeSource:
          activeSourceRef.current,
      }
    );

    const runTransition = async () => {
      try {
        /*
          TEAM TITLE
        */

        const isTeamA =
          currentBan.teamId ===
          match?.teamAId;

        const activeTextSource =
          isTeamA
            ? 'TOPLEFT'
            : 'TOPRIGHT';

        const inactiveTextSource =
          isTeamA
            ? 'TOPRIGHT'
            : 'TOPLEFT';

        if (
          currentBan.index === 0
        ) {
          await obsManager.updateTextSource(
            inactiveTextSource,
            ' '
          );

          await obsManager.updateTextSource(
            activeTextSource,
            `${currentBan.teamName}'S BANS`
          );

          console.log(
            '[v0] Updated team title'
          );
        }

        /*
          BUILD CURRENT + NEXT PATHS
        */

        const currentPath =
          buildHeroVideoPath(
            currentBan.heroId
          );

        const nextBan =
          bans.length > 0
            ? bans[
                (currentIndex + 1) %
                  bans.length
              ]
            : null;

        const nextPath = nextBan
          ? buildHeroVideoPath(
              nextBan.heroId
            )
          : '';

        /*
          NO VIDEO PATH AVAILABLE
          (skipped ban, missing folder)
          Hide both sources so we don't show
          stale frames, and reset double-buffer
          state so the next ban starts fresh.
        */

        if (!currentPath) {
          await obsManager.setSceneItemEnabled(
            'HeroVideoA',
            false
          );

          await obsManager.setSceneItemEnabled(
            'HeroVideoB',
            false
          );

          activeSourceRef.current = null;

          loadedFileRef.current = {
            A: '',
            B: '',
          };

          console.log(
            '[v0] No video path for current ban — both sources hidden'
          );

          return;
        }

        /*
          PICK TARGET SOURCE

          - Initial cycle: target = 'A'.
          - Subsequent: target = the OTHER source (the one
            currently hidden, which we preloaded last cycle).
        */

        const previousActive =
          activeSourceRef.current;

        const targetSource: 'A' | 'B' =
          previousActive === null
            ? 'A'
            : previousActive === 'A'
              ? 'B'
              : 'A';

        const targetSourceName =
          `HeroVideo${targetSource}` as const;

        /*
          ENSURE TARGET HAS CURRENT FILE LOADED

          Fast path: target already has the right file
          preloaded from the previous cycle — nothing to do.

          Cold path: target file is wrong / empty (first
          cycle, reconnect, or list mutation). Preload now
          and give OBS a brief moment to decode the first
          frame BEFORE we flip visibility.
        */

        if (
          loadedFileRef.current[
            targetSource
          ] !== currentPath
        ) {
          await obsManager.preloadMediaSource(
            targetSourceName,
            currentPath
          );

          loadedFileRef.current[
            targetSource
          ] = currentPath;

          await new Promise((resolve) =>
            setTimeout(resolve, 200)
          );

          console.log(
            '[v0] Cold-loaded current video into',
            targetSourceName,
            currentPath
          );
        } else {
          console.log(
            '[v0] Current video already preloaded in',
            targetSourceName
          );
        }

        /*
          SWITCH VISIBILITY

          Show target first, then hide the previously
          visible source. OBS restarts playback on the
          now-active source because "Restart playback when
          source becomes active" is ON.
        */

        await obsManager.setSceneItemEnabled(
          targetSourceName,
          true
        );

        if (
          previousActive &&
          previousActive !== targetSource
        ) {
          const previousSourceName =
            `HeroVideo${previousActive}` as const;

          await obsManager.setSceneItemEnabled(
            previousSourceName,
            false
          );
        } else if (
          previousActive === null
        ) {
          /*
            First cycle: make sure the OTHER source
            is also explicitly hidden, even though
            init already did this. Defensive.
          */

          const otherSource =
            targetSource === 'A'
              ? 'HeroVideoB'
              : 'HeroVideoA';

          await obsManager.setSceneItemEnabled(
            otherSource,
            false
          );
        }

        activeSourceRef.current =
          targetSource;

        console.log(
          '[v0] Switched visible source to',
          targetSourceName
        );

        /*
          PRELOAD NEXT BAN INTO NOW-HIDDEN SOURCE
        */

        const nowHiddenSource: 'A' | 'B' =
          targetSource === 'A'
            ? 'B'
            : 'A';

        const nowHiddenSourceName =
          `HeroVideo${nowHiddenSource}` as const;

        if (
          nextPath &&
          loadedFileRef.current[
            nowHiddenSource
          ] !== nextPath
        ) {
          await obsManager.preloadMediaSource(
            nowHiddenSourceName,
            nextPath
          );

          loadedFileRef.current[
            nowHiddenSource
          ] = nextPath;

          console.log(
            '[v0] Preloaded next video into',
            nowHiddenSourceName,
            nextPath
          );
        }
      } catch (err) {
        console.error(
          '[v0] Failed playing ban:',
          err
        );
      }
    };

    runTransition();
  }, [
    currentBan,
    currentIndex,
    bans,
    heroVideoFolderPath,
    match?.teamAId,
    mediaInitialized,
  ]);

  /*
    =========================================================
    ROTATION TIMER
    =========================================================
  */

  useEffect(() => {
    if (bans.length === 0) {
      return;
    }

    if (rotationTimerRef.current) {
      clearTimeout(
        rotationTimerRef.current
      );
    }

    rotationTimerRef.current =
      setTimeout(() => {
        console.log(
          '[v0] Timer fired'
        );

        setCurrentIndex((prev) => {
          const next =
            (prev + 1) % bans.length;

          console.log(
            '[v0] Advancing ban:',
            {
              prev,
              next,
              total: bans.length,
            }
          );

          return next;
        });
      }, VIDEO_DURATION);

    return () => {
      if (rotationTimerRef.current) {
        clearTimeout(
          rotationTimerRef.current
        );
      }
    };
  }, [currentIndex, bans.length]);

  /*
    =========================================================
    WAITING SCREEN
    =========================================================
  */

  if (
    !draft ||
    draft.phase !== 'PLAYING'
  ) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white gap-4 p-6">
        {error && (
          <p className="text-red-500">
            {error}
          </p>
        )}

        {!error && (
          <p>
            Waiting for draft phase to
            reach PLAYING...
          </p>
        )}

        {obsStatus.state ===
          'error' && (
          <div className="max-w-xl px-4 py-3 rounded-lg bg-red-600/90 text-white text-sm">
            <p className="font-semibold">
              OBS WebSocket: not
              connected
            </p>

            <p className="opacity-90">
              {obsStatus.message}
            </p>

            {obsStatus.hint && (
              <p className="opacity-80 mt-1 text-xs">
                {obsStatus.hint}
              </p>
            )}
          </div>
        )}

        {obsStatus.state ===
          'connected' && (
          <p className="text-xs text-green-400">
            OBS WebSocket connected.
          </p>
        )}
      </div>
    );
  }

  /*
    =========================================================
    LOADING
    =========================================================
  */

  if (!currentBan) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <p>Loading bans...</p>
      </div>
    );
  }

  /*
    =========================================================
    UI
    =========================================================
  */

  const isTeamA =
    currentBan.teamId ===
    match?.teamAId;

  const titlePosition = isTeamA
    ? 'top-4 left-4'
    : 'top-4 right-4';

  const titleClass = isTeamA
    ? 'text-left'
    : 'text-right';

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* TEAM TITLE */}

      <div
        className={`absolute ${titlePosition} z-10`}
      >
        <div
          className={`text-white text-3xl font-bold drop-shadow-lg ${titleClass}`}
        >
          {currentBan.teamName}
          &apos;S BANS
        </div>
      </div>

      {/* OBS STATUS */}

      {obsStatus.state ===
        'error' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-w-xl px-4 py-3 rounded-lg bg-red-600/90 text-white text-sm shadow-lg">
          <p className="font-semibold">
            OBS WebSocket: not
            connected
          </p>

          <p className="opacity-90">
            {obsStatus.message}
          </p>

          {obsStatus.hint && (
            <p className="opacity-80 mt-1 text-xs">
              {obsStatus.hint}
            </p>
          )}
        </div>
      )}

      {obsStatus.state ===
        'connecting' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-yellow-500/90 text-black text-sm shadow-lg">
          Connecting to OBS
          WebSocket...
        </div>
      )}

      {/* DEBUG */}

      <div className="absolute bottom-4 left-4 text-white text-xs opacity-50">
        <p>Match: {match?.id}</p>

        <p>
          Phase: {draft?.phase}
        </p>

        <p>
          Ban {currentIndex + 1} /{' '}
          {bans.length}
        </p>

        <p>
          Hero:{' '}
          {currentBan.heroId ||
            'Skipped'}
        </p>

        <p>
          OBS:{' '}
          {obsStatus.state ===
          'connected'
            ? 'connected'
            : obsStatus.state ===
                'connecting'
              ? 'connecting'
              : obsStatus.state ===
                  'error'
                ? 'error'
                : 'idle'}
        </p>
      </div>
    </div>
  );
}
