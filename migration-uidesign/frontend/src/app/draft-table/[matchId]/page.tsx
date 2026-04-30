"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/features/session/SessionProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  getDraftByMatchId,
  getDraftState,
  startMapPicking,
  pickMap,
  startBan,
  banHero,
  endMap,
  type DraftState,
  type GameMap,
  type Hero,
} from "@/lib/api";
import {
  getTeams,
  submitMatchResult,
  undoMatchResult,
  updateCaptainMatch,
  captainRequestPause,
  managerTogglePause,
  managerClearPauseRequest,
  type Team,
} from "@/lib/api";
import { clsx } from "clsx";
import { resolveHeroImageUrl, resolveMapImageUrl } from "@/lib/assetUrls";

const POLL_INTERVAL = 3000;
const TURN_DURATION = 75;

type Phase = "STARTING" | "MAPPICKING" | "BAN" | "ENDMAP" | "FINISHED";

export default function DraftTablePage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated } = useSession();
  const searchParams = useSearchParams();
  const urlKey = searchParams?.get("key");

  const matchId = Number(params.matchId);

  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const draftId = draftState?.id;
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TURN_DURATION);
  const [selectedRole, setSelectedRole] = useState<"ALL" | "TANK" | "DPS" | "SUPPORT">("ALL");
  const [banWarning, setBanWarning] = useState<string | null>(null);
  const [heroCacheById, setHeroCacheById] = useState<Record<number, Hero>>({});
  const [pauseActionPending, setPauseActionPending] = useState(false);
  const [isNavHidden, setIsNavHidden] = useState(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isManager = user?.role === "MANAGER";
  const isCaptain = user?.role === "CAPTAIN";
  const myTeamId = user?.teamId;
  const isMyTurn = draftState?.currentTurnTeamId === myTeamId;
  const currentPhase = draftState?.phase as Phase;

  const teamA = teams.find((t) => t.id === draftState?.match?.teamAId);
  const teamB = teams.find((t) => t.id === draftState?.match?.teamBId);
  const matchStatus = draftState?.match?.status;
  const currentGameNumber = (draftState?.match?.gameNumber || 0) + 1;

  // Show draft history only when match is PENDINGRESULT or FINISHED
  const showDraftHistory = matchStatus === "PENDINGREGISTERS" || matchStatus === "FINISHED" || currentPhase === "FINISHED";

  // Check if I'm ready (for captains)
  const amIReady = isCaptain && myTeamId === teamA?.id 
    ? draftState?.match?.teamAready === 1 
    : draftState?.match?.teamBready === 1;

  useEffect(() => {
    if (!isHydrated) return;
    if (!Number.isFinite(matchId) || matchId <= 0) {
      setError("Invalid match id.");
      setLoading(false);
      return;
    }
    if (!isAuthenticated && !urlKey) {
      setError("You need to log in to access the draft table.");
      setLoading(false);
      return;
    }
    loadData();
  }, [isHydrated, isAuthenticated, matchId]);

  useEffect(() => {
    if (!draftState || currentPhase === "FINISHED") return;
    pollRef.current = setInterval(() => {
      fetchDraftState();
    }, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [draftState, currentPhase]);

  const isMatchPaused = !!draftState?.match?.mapTimerPaused;
  const pauseRequestedBy = draftState?.match?.pauseRequestedBy ?? null;
  const NAVBAR_STORAGE_KEY = "draftTableHideNavbar";

  useEffect(() => {
    const stored = localStorage.getItem(NAVBAR_STORAGE_KEY);
    setIsNavHidden(stored === "true");
  }, []);

  const toggleNavbar = (nextHidden: boolean) => {
    setIsNavHidden(nextHidden);
    localStorage.setItem(NAVBAR_STORAGE_KEY, nextHidden ? "true" : "false");
    window.dispatchEvent(new Event("draft-navbar-toggle"));
  };

  useEffect(() => {
    if (!draftState || !["MAPPICKING", "BAN"].includes(currentPhase ?? "")) {
      setTimeLeft(TURN_DURATION);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const serverRemaining =
      typeof draftState.remainingSeconds === "number" && Number.isFinite(draftState.remainingSeconds)
        ? draftState.remainingSeconds
        : TURN_DURATION;

    setTimeLeft(Math.max(0, Math.min(TURN_DURATION, serverRemaining)));

    if (timerRef.current) clearInterval(timerRef.current);
    if (isMatchPaused) {
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [draftState?.remainingSeconds, currentPhase, isMatchPaused]);

  useEffect(() => {
    const heroes = draftState?.heroes || [];
    if (!heroes.length) return;
    setHeroCacheById((prev) => {
      const next = { ...prev };
      for (const hero of heroes) {
        next[hero.id] = hero;
      }
      return next;
    });
  }, [draftState?.heroes]);

  async function loadData() {
    try {
      const [draft, teamsData] = await Promise.all([
        getDraftByMatchId(matchId, urlKey ?? undefined),
        getTeams(),
      ]);
      setDraftState(draft);
      setTeams(teamsData);
    } catch (err) {
      console.error("Failed to load draft:", err);
      setError("Failed to load draft table. It may not exist or has not been created yet.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchDraftState() {
    if (!draftId) return;
    try {
      const draft = await getDraftState(draftId, urlKey ?? undefined);
      setDraftState(draft);
    } catch (err) {
      console.error("Failed to fetch draft state:", err);
    }
  }

  async function handleStartMapPicking() {
    if (!token || !draftId) return;
    setActionLoading(true);
    try {
      const updated = await startMapPicking(token, draftId);
      setDraftState(updated);
    } catch (err) {
      console.error("Failed to start map picking:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartBan() {
    if (!token || !draftId) return;
    setActionLoading(true);
    try {
      const updated = await startBan(token, draftId);
      setDraftState(updated);
    } catch (err) {
      console.error("Failed to start ban phase:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEndMap() {
    if (!token || !draftId) return;
    setActionLoading(true);
    try {
      const updated = await endMap(token, draftId);
      setDraftState(updated);
    } catch (err) {
      console.error("Failed to end map:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePickMap(mapId: number) {
    if (!token || !isMyTurn || !draftId) return;
    setActionLoading(true);
    try {
      const updated = await pickMap(token, draftId, { mapId, teamId: myTeamId ?? undefined });
      setDraftState(updated);
    } catch (err) {
      console.error("Failed to pick map:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBanHero(heroId: number | null) {
    if (!token || !isMyTurn || !draftId) return;
    setActionLoading(true);
    try {
      const updated = await banHero(token, draftId, { heroId, teamId: myTeamId ?? undefined });
      setDraftState(updated);
    } catch (err) {
      console.error("Failed to ban hero:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmitResult(winnerTeamId: number | null) {
    if (!token || !draftState) return;
    setActionLoading(true);
    try {
      await submitMatchResult(token, matchId, winnerTeamId);
      fetchDraftState();
    } catch (err) {
      console.error("Failed to submit result:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUndoResult() {
    if (!token || !draftState) return;
    setActionLoading(true);
    try {
      await undoMatchResult(token, matchId);
      fetchDraftState();
    } catch (err) {
      console.error("Failed to undo result:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSetReady() {
    if (!token || !isCaptain || !myTeamId) return;
    setActionLoading(true);
    try {
      const payload = myTeamId === teamA?.id 
        ? { teamAready: 1 as const } 
        : { teamBready: 1 as const };
      await updateCaptainMatch(token, matchId, payload);
      fetchDraftState();
    } catch (err) {
      console.error("Failed to set ready:", err);
    } finally {
      setActionLoading(false);
    }
  }

  const getBannedHeroesByTeam = (teamId: number): (number | null)[] => {
    if (!draftState?.actions) return [];
    return draftState.actions
      .filter((a) => a.teamId === teamId && a.action === "BAN" && a.gameNumber === currentGameNumber)
      .map((a) => a.value); // Keep nulls to show "NO BAN" slots
  };

  // Check if hero is banned by ANY team in the current game (computed from actions)
  const isHeroBanned = (heroId: number) => {
    if (!draftState?.actions) return false;
    return draftState.actions.some(
      (a) => a.action === "BAN" && a.value === heroId && a.gameNumber === currentGameNumber
    );
  };

  // Check if my team banned this hero in any previous game
  const wasHeroBannedByMyTeamBefore = (heroId: number) => {
    if (!draftState?.actions || !myTeamId) return false;
    return draftState.actions.some(
      (a) => a.action === "BAN" && a.value === heroId && a.teamId === myTeamId && a.gameNumber < currentGameNumber
    );
  };

  // Get info about which teams banned this hero in previous games
  const getPreviousGameBanInfo = (heroId: number) => {
    if (!draftState?.actions) return { bannedByTeamA: false, bannedByTeamB: false, teamNames: [] as string[] };
    
    const teamAId = draftState.match.teamAId;
    const teamBId = draftState.match.teamBId;
    
    const bannedByTeamA = draftState.actions.some(
      (a) => a.action === "BAN" && a.value === heroId && a.teamId === teamAId && a.gameNumber < currentGameNumber
    );
    const bannedByTeamB = draftState.actions.some(
      (a) => a.action === "BAN" && a.value === heroId && a.teamId === teamBId && a.gameNumber < currentGameNumber
    );
    
    const teamNames: string[] = [];
    const teamAName = teams.find((t) => t.id === teamAId)?.name || "Team A";
    const teamBName = teams.find((t) => t.id === teamBId)?.name || "Team B";
    if (bannedByTeamA) teamNames.push(teamAName);
    if (bannedByTeamB) teamNames.push(teamBName);
    
    return { bannedByTeamA, bannedByTeamB, teamNames };
  };

  // Check if any team banned this hero in previous games
  const wasHeroBannedInPreviousGames = (heroId: number) => {
    const info = getPreviousGameBanInfo(heroId);
    return info.bannedByTeamA || info.bannedByTeamB;
  };

  // Get which team(s) banned a specific hero in current game
  const getHeroBanInfo = (heroId: number): { bannedByTeamA: boolean; bannedByTeamB: boolean } => {
    if (!draftState?.actions) return { bannedByTeamA: false, bannedByTeamB: false };
    const bansForHero = draftState.actions.filter(
      (a) => a.action === "BAN" && a.value === heroId && a.gameNumber === currentGameNumber
    );
    const teamAId = draftState.match.teamAId;
    const teamBId = draftState.match.teamBId;
    return {
      bannedByTeamA: bansForHero.some((a) => a.teamId === teamAId),
      bannedByTeamB: bansForHero.some((a) => a.teamId === teamBId),
    };
  };

  const isMapPicked = (mapId: number) => {
    return draftState?.pickedMaps?.includes(mapId) || false;
  };

  const getTeamTotalBans = (teamId: number) => {
    if (!draftState?.actions) return 0;
    return draftState.actions.filter(
      (a) =>
        a.teamId === teamId &&
        a.action === "BAN" &&
        a.gameNumber === currentGameNumber
    ).length;
  };

  const getBanCountByRole = (teamId: number, role: "TANK" | "DPS" | "SUPPORT") => {
    if (!draftState?.actions || !draftState?.heroes) return 0;
    const heroesOfRole = draftState.heroes.filter((h) => h.role === role).map((h) => h.id);
    return draftState.actions.filter(
      (a) =>
        a.teamId === teamId &&
        a.action === "BAN" &&
        a.gameNumber === currentGameNumber &&
        a.value !== null &&
        heroesOfRole.includes(a.value)
    ).length;
  };

  const canBanRole = (role: "ALL" | "TANK" | "DPS" | "SUPPORT") => {
    if (!myTeamId) return false;
    // Check if team already has 2 total bans
    if (getTeamTotalBans(myTeamId) >= 2) return false;
    if (role === "ALL") return true;
    return getBanCountByRole(myTeamId, role) < 2;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  const knownHeroes = useMemo(() => {
    const byId: Record<number, Hero> = { ...heroCacheById };
    for (const hero of draftState?.heroes || []) {
      byId[hero.id] = hero;
    }
    return Object.values(byId).sort((a, b) => a.id - b.id);
  }, [heroCacheById, draftState?.heroes]);

  const getHeroById = useCallback(
    (heroId: number) => {
      const liveHero = draftState?.heroes?.find((hero) => hero.id === heroId);
      if (liveHero) return liveHero;
      return heroCacheById[heroId] || null;
    },
    [draftState?.heroes, heroCacheById]
  );
  if (!isHydrated || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted">Loading draft table...</p>
        </div>
      </div>
    );
  }


  if (error || !draftState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card variant="featured" className="max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-danger mb-4">{error || "Draft not found"}</p>
            {!isAuthenticated ? (
              <Button onClick={() => router.push("/login")}>Go to Login</Button>
            ) : (
              <Button onClick={() => router.back()}>Go Back</Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use the currently-selected map as the page backdrop for captains and managers.
  const backgroundMap = draftState.allMaps?.find((m) => m.id === draftState.currentMapId);
  const backgroundMapUrl = backgroundMap?.imgPath ? resolveMapImageUrl(backgroundMap.imgPath) : null;

  return (
    <main className="relative min-h-screen bg-background">
      {/* Map background — only the visual backdrop, never interactive */}
      {backgroundMapUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${backgroundMapUrl})` }}
        />
      )}
      {/* Dark overlay keeps cards and text readable on top of the map */}
      {backgroundMapUrl && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 bg-background/75" />
      )}
      <div className="relative z-10">
      {/* Compact Header */}
        <header className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-[color:var(--color-team-a)]">{teamA?.name}</span>
                  <span className="text-2xl font-bold text-foreground">{draftState.match.mapWinsTeamA}</span>
                  <span className="text-muted">-</span>
                  <span className="text-2xl font-bold text-foreground">{draftState.match.mapWinsTeamB}</span>
                  <span className="text-lg font-semibold text-[color:var(--color-team-b)]">{teamB?.name}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  Game {currentGameNumber}
                </Badge>
              </div>
              <div className="flex items-center gap-4">
                {/* Ready Status for Manager */}
                {isManager && currentPhase === "STARTING" && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className={clsx("w-2 h-2 rounded-full", draftState.match.teamAready ? "bg-success" : "bg-muted")} />
                    <span className="text-muted">{teamA?.name?.substring(0, 8)}</span>
                    <div className={clsx("w-2 h-2 rounded-full ml-2", draftState.match.teamBready ? "bg-success" : "bg-muted")} />
                    <span className="text-muted">{teamB?.name?.substring(0, 8)}</span>
                  </div>
                )}
                <Badge
                  variant={
                    currentPhase === "STARTING" ? "default" :
                    currentPhase === "FINISHED" ? "success" :
                    currentPhase === "BAN" ? "danger" : "primary"
                  }
                  className="px-3 py-1"
                >
                  {currentPhase}
                </Badge>
                {(currentPhase === "BAN" || currentPhase === "MAPPICKING") && (
                  <div
                    className={clsx(
                      "text-2xl font-mono font-bold tabular-nums",
                      timeLeft <= 15 ? "text-danger animate-timer-pulse" : "text-foreground"
                    )}
                  >
                    {formatTime(timeLeft)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

      <div className="w-full px-3 md:px-6 py-6">
        {/* Phase Content */}
        {currentPhase === "STARTING" && (
          <StartingPhase
            isManager={isManager}
            isCaptain={isCaptain}
            teamA={teamA}
            teamB={teamB}
            match={draftState.match}
            amIReady={amIReady}
            onStart={handleStartMapPicking}
            onSetReady={handleSetReady}
            onUndoResult={handleUndoResult}
            actionLoading={actionLoading}
          />
        )}

        {currentPhase === "MAPPICKING" && (
          <MapPickingPhase
            isManager={isManager}
            isCaptain={isCaptain}
            isMyTurn={isMyTurn}
            draftState={draftState}
            teams={teams}
            myTeamId={myTeamId}
            onPickMap={handlePickMap}
            onStartBan={handleStartBan}
            isMapPicked={isMapPicked}
            actionLoading={actionLoading}
          />
        )}

        {currentPhase === "BAN" && (
          <BanPhase
            isManager={isManager}
            isCaptain={isCaptain}
            isMyTurn={isMyTurn}
            draftState={draftState}
            teams={teams}
            heroes={knownHeroes}
            getHeroById={getHeroById}
            myTeamId={myTeamId}
            banWarning={banWarning}
            setBanWarning={setBanWarning}
            selectedRole={selectedRole}
            setSelectedRole={setSelectedRole}
            onBanHero={handleBanHero}
            onEndMap={handleEndMap}
            isHeroBanned={isHeroBanned}
            wasHeroBannedByMyTeamBefore={wasHeroBannedByMyTeamBefore}
            wasHeroBannedInPreviousGames={wasHeroBannedInPreviousGames}
            getPreviousGameBanInfo={getPreviousGameBanInfo}
            getHeroBanInfo={getHeroBanInfo}
            getBannedHeroesByTeam={getBannedHeroesByTeam}
            getTeamTotalBans={getTeamTotalBans}
            getBanCountByRole={getBanCountByRole}
            canBanRole={canBanRole}
            actionLoading={actionLoading}
          />
        )}

        {currentPhase === "ENDMAP" && (
          <EndMapPhase
            isManager={isManager}
            isCaptain={isCaptain}
            myTeamId={myTeamId}
            draftState={draftState}
            teams={teams}
            getHeroById={getHeroById}
            amIReady={amIReady}
            onStartMapPicking={handleStartMapPicking}
            onSubmitResult={handleSubmitResult}
            onSetReady={handleSetReady}
            getBannedHeroesByTeam={getBannedHeroesByTeam}
            actionLoading={actionLoading}
          />
        )}

        {currentPhase === "FINISHED" && (
          <FinishedPhase draftState={draftState} teams={teams} />
        )}

        {/* Draft History - Only shown after PENDINGRESULT/FINISHED */}
        {showDraftHistory && <DraftHistory draftState={draftState} teams={teams} getHeroById={getHeroById} />}
      </div>

      {isManager && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button size="sm" variant="secondary" onClick={() => toggleNavbar(!isNavHidden)}>
            {isNavHidden ? "Show header" : "Hide header"}
          </Button>
        </div>
      )}

      {/* Captain pause request button — wired to backend */}
      {(currentPhase === "MAPPICKING" || currentPhase === "BAN") && isCaptain && !isMatchPaused && (
        <button
          onClick={async () => {
            if (!token || pauseActionPending) return;
            setPauseActionPending(true);
            try {
              await captainRequestPause(token, matchId);
              await fetchDraftState();
            } catch (err) {
              console.error("Failed to request pause:", err);
            } finally {
              setPauseActionPending(false);
            }
          }}
          disabled={pauseActionPending || pauseRequestedBy === myTeamId}
          className={clsx(
            "fixed bottom-6 left-6 z-40 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-md transition-all flex items-center gap-1.5",
            pauseRequestedBy === myTeamId
              ? "bg-surface border border-warning/50 text-warning cursor-not-allowed"
              : "bg-warning text-warning-foreground hover:bg-warning/90",
            pauseActionPending && "opacity-70 cursor-wait"
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {pauseRequestedBy === myTeamId ? "Pause sent" : "Pause"}
        </button>
      )}

      {/* Manager pause/resume control */}
      {(currentPhase === "MAPPICKING" || currentPhase === "BAN") && isManager && (
        <button
          onClick={async () => {
            if (!token || pauseActionPending) return;
            setPauseActionPending(true);
            try {
              await managerTogglePause(token, matchId, !isMatchPaused);
              await fetchDraftState();
            } catch (err) {
              console.error("Failed to toggle pause:", err);
            } finally {
              setPauseActionPending(false);
            }
          }}
          disabled={pauseActionPending}
          className={clsx(
            "fixed bottom-6 left-6 z-40 px-4 py-2 text-sm font-semibold rounded-lg shadow-md transition-all flex items-center gap-2",
            isMatchPaused
              ? "bg-accent text-accent-foreground hover:bg-accent/90"
              : "bg-warning text-warning-foreground hover:bg-warning/90",
            pauseActionPending && "opacity-70 cursor-wait"
          )}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isMatchPaused ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            )}
          </svg>
          {isMatchPaused ? "Resume" : "Pause"}
        </button>
      )}

      {/* Manager-only: floating pause-request notification when a captain asks */}
      {isManager && pauseRequestedBy && !isMatchPaused && (
        <div className="fixed top-24 right-6 z-40 w-80 bg-surface border-2 border-warning rounded-xl shadow-2xl shadow-warning/20 animate-fade-in">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-warning/20 border-2 border-warning flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-sm">Pause Requested</p>
                <p className="text-xs text-muted truncate">
                  {teams.find((t) => t.id === pauseRequestedBy)?.name || "A captain"} wants to pause
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                disabled={pauseActionPending}
                onClick={async () => {
                  if (!token) return;
                  setPauseActionPending(true);
                  try {
                    await managerTogglePause(token, matchId, true);
                    await fetchDraftState();
                  } catch (err) {
                    console.error("Failed to approve pause:", err);
                  } finally {
                    setPauseActionPending(false);
                  }
                }}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                disabled={pauseActionPending}
                onClick={async () => {
                  if (!token) return;
                  setPauseActionPending(true);
                  try {
                    await managerClearPauseRequest(token, matchId);
                    await fetchDraftState();
                  } catch (err) {
                    console.error("Failed to deny pause:", err);
                  } finally {
                    setPauseActionPending(false);
                  }
                }}
              >
                Deny
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen GAME PAUSED overlay (server-driven) */}
      {isMatchPaused && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-surface border-2 border-warning rounded-2xl p-8 max-w-md text-center shadow-2xl shadow-warning/20 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-warning/20 border-4 border-warning mx-auto mb-6 flex items-center justify-center">
              <svg className="w-10 h-10 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-3xl font-black text-foreground mb-2">GAME PAUSED</h2>
            <p className="text-muted mb-6">
              {isManager
                ? "The match timer is currently paused."
                : "The manager has paused the match. Please wait..."}
            </p>
            {isManager && (
              <Button
                onClick={async () => {
                  if (!token || pauseActionPending) return;
                  setPauseActionPending(true);
                  try {
                    await managerTogglePause(token, matchId, false);
                    await fetchDraftState();
                  } catch (err) {
                    console.error("Failed to resume:", err);
                  } finally {
                    setPauseActionPending(false);
                  }
                }}
                disabled={pauseActionPending}
                className="px-8"
              >
                Resume Match
              </Button>
            )}
          </div>
        </div>
      )}
      </div>
    </main>
  );
}

// ==================== STARTING PHASE ====================

function StartingPhase({
  isManager,
  isCaptain,
  teamA,
  teamB,
  match,
  amIReady,
  onStart,
  onSetReady,
  onUndoResult,
  actionLoading,
}: {
  isManager: boolean;
  isCaptain: boolean;
  teamA?: Team;
  teamB?: Team;
  match: DraftState["match"];
  amIReady: boolean;
  onStart: () => void;
  onSetReady: () => void;
  onUndoResult: () => void;
  actionLoading: boolean;
}) {
  const bothReady = match.teamAready === 1 && match.teamBready === 1;
  const canUndoResult = isManager && match.status !== "FINISHED" && (match.mapResults?.length || 0) > 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Card variant="featured" className="w-full max-w-2xl">
        <CardContent className="p-8">
          <h2 className="text-2xl font-bold text-center text-foreground mb-2">
            {match.gameNumber === 0 ? "Waiting to Start" : `Ready for Game ${match.gameNumber + 1}?`}
          </h2>
          <p className="text-sm text-muted text-center mb-8">
            Captains can mark ready; manager can start when match operations are prepared
          </p>
          
          <div className="flex items-center justify-center gap-12 mb-8">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-[color:var(--color-team-a)]/20 border-2 border-[color:var(--color-team-a)] mx-auto mb-3 flex items-center justify-center">
                <span className="text-2xl font-bold text-[color:var(--color-team-a)]">
                  {teamA?.name?.charAt(0) || "A"}
                </span>
              </div>
              <p className="font-semibold text-foreground mb-2">{teamA?.name}</p>
              <Badge variant={match.teamAready ? "success" : "default"}>
                {match.teamAready ? "Ready" : "Not Ready"}
              </Badge>
            </div>

            <div className="text-4xl font-bold text-muted">VS</div>

            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-[color:var(--color-team-b)]/20 border-2 border-[color:var(--color-team-b)] mx-auto mb-3 flex items-center justify-center">
                <span className="text-2xl font-bold text-[color:var(--color-team-b)]">
                  {teamB?.name?.charAt(0) || "B"}
                </span>
              </div>
              <p className="font-semibold text-foreground mb-2">{teamB?.name}</p>
              <Badge variant={match.teamBready ? "success" : "default"}>
                {match.teamBready ? "Ready" : "Not Ready"}
              </Badge>
            </div>
          </div>

          {/* Captain Ready Button */}
          {isCaptain && !amIReady && (
            <div className="text-center mb-6">
              <Button size="lg" onClick={onSetReady} disabled={actionLoading} className="px-8">
                {actionLoading ? "Setting ready..." : "I'm Ready!"}
              </Button>
              <p className="text-xs text-muted mt-2">Click to confirm you are ready to play</p>
            </div>
          )}

          {isCaptain && amIReady && (
            <div className="text-center mb-6">
              <Badge variant="success" className="text-sm px-4 py-2">You are ready</Badge>
              <p className="text-xs text-muted mt-2">Waiting for manager to start...</p>
            </div>
          )}

          {isManager && (
            <div className="text-center">
              {!bothReady && (
                <p className="text-muted mb-4 text-sm">
                  One or both captains are not marked ready yet.
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-3">
                {canUndoResult && (
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={onUndoResult}
                    disabled={actionLoading}
                    className="px-8"
                  >
                    Fix Last Result
                  </Button>
                )}
                <Button 
                  size="lg" 
                  onClick={onStart} 
                  disabled={actionLoading} 
                  className="px-8"
                >
                  {actionLoading ? "Starting..." : "Start Map Picking"}
                </Button>
              </div>
              {!bothReady && <p className="text-xs text-muted mt-2">Manager override is active.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== MAP PICKING PHASE ====================

function MapPickingPhase({
  isManager,
  isCaptain,
  isMyTurn,
  draftState,
  teams,
  myTeamId,
  onPickMap,
  onStartBan,
  isMapPicked,
  actionLoading,
}: {
  isManager: boolean;
  isCaptain: boolean;
  isMyTurn: boolean;
  draftState: DraftState;
  teams: Team[];
  myTeamId?: number | null;
  onPickMap: (mapId: number) => void;
  onStartBan: () => void;
  isMapPicked: (mapId: number) => boolean;
  actionLoading: boolean;
}) {
  const currentTeam = teams.find((t) => t.id === draftState.currentTurnTeamId);
  const teamA = teams.find((t) => t.id === draftState.match.teamAId);
  const teamB = teams.find((t) => t.id === draftState.match.teamBId);
  const availableMaps = draftState.availableMaps || [];
  const currentMap = draftState.allMaps?.find((m) => m.id === draftState.currentMapId);
  const isTeamATurn = draftState.currentTurnTeamId === teamA?.id;
  const isTeamBTurn = draftState.currentTurnTeamId === teamB?.id;

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Three Column Layout - Team A | Map Selection | Team B */}
      <div className="flex-1 grid grid-cols-[140px_1fr_140px] xl:grid-cols-[160px_1fr_160px] gap-4 items-start">
        {/* Left - Team A: big logo on top, rectangle (name) below */}
        <div className="flex flex-col gap-4">
          <div className={clsx(
            "w-full aspect-square rounded-full overflow-hidden border-2 transition-all bg-surface-elevated",
            isTeamATurn
              ? "border-[color:var(--color-team-a)] animate-turn-glow-teal"
              : "border-[color:var(--color-team-a)]/40"
          )}>
            {teamA?.logo ? (
              <img src={teamA.logo} alt={teamA.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[color:var(--color-team-a)]/20 flex items-center justify-center">
                <span className="text-5xl font-black text-[color:var(--color-team-a)]">
                  {teamA?.name?.charAt(0) || "A"}
                </span>
              </div>
            )}
          </div>
          <div className={clsx(
            "rounded-lg p-3 transition-all flex flex-col items-center gap-2 border",
            isTeamATurn
              ? "bg-[color:var(--color-team-a)]/20 border-[color:var(--color-team-a)] animate-turn-glow-teal"
              : "bg-surface-elevated/50 border-border"
          )}>
            <span className="text-base font-bold text-foreground text-center leading-tight uppercase tracking-wide break-words">
              {teamA?.name}
            </span>
            {isTeamATurn && <Badge variant="primary" className="text-[10px] px-2 animate-pulse">Picking</Badge>}
          </div>
        </div>

        {/* Center - Map Selection */}
        <div className="space-y-4">
          {/* Selected Map Display - Central */}
          {currentMap ? (
            <div className="flex flex-col items-center">
              <div className="relative w-full max-w-md rounded-xl overflow-hidden border-4 border-primary shadow-2xl shadow-primary/30">
                {currentMap.imgPath ? (
                  <img
                    src={resolveMapImageUrl(currentMap.imgPath)}
                    alt={currentMap.description}
                    className="w-full aspect-video object-cover"
                  />
                ) : (
                  <div className="w-full aspect-video bg-surface-elevated flex items-center justify-center">
                    <span className="text-4xl font-bold text-muted">{currentMap.description.charAt(0)}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
                  <p className="text-2xl font-black text-white">{currentMap.description}</p>
                  <Badge variant="primary" className="mt-2">{currentMap.type}</Badge>
                </div>
              </div>
              {isManager && (
                <Button size="lg" onClick={onStartBan} disabled={actionLoading} className="mt-4 px-8">
                  Start Ban Phase
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8">
              <p className="text-lg text-muted uppercase tracking-widest mb-2">Awaiting Selection</p>
              <p className="text-sm text-muted">Captain picks a map below</p>
            </div>
          )}

          {/* Map Grid */}
          <Card variant="featured">
            <CardHeader className="pb-2 pt-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Available Maps</CardTitle>
                {isCaptain && isMyTurn && (
                  <Badge variant="success" className="animate-pulse-glow">Your Turn</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              {isCaptain && !isMyTurn && (
                <div className="mb-3 p-2 rounded-lg bg-surface-elevated text-center">
                  <p className="text-xs text-muted">Waiting for {currentTeam?.name} to pick...</p>
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {availableMaps.map((map) => {
                  const picked = isMapPicked(map.id);
                  const isCurrentMap = map.id === draftState.currentMapId;
                  const canSelect = isCaptain && isMyTurn && !picked;

                  return (
                    <button
                      key={map.id}
                      onClick={() => canSelect && onPickMap(map.id)}
                      disabled={picked || !canSelect || actionLoading}
                      className={clsx(
                        "relative rounded-lg overflow-hidden border-2 transition-all",
                        picked
                          ? "border-border opacity-30 grayscale cursor-not-allowed"
                          : isCurrentMap
                          ? "border-primary ring-2 ring-primary/30 scale-105"
                          : canSelect
                          ? "border-border hover:border-primary cursor-pointer hover:scale-105"
                          : "border-border cursor-default opacity-60"
                      )}
                    >
                      <div className="aspect-video bg-surface-elevated">
                        {map.imgPath ? (
                          <img
                            src={resolveMapImageUrl(map.imgPath)}
                            alt={map.description}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-sm font-bold text-muted">{map.description.charAt(0)}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-2 bg-background">
                        <p className="text-xs font-medium text-foreground truncate text-center">{map.description}</p>
                      </div>
                      {picked && (
                        <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                          <span className="text-[10px] text-muted font-semibold">USED</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right - Team B: big logo on top, rectangle (name) below */}
        <div className="flex flex-col gap-4">
          <div className={clsx(
            "w-full aspect-square rounded-full overflow-hidden border-2 transition-all bg-surface-elevated",
            isTeamBTurn
              ? "border-[color:var(--color-team-b)] animate-turn-glow-cyan"
              : "border-[color:var(--color-team-b)]/40"
          )}>
            {teamB?.logo ? (
              <img src={teamB.logo} alt={teamB.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[color:var(--color-team-b)]/20 flex items-center justify-center">
                <span className="text-5xl font-black text-[color:var(--color-team-b)]">
                  {teamB?.name?.charAt(0) || "B"}
                </span>
              </div>
            )}
          </div>
          <div className={clsx(
            "rounded-lg p-3 transition-all flex flex-col items-center gap-2 border",
            isTeamBTurn
              ? "bg-[color:var(--color-team-b)]/20 border-[color:var(--color-team-b)] animate-turn-glow-cyan"
              : "bg-surface-elevated/50 border-border"
          )}>
            <span className="text-base font-bold text-foreground text-center leading-tight uppercase tracking-wide break-words">
              {teamB?.name}
            </span>
            {isTeamBTurn && <Badge variant="primary" className="text-[10px] px-2 animate-pulse">Picking</Badge>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== BAN PHASE ====================

function BanPhase({
  isManager,
  isCaptain,
  isMyTurn,
  draftState,
  teams,
  heroes,
  getHeroById,
  myTeamId,
  selectedRole,
  setSelectedRole,
  onBanHero,
  onEndMap,
  isHeroBanned,
  wasHeroBannedByMyTeamBefore,
  wasHeroBannedInPreviousGames,
  getPreviousGameBanInfo,
  getHeroBanInfo,
  getBannedHeroesByTeam,
  getTeamTotalBans,
  getBanCountByRole,
  canBanRole,
  banWarning,
  setBanWarning,
  actionLoading,
}: {
  isManager: boolean;
  isCaptain: boolean;
  isMyTurn: boolean;
  draftState: DraftState;
  teams: Team[];
  heroes: Hero[];
  getHeroById: (heroId: number) => Hero | null;
  myTeamId?: number | null;
  selectedRole: "ALL" | "TANK" | "DPS" | "SUPPORT";
  setSelectedRole: (role: "ALL" | "TANK" | "DPS" | "SUPPORT") => void;
  onBanHero: (heroId: number | null) => void;
  onEndMap: () => void;
  isHeroBanned: (heroId: number) => boolean;
  wasHeroBannedByMyTeamBefore: (heroId: number) => boolean;
  wasHeroBannedInPreviousGames: (heroId: number) => boolean;
  getPreviousGameBanInfo: (heroId: number) => { bannedByTeamA: boolean; bannedByTeamB: boolean; teamNames: string[] };
  getHeroBanInfo: (heroId: number) => { bannedByTeamA: boolean; bannedByTeamB: boolean };
  getBannedHeroesByTeam: (teamId: number) => (number | null)[];
  getTeamTotalBans: (teamId: number) => number;
  getBanCountByRole: (teamId: number, role: "TANK" | "DPS" | "SUPPORT") => number;
  canBanRole: (role: "ALL" | "TANK" | "DPS" | "SUPPORT") => boolean;
  banWarning: string | null;
  setBanWarning: (warning: string | null) => void;
  actionLoading: boolean;
}) {
  const currentTeam = teams.find((t) => t.id === draftState.currentTurnTeamId);
  const teamA = teams.find((t) => t.id === draftState.match.teamAId);
  const teamB = teams.find((t) => t.id === draftState.match.teamBId);
  const currentMap = draftState.allMaps?.find((m) => m.id === draftState.currentMapId);

  const teamABans = teamA ? getBannedHeroesByTeam(teamA.id) : [];
  const teamBBans = teamB ? getBannedHeroesByTeam(teamB.id) : [];

  const isTeamATurn = draftState.currentTurnTeamId === teamA?.id;
  const isTeamBTurn = draftState.currentTurnTeamId === teamB?.id;

  // Group heroes by roleadfasdf
  const tankHeroes = heroes.filter((h) => h.role === "TANK");
  const dpsHeroes = heroes.filter((h) => h.role === "DPS");
  const supportHeroes = heroes.filter((h) => h.role === "SUPPORT");

  const renderBannedHero = (heroId: number | null, index: number) => {
    // If heroId is null, show "NO BAN" slot
    if (heroId === null) {
      return (
        <div
          key={`noban-${index}`}
          className="w-12 h-12 rounded-lg bg-muted/20 border border-muted/50 flex items-center justify-center"
        >
          <span className="text-[8px] text-muted font-semibold uppercase">No Ban</span>
        </div>
      );
    }
    
    const hero = getHeroById(heroId);
    return (
      <div
        key={heroId}
        className="w-12 h-12 rounded-lg bg-danger/20 border border-danger/50 flex flex-col items-center justify-center overflow-hidden"
      >
        {hero?.imgPath ? (
          <>
            <img src={resolveHeroImageUrl(hero.imgPath)} alt="" className="w-full h-8 object-cover grayscale" />
            <span className="text-[7px] text-danger truncate w-full text-center px-0.5">
              {hero.name}
            </span>
          </>
        ) : (
          <span className="text-xs text-danger font-bold">#{heroId}</span>
        )}
      </div>
    );
  };

  // Handle hero click with role limit warning - blocks backend call entirely
  const handleHeroClick = (hero: Hero) => {
    // Check if hero is already banned by either team in current game
    if (isHeroBanned(hero.id)) {
      setBanWarning("This hero is already banned in this game.");
      setTimeout(() => setBanWarning(null), 3000);
      return;
    }
    
    // Check if my team banned this hero in a previous game (visual feedback via red tones, but also block)
    if (wasHeroBannedByMyTeamBefore(hero.id)) {
      // Hero is shown in red, click is blocked by isDisabled, no alert needed
      return;
    }
    
    // Check if team already has 2 total bans
    if (myTeamId && getTeamTotalBans(myTeamId) >= 2) {
      setBanWarning("Your team has already completed both bans.");
      setTimeout(() => setBanWarning(null), 3000);
      return;
    }
    
    // Check role-specific limit (max 2 per role counting both teams)
    if (!canBanRole(hero.role)) {
      const roleName = hero.role.charAt(0) + hero.role.slice(1).toLowerCase();
      setBanWarning(`Maximum 2 ${roleName} heroes can be banned per game. Choose a different role.`);
      setTimeout(() => setBanWarning(null), 3000);
      return;
    }
    
    onBanHero(hero.id);
  };

  const [hoveredHero, setHoveredHero] = useState<number | null>(null);

  const renderHeroCard = (hero: Hero, canSelect: boolean, banned: boolean) => {
    const roleAtLimit = !canBanRole(hero.role);
    const teamDone = myTeamId ? getTeamTotalBans(myTeamId) >= 2 : false;
    
    // Check if hero was banned in previous games
    const prevBanInfo = getPreviousGameBanInfo(hero.id);
    const wasBannedBefore = prevBanInfo.bannedByTeamA || prevBanInfo.bannedByTeamB;
    const prevBannedByBoth = prevBanInfo.bannedByTeamA && prevBanInfo.bannedByTeamB;
    const myTeamBannedBefore = wasHeroBannedByMyTeamBefore(hero.id);
    
    const prevBannedByTeamAOnly = prevBanInfo.bannedByTeamA && !prevBanInfo.bannedByTeamB;
    const prevBannedByTeamBOnly = !prevBanInfo.bannedByTeamA && prevBanInfo.bannedByTeamB;
    
    // Disable if banned this game, OR if captain and their team banned it before
    const isDisabled = banned || actionLoading || roleAtLimit || teamDone || (isCaptain && myTeamBannedBefore);
    
    // Handle click - show warning for role limit even if disabled
    const handleCardClick = () => {
      if (banned) return;
      if (!isCaptain || !isMyTurn) return;
      
      // Show warning for role limit
      if (roleAtLimit) {
        const roleName = hero.role.charAt(0) + hero.role.slice(1).toLowerCase();
        setBanWarning(`Maximum 2 ${roleName} heroes can be banned per game. Choose a different role.`);
        setTimeout(() => setBanWarning(null), 3000);
        return;
      }
      
      // Otherwise use normal handler
      if (!isDisabled) {
        handleHeroClick(hero);
      }
    };

    const managerMarkTone = prevBannedByBoth
      ? "bg-black"
      : prevBannedByTeamAOnly
      ? "bg-red-500"
      : prevBannedByTeamBOnly
      ? "bg-blue-500"
      : "bg-border";

    const managerLabelTone = prevBannedByBoth
      ? "text-foreground"
      : prevBannedByTeamAOnly
      ? "text-red-300"
      : prevBannedByTeamBOnly
      ? "text-blue-300"
      : "text-muted";

    // Manager-only: previous-game bans are shown "turned off" (full grayscale).
    // The colored top stripe + tooltip still identify which team banned them.
    const managerGrayFilter = !banned && isManager && wasBannedBefore
      ? "grayscale(100%)"
      : undefined;

    return (
      <div key={hero.id} className="relative">
        <button
          onClick={handleCardClick}
          onMouseEnter={() => setHoveredHero(hero.id)}
          onMouseLeave={() => setHoveredHero(null)}
          className={clsx(
            "relative rounded-xl overflow-hidden border-2 transition-all flex flex-col group w-full",
            // Current game banned - GRAY tones
            banned
              ? "border-muted/50 cursor-not-allowed grayscale"
              // Previous game banned by my team (captain view) - RED tones
              : isCaptain && myTeamBannedBefore
              ? "border-danger/70 cursor-not-allowed"
              // Previous game banned (manager view)
              : isManager && wasBannedBefore
              ? prevBannedByBoth
                ? "border-black/80 cursor-not-allowed"
                : prevBannedByTeamAOnly
                ? "border-red-500/70 cursor-not-allowed"
                : "border-blue-500/70 cursor-not-allowed"
              : teamDone
              ? "border-border cursor-not-allowed opacity-40"
              : roleAtLimit && isCaptain
              ? "border-warning/50 cursor-pointer opacity-60"
              : canSelect
              ? "border-border hover:border-danger hover:ring-2 hover:ring-danger/30 cursor-pointer hover:scale-110 hover:z-10"
              // Manager: available heroes stay fully lit. Captain (not their turn): keep dimmed.
              : clsx("border-border cursor-default", !isManager && "opacity-60")
          )}
        >
          {!banned && isManager && wasBannedBefore && (
            <div className={clsx("absolute top-0 left-0 right-0 z-20 h-2.5", managerMarkTone)} />
          )}
          <div className="aspect-square bg-surface w-full relative">
            {hero.imgPath ? (
              <img
                src={resolveHeroImageUrl(hero.imgPath)}
                alt={hero.name}
                className={clsx(
                  "w-full h-full object-cover", 
                  // Current game banned - grayscale
                  banned && "grayscale opacity-50",
                  // Previous game banned by my team (captain) - red tint
                  !banned && isCaptain && myTeamBannedBefore && "opacity-60",
                  // Manager: previously-banned heroes look "turned off"
                  !banned && isManager && wasBannedBefore && "opacity-40",
                  canSelect && "group-hover:brightness-110"
                )}
                style={managerGrayFilter ? { filter: managerGrayFilter } : undefined}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-surface-elevated">
                <span className="text-sm font-bold text-muted">
                  {hero.role.charAt(0)}{hero.id}
                </span>
              </div>
            )}
            {/* Red overlay for captain - previous game ban by their team */}
            {!banned && isCaptain && myTeamBannedBefore && (
              <div className="absolute inset-0 bg-danger/30" />
            )}
          </div>
          <div className={clsx(
            "px-1 py-0.5 text-center",
            !banned && wasBannedBefore ? "bg-surface-elevated" : "bg-background"
          )}>
            <span className={clsx(
              "text-[10px] truncate block font-semibold leading-tight",
              !banned && wasBannedBefore ? managerLabelTone : "text-foreground"
            )}>
              {hero.name}
            </span>
          </div>
          {/* Current game banned overlay - GRAY */}
          {banned && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white font-semibold text-[10px] uppercase">Banned</span>
            </div>
          )}
          {/* Previous game banned overlay for captain - diagonal red lines (ban indicator) */}
          {!banned && isCaptain && myTeamBannedBefore && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-full h-full flex items-center justify-center">
                <svg className="absolute w-6 h-6 text-danger" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.8" />
                  <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          )}
        </button>
        {/* Tooltip for manager showing which team banned */}
        {isManager && wasBannedBefore && !banned && hoveredHero === hero.id && (
          <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface-elevated border border-border rounded text-[10px] whitespace-nowrap shadow-lg">
            <span className={clsx("font-medium", managerLabelTone)}>Banned by: </span>
            <span className="text-foreground">{prevBanInfo.teamNames.join(" & ")}</span>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-elevated" />
          </div>
        )}
      </div>
    );
  };

  const renderHeroSection = (title: string, heroList: Hero[], roleColor: string) => (
    <div className="mb-1.5">
      <div className="flex items-center gap-2 mb-1 border-b border-border pb-0.5">
        <div className={clsx("w-1 h-3 rounded-full", roleColor)} />
        <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider">{title}</h4>
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] text-muted">{heroList.length}</span>
      </div>
      <div className="grid grid-cols-7 sm:grid-cols-9 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 2xl:grid-cols-16 gap-1.5">
        {heroList.map((hero) => {
          const banned = isHeroBanned(hero.id);
          const myTeamBannedBefore = wasHeroBannedByMyTeamBefore(hero.id);
          const canSelect = isCaptain && isMyTurn && !banned && !myTeamBannedBefore && canBanRole(hero.role);
          return renderHeroCard(hero, canSelect, banned);
        })}
      </div>
    </div>
  );

  // Render compact ban slot (square)
  const renderBanSlot = (heroId: number | null, index: number, teamColor: "LEFT" | "RIGHT") => {
    const colorClasses =
      teamColor === "LEFT"
        ? {
            border: "border-red-500/70",
            bg: "bg-red-500/10",
            text: "text-red-300",
            slotBg: "bg-red-500/10",
          }
        : {
            border: "border-blue-500/70",
            bg: "bg-blue-500/10",
            text: "text-blue-300",
            slotBg: "bg-blue-500/10",
          };

    if (heroId === null) {
      return (
        <div
          key={`noban-${index}`}
          className={clsx(
            "w-24 h-24 rounded-xl border-2 flex items-center justify-center",
            colorClasses.border,
            colorClasses.slotBg
          )}
        >
          <span className={clsx("text-[11px] font-bold uppercase", colorClasses.text)}>Skip</span>
        </div>
      );
    }
    
    const hero = getHeroById(heroId);
    return (
      <div
        key={heroId}
        className={clsx("w-24 rounded-xl overflow-hidden border-2", colorClasses.border, colorClasses.bg)}
      >
        {hero?.imgPath ? (
          <>
            <img src={resolveHeroImageUrl(hero.imgPath)} alt={hero.name} className="w-full h-16 object-cover grayscale" />
            <div className="px-1 py-1.5 bg-background/80">
              <p className={clsx("text-[11px] font-semibold text-center truncate", colorClasses.text)}>{hero.name}</p>
            </div>
          </>
        ) : (
          <div className="w-full h-24 flex items-center justify-center">
            <span className={clsx("text-sm font-bold", colorClasses.text)}>#{heroId}</span>
          </div>
        )}
      </div>
    );
  };

  // Render empty ban slot (square)
  const renderEmptySlot = (slotNum: number) => (
    <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-surface-elevated/30">
      <span className="text-sm text-muted">{slotNum}</span>
    </div>
  );

  return (
    <div className="min-h-[85vh] flex flex-col">
      {/* Warning Toast */}
      {banWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-warning text-warning-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium">{banWarning}</span>
          </div>
        </div>
      )}

      {/* Playing on Map Header */}
      <div className="text-center mb-4">
        {currentMap && (
          <div className="inline-flex items-center gap-4 bg-gradient-to-r from-primary/10 to-accent/10 border-2 border-primary/50 rounded-lg px-6 py-3 shadow-lg shadow-primary/20">
            <span className="text-xs text-primary uppercase tracking-widest font-bold">Playing On</span>
            <span className="text-2xl font-black text-foreground">{currentMap.description}</span>
            <Badge variant="primary" className="px-3 py-1">{currentMap.type}</Badge>
          </div>
        )}
      </div>

      {/* Full Width Layout - Team A Bans | Hero Grid | Team B Bans */}
      <div className="flex-1 grid grid-cols-[140px_minmax(0,1fr)_140px] xl:grid-cols-[180px_minmax(0,1fr)_180px] gap-4">
        {/* LEFT - Team A: big logo on top, rectangle with name + bans below */}
        <div className="flex flex-col gap-4 h-fit">
          <div className={clsx(
            "w-full aspect-square rounded-full overflow-hidden border-2 transition-all bg-surface-elevated",
            isTeamATurn
              ? "border-red-500 animate-turn-glow-red"
              : "border-red-500/50"
          )}>
            {teamA?.logo ? (
              <img src={teamA.logo} alt={teamA.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-red-500/20 flex items-center justify-center">
                <span className="text-5xl font-black text-red-300">
                  {teamA?.name?.charAt(0) || "A"}
                </span>
              </div>
            )}
          </div>
          <div className={clsx(
            "rounded-xl p-3 transition-all border flex flex-col items-center gap-3",
            isTeamATurn
              ? "bg-red-500/20 border-red-500 animate-turn-glow-red"
              : "bg-red-500/10 border-red-500/40"
          )}>
            <div className="flex flex-col items-center gap-1">
              <span className="text-base font-bold text-red-200 text-center leading-tight uppercase tracking-wide break-words">
                {teamA?.name}
              </span>
              {isTeamATurn && <Badge variant="danger" className="text-[10px] px-2 animate-pulse">Banning</Badge>}
            </div>
            <div className="flex flex-col items-center gap-2 w-full">
              {teamABans.length === 0 ? (
                <>
                  {renderEmptySlot(1)}
                  {renderEmptySlot(2)}
                </>
              ) : (
                <>
                  {teamABans.map((heroId, idx) => renderBanSlot(heroId, idx, "LEFT"))}
                  {teamABans.length < 2 && renderEmptySlot(teamABans.length + 1)}
                </>
              )}
            </div>
          </div>
        </div>

        {/* CENTER - Hero Grid (Full Width) */}
        <div className="flex flex-col">
          {/* Controls Bar */}
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground uppercase tracking-wide">Hero Bans</span>
              {isCaptain && isMyTurn && myTeamId && getTeamTotalBans(myTeamId) < 2 && (
                <Badge variant="warning" className="animate-pulse-glow text-xs">Your Turn</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Role Tabs */}
              {(["ALL", "TANK", "DPS", "SUPPORT"] as const).map((role) => (
                <Button
                  key={role}
                  variant={selectedRole === role ? "default" : "ghost"}
                  onClick={() => setSelectedRole(role)}
                  size="sm"
                  className="text-xs px-3"
                >
                  {role === "ALL" ? "All" : role}
                </Button>
              ))}
              {isManager && (
                <Button size="sm" variant="secondary" onClick={onEndMap} disabled={actionLoading} className="ml-2">
                  End Map
                </Button>
              )}
            </div>
          </div>

          {/* Status Messages */}
          {isCaptain && myTeamId && getTeamTotalBans(myTeamId) >= 2 && (
            <div className="mb-3 p-2 rounded-lg bg-success/10 border border-success/30 text-center">
              <p className="text-xs text-success font-semibold">Your team has completed both bans</p>
            </div>
          )}
          
          {isCaptain && !isMyTurn && myTeamId && getTeamTotalBans(myTeamId) < 2 && (
            <div className="mb-3 p-2 rounded-lg bg-surface-elevated border border-border text-center">
              <p className="text-xs text-muted">Waiting for {currentTeam?.name} to ban...</p>
            </div>
          )}

          {/* Hero Grid - compact so every hero fits on screen */}
          <div className="flex-1 min-h-0">
            {selectedRole === "ALL" ? (
              <div className="space-y-2">
                {renderHeroSection("Tank", tankHeroes, "bg-yellow-500")}
                {renderHeroSection("DPS", dpsHeroes, "bg-red-500")}
                {renderHeroSection("Support", supportHeroes, "bg-green-500")}
              </div>
            ) : (
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 2xl:grid-cols-16 gap-1.5">
                {heroes.filter((h) => h.role === selectedRole).map((hero) => {
                  const banned = isHeroBanned(hero.id);
                  const canSelect = isCaptain && isMyTurn && !banned && canBanRole(hero.role);
                  return renderHeroCard(hero, canSelect, banned);
                })}
              </div>
            )}
          </div>

          {/* Skip Ban Button */}
          {isCaptain && isMyTurn && myTeamId && getTeamTotalBans(myTeamId) < 2 && (
            <div className="mt-3 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onBanHero(null)}
                disabled={actionLoading}
                className="text-muted hover:text-foreground text-xs"
              >
                Skip Ban
              </Button>
            </div>
          )}
        </div>

        {/* RIGHT - Team B: big logo on top, rectangle with name + bans below */}
        <div className="flex flex-col gap-4 h-fit">
          <div className={clsx(
            "w-full aspect-square rounded-full overflow-hidden border-2 transition-all bg-surface-elevated",
            isTeamBTurn
              ? "border-blue-500 animate-turn-glow-blue"
              : "border-blue-500/50"
          )}>
            {teamB?.logo ? (
              <img src={teamB.logo} alt={teamB.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-blue-500/20 flex items-center justify-center">
                <span className="text-5xl font-black text-blue-300">
                  {teamB?.name?.charAt(0) || "B"}
                </span>
              </div>
            )}
          </div>
          <div className={clsx(
            "rounded-xl p-3 transition-all border flex flex-col items-center gap-3",
            isTeamBTurn
              ? "bg-blue-500/20 border-blue-500 animate-turn-glow-blue"
              : "bg-blue-500/10 border-blue-500/40"
          )}>
            <div className="flex flex-col items-center gap-1">
              <span className="text-base font-bold text-blue-200 text-center leading-tight uppercase tracking-wide break-words">
                {teamB?.name}
              </span>
              {isTeamBTurn && <Badge variant="danger" className="text-[10px] px-2 animate-pulse">Banning</Badge>}
            </div>
            <div className="flex flex-col items-center gap-2 w-full">
              {teamBBans.length === 0 ? (
                <>
                  {renderEmptySlot(1)}
                  {renderEmptySlot(2)}
                </>
              ) : (
                <>
                  {teamBBans.map((heroId, idx) => renderBanSlot(heroId, idx, "RIGHT"))}
                  {teamBBans.length < 2 && renderEmptySlot(teamBBans.length + 1)}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== END MAP PHASE ====================

function EndMapPhase({
  isManager,
  isCaptain,
  myTeamId,
  draftState,
  teams,
  getHeroById,
  amIReady,
  onStartMapPicking,
  onSubmitResult,
  onSetReady,
  getBannedHeroesByTeam,
  actionLoading,
}: {
  isManager: boolean;
  isCaptain: boolean;
  myTeamId?: number | null;
  draftState: DraftState;
  teams: Team[];
  getHeroById: (heroId: number) => Hero | null;
  amIReady: boolean;
  onStartMapPicking: () => void;
  onSubmitResult: (winnerTeamId: number | null) => void;
  onSetReady: () => void;
  getBannedHeroesByTeam: (teamId: number) => (number | null)[];
  actionLoading: boolean;
}) {
  const winsNeeded = Math.ceil(draftState.match.bestOf / 2);
  const teamAWins = draftState.match.mapWinsTeamA;
  const teamBWins = draftState.match.mapWinsTeamB;
  const teamA = teams.find((t) => t.id === draftState.match.teamAId);
  const teamB = teams.find((t) => t.id === draftState.match.teamBId);
  const currentMap = draftState.allMaps?.find((m) => m.id === draftState.currentMapId);
  const currentGameNumber = (draftState.match.gameNumber || 0) + 1;

  // Get banned heroes for this game
  const teamABans = teamA ? getBannedHeroesByTeam(teamA.id) : [];
  const teamBBans = teamB ? getBannedHeroesByTeam(teamB.id) : [];

  // Check if result has been registered for current game
  const currentMapResult = draftState.match.mapResults?.find(
    (r) => r.gameNumber === currentGameNumber
  );
  const resultRegistered = !!currentMapResult;

  // Check if match is finished based on wins
  const matchIsFinished = teamAWins >= winsNeeded || teamBWins >= winsNeeded;

  // Check if both teams are ready for next map
  const bothReady = draftState.match.teamAready === 1 && draftState.match.teamBready === 1;

  const renderBannedHeroEndMap = (heroId: number | null, index: number) => {
    if (heroId === null) {
      return (
        <div
          key={`noban-${index}`}
          className="w-12 h-12 rounded-lg bg-muted/20 border border-muted/50 flex items-center justify-center"
        >
          <span className="text-[8px] text-muted font-semibold uppercase">No Ban</span>
        </div>
      );
    }
    
    const hero = getHeroById(heroId);
    return (
      <div
        key={heroId}
        className="w-12 h-12 rounded-lg bg-danger/20 border border-danger/50 flex flex-col items-center justify-center overflow-hidden"
      >
        {hero?.imgPath ? (
          <>
            <img src={resolveHeroImageUrl(hero.imgPath)} alt="" className="w-full h-8 object-cover grayscale" />
            <span className="text-[7px] text-danger truncate w-full text-center">
              {hero.name}
            </span>
          </>
        ) : (
          <span className="text-xs text-danger font-bold">#{heroId}</span>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* PLAYING ON MAP - Central Hero Display */}
      {currentMap && (
        <div className="flex-1 flex flex-col items-center justify-center py-8">
          <div className="text-center mb-6">
            <p className="text-lg text-primary uppercase tracking-widest font-bold mb-2 animate-pulse">
              Playing On Map...
            </p>
            <div className="relative w-full max-w-2xl rounded-2xl overflow-hidden border-4 border-primary shadow-2xl shadow-primary/40">
              {currentMap.imgPath ? (
                <img
                  src={resolveMapImageUrl(currentMap.imgPath)}
                  alt={currentMap.description}
                  className="w-full aspect-video object-cover"
                />
              ) : (
                <div className="w-full aspect-video bg-surface-elevated flex items-center justify-center">
                  <span className="text-6xl font-bold text-muted">{currentMap.description.charAt(0)}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-center">
                <p className="text-4xl font-black text-white mb-2">{currentMap.description}</p>
                <Badge variant="primary" className="text-lg px-4 py-2">{currentMap.type}</Badge>
              </div>
            </div>
          </div>

          {/* Score Display */}
          <div className="flex items-center justify-center gap-8 mb-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[color:var(--color-team-a)]/30 border-2 border-[color:var(--color-team-a)] flex items-center justify-center mx-auto mb-2">
                <span className="text-lg font-bold text-[color:var(--color-team-a)]">
                  {teamA?.name?.charAt(0) || "A"}
                </span>
              </div>
              <p className="text-sm text-foreground font-semibold mb-1">{teamA?.name}</p>
              <p className="text-3xl font-bold text-[color:var(--color-team-a)]">{teamAWins}</p>
            </div>
            <div className="text-3xl text-muted font-bold">-</div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[color:var(--color-team-b)]/30 border-2 border-[color:var(--color-team-b)] flex items-center justify-center mx-auto mb-2">
                <span className="text-lg font-bold text-[color:var(--color-team-b)]">
                  {teamB?.name?.charAt(0) || "B"}
                </span>
              </div>
              <p className="text-sm text-foreground font-semibold mb-1">{teamB?.name}</p>
              <p className="text-3xl font-bold text-[color:var(--color-team-b)]">{teamBWins}</p>
            </div>
          </div>

          <p className="text-xs text-muted">
            Game {currentGameNumber} | Best of {draftState.match.bestOf} | First to {winsNeeded}
          </p>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="border-t border-border pt-6">
        {/* Manager: Register Match Result Form */}
        {isManager && !resultRegistered && !matchIsFinished && (
          <div className="max-w-2xl mx-auto">
            <h3 className="text-lg font-bold text-foreground mb-4 text-center">
              Register Game {currentGameNumber} Result
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <Button
                size="lg"
                variant="outline"
                onClick={() => onSubmitResult(teamA?.id || 0)}
                disabled={actionLoading}
                className="flex flex-col items-center gap-2 h-auto py-4 border-2 border-[color:var(--color-team-a)] hover:bg-[color:var(--color-team-a)]/10"
              >
                <span className="text-xl font-bold text-[color:var(--color-team-a)]">{teamA?.name}</span>
                <span className="text-xs text-muted">Won</span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => onSubmitResult(null)}
                disabled={actionLoading}
                className="flex flex-col items-center gap-2 h-auto py-4 border-2"
              >
                <span className="text-xl font-bold text-muted">Draw</span>
                <span className="text-xs text-muted">Tie</span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => onSubmitResult(teamB?.id || 0)}
                disabled={actionLoading}
                className="flex flex-col items-center gap-2 h-auto py-4 border-2 border-[color:var(--color-team-b)] hover:bg-[color:var(--color-team-b)]/10"
              >
                <span className="text-xl font-bold text-[color:var(--color-team-b)]">{teamB?.name}</span>
                <span className="text-xs text-muted">Won</span>
              </Button>
            </div>
          </div>
        )}

        {/* Manager: Result registered, wait for captains */}
        {isManager && resultRegistered && !matchIsFinished && (
          <div className="text-center">
            <Badge variant="success" className="mb-3">Result Registered</Badge>
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className={clsx("w-3 h-3 rounded-full", draftState.match.teamAready ? "bg-success" : "bg-muted")} />
                <span className="text-sm text-muted">{teamA?.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={clsx("w-3 h-3 rounded-full", draftState.match.teamBready ? "bg-success" : "bg-muted")} />
                <span className="text-sm text-muted">{teamB?.name}</span>
              </div>
            </div>
            <Button 
              size="lg" 
              onClick={onStartMapPicking} 
              disabled={actionLoading || !bothReady}
              className="px-8"
            >
              {actionLoading ? "Starting..." : "Start Next Map"}
            </Button>
          </div>
        )}

        {/* Captain: Ready button - ONLY shows after result is registered */}
        {isCaptain && resultRegistered && !matchIsFinished && (
          <div className="text-center">
            {!amIReady ? (
              <Button 
                size="lg" 
                onClick={onSetReady} 
                disabled={actionLoading}
                className="px-8"
              >
                {actionLoading ? "Setting ready..." : "Ready for Next Map"}
              </Button>
            ) : (
              <Badge variant="success" className="text-sm px-4 py-2">You are ready - Waiting for others...</Badge>
            )}
          </div>
        )}

        {/* Captain: Waiting for result (no Ready button yet) */}
        {isCaptain && !resultRegistered && !matchIsFinished && (
          <div className="text-center">
            <p className="text-sm text-muted">Play the game. Manager will register the result.</p>
          </div>
        )}

        {/* Match finished */}
        {matchIsFinished && (
          <div className="text-center py-4">
            <Badge variant="success" className="mb-3">Match Complete</Badge>
            <p className="text-2xl font-bold text-primary">
              {teamAWins > teamBWins ? teamA?.name : teamB?.name} Wins!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== FINISHED PHASE ====================

function FinishedPhase({
  draftState,
  teams,
}: {
  draftState: DraftState;
  teams: Team[];
}) {
  const teamA = teams.find((t) => t.id === draftState.match.teamAId);
  const teamB = teams.find((t) => t.id === draftState.match.teamBId);
  const teamAWins = draftState.match.mapWinsTeamA;
  const teamBWins = draftState.match.mapWinsTeamB;
  let winner = null;

  if (teamAWins > teamBWins) winner = teamA;
  else if (teamBWins > teamAWins) winner = teamB;

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <Card variant="featured" className="w-full max-w-lg">
        <CardContent className="p-8 text-center">
          <Badge variant="success" className="mb-4">MATCH COMPLETE</Badge>
          
          <div className="mb-6">
            <p className="text-sm text-muted mb-2">Winner</p>
            <p className="text-3xl font-bold text-primary">{winner?.name}</p>
          </div>

          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-sm text-muted mb-1">{teamA?.name}</p>
              <p className="text-4xl font-bold text-[color:var(--color-team-a)]">{teamAWins}</p>
            </div>
            <div className="text-2xl text-muted">-</div>
            <div className="text-center">
              <p className="text-sm text-muted mb-1">{teamB?.name}</p>
              <p className="text-4xl font-bold text-[color:var(--color-team-b)]">{teamBWins}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== DRAFT HISTORY (Only shown after PENDINGRESULT/FINISHED) ====================

function DraftHistory({
  draftState,
  teams,
  getHeroById,
}: {
  draftState: DraftState;
  teams: Team[];
  getHeroById: (heroId: number) => Hero | null;
}) {
  const actions = draftState.actions || [];
  const maps = draftState.allMaps || [];

  if (actions.length === 0) return null;

  const getTeamName = (teamId: number) =>
    teams.find((t) => t.id === teamId)?.name || `Team ${teamId}`;

  const getActionDisplay = (action: DraftState["actions"][0]) => {
    if (action.action === "BAN"   && action.value === null) {
      return "Skipped";
    }
    if (action.action === "PICK" && action.value) {
      const map = maps.find((m) => m.id === action.value);
      return map ? `Picked ${map.description}` : `Picked Map #${action.value}`;
    }
    if (action.action === "BAN" && action.value) {
      const hero = getHeroById(action.value);
      return hero ? `Banned ${hero.name}` : `Banned Hero #${action.value}`;
    }
    return action.action;
  };

  const actionsByGame = actions.reduce((acc, action) => {
    if (!acc[action.gameNumber]) acc[action.gameNumber] = [];
    acc[action.gameNumber].push(action);
    return acc;
  }, {} as Record<number, typeof actions>);

  return (
    <Card variant="featured" className="mt-8">
      <CardHeader>
        <CardTitle className="text-lg">Draft History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6 max-h-80 overflow-y-auto">
          {Object.entries(actionsByGame)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([gameNum, gameActions]) => (
              <div key={gameNum}>
                <p className="text-xs text-muted uppercase tracking-wide mb-2">Game {gameNum}</p>
                <div className="space-y-1">
                  {gameActions
                    .sort((a, b) => a.order - b.order)
                    .map((action) => (
                      <div
                        key={action.id}
                        className={clsx(
                          "flex items-center justify-between p-2 rounded text-sm",
                          action.action === "BAN" ? "bg-danger/10" :
                          action.action === "PICK" ? "bg-primary/10" : "bg-surface-elevated"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              action.action === "BAN" ? "danger" :
                              action.action === "PICK" ? "success" : "default"
                            }
                            className="text-[10px]"
                          >
                            {action.action}
                          </Badge>
                          <span className="font-medium text-foreground text-xs">
                            {getTeamName(action.teamId)}
                          </span>
                        </div>
                        <span className="text-xs text-muted">{getActionDisplay(action)}</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
