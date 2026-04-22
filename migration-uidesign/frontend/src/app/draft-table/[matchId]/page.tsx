"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { getTeams, submitMatchResult, updateCaptainMatch, type Team } from "@/lib/api";
import { clsx } from "clsx";
import { resolveHeroImageUrl, resolveMapImageUrl } from "@/lib/assetUrls";

const POLL_INTERVAL = 3000;
const TURN_DURATION = 75;

type Phase = "STARTING" | "MAPPICKING" | "BAN" | "ENDMAP" | "FINISHED";

export default function DraftTablePage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated } = useSession();

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
    if (!isAuthenticated) {
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

  useEffect(() => {
    // Timer only runs during BAN phase (map picking doesn't need timer - waiting for captain to pick)
    if (!draftState?.phaseStartedAt || currentPhase !== "BAN") {
      setTimeLeft(TURN_DURATION);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const startTime = new Date(draftState.phaseStartedAt).getTime();
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, TURN_DURATION - elapsed);
      setTimeLeft(remaining);
    };
    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [draftState?.phaseStartedAt, currentPhase]);

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
        getDraftByMatchId(matchId),
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
      const draft = await getDraftState(draftId);
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

  const isHeroBanned = (heroId: number) => {
    return draftState?.bannedHeroes?.includes(heroId) || false;
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

  if (error || !draftState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
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

  return (
    <main className="min-h-screen bg-background">
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
              {currentPhase === "BAN" && (
                <div
                  className={clsx(
                    "text-2xl font-mono font-bold tabular-nums",
                    timeLeft <= 15 ? "text-danger animate-timer-pulse" : "text-foreground"
                  )}
                >
                  {formatTime(timeLeft)}
                </div>
              )}
              {currentPhase === "MAPPICKING" && (
                <div className="text-sm text-muted font-medium">
                  Waiting for map pick...
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
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
  actionLoading: boolean;
}) {
  const bothReady = match.teamAready === 1 && match.teamBready === 1;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-2xl">
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
              <Button 
                size="lg" 
                onClick={onStart} 
                disabled={actionLoading} 
                className="px-8"
              >
                {actionLoading ? "Starting..." : "Start Map Picking"}
              </Button>
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
  const pickedMaps = draftState.pickedMaps || [];
  
  const getTeamPickedMaps = (teamId: number) => {
    return draftState.actions
      ?.filter((a) => a.teamId === teamId && a.action === "PICK")
      .map((a) => draftState.allMaps?.find((m) => m.id === a.value))
      .filter(Boolean) || [];
  };

  const teamAMaps = getTeamPickedMaps(teamA?.id || 0);
  const teamBMaps = getTeamPickedMaps(teamB?.id || 0);
  const isTeamATurn = draftState.currentTurnTeamId === teamA?.id;
  const isTeamBTurn = draftState.currentTurnTeamId === teamB?.id;

  return (
    <div className="space-y-6">
      {/* Current Map - Top */}
      <div className="text-center">
        {currentMap ? (
          <div className="inline-flex items-center gap-4 bg-surface border border-border rounded-lg px-6 py-3">
            <span className="text-sm text-muted uppercase tracking-wide">Selected Map</span>
            <span className="text-xl font-bold text-foreground">{currentMap.description}</span>
            <Badge variant="primary">{currentMap.type}</Badge>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 text-muted">
            <span className="text-sm uppercase tracking-wide">Awaiting map selection...</span>
          </div>
        )}
      </div>

      {/* Two Column Layout - Combined Teams + Map Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* Left - Combined Teams Panel */}
        <Card className="border-border h-fit">
          <CardContent className="p-4">
            {/* Team A */}
            <div className={clsx(
              "rounded-lg p-3 mb-4 transition-all",
              isTeamATurn ? "bg-[color:var(--color-team-a)]/10 ring-2 ring-[color:var(--color-team-a)]" : "bg-surface-elevated"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-[color:var(--color-team-a)]" />
                <h3 className="font-semibold text-foreground text-sm flex-1">{teamA?.name}</h3>
                {isTeamATurn && <Badge variant="primary" className="text-[10px]">Turn</Badge>}
              </div>
              <p className="text-[10px] text-muted mb-2 uppercase tracking-wide">Picked Maps</p>
              <div className="space-y-2">
                {teamAMaps.length === 0 ? (
                  <p className="text-xs text-muted italic">No maps picked yet</p>
                ) : (
                  teamAMaps.map((map) => (
                    <div key={map!.id} className="flex items-center gap-2 p-2 rounded bg-background">
                      <div className="w-8 h-5 rounded overflow-hidden bg-surface-elevated flex-shrink-0">
                        {map!.imgPath && (
                          <img src={resolveMapImageUrl(map!.imgPath)} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <span className="text-xs text-foreground truncate">{map!.description}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-border my-3" />

            {/* Team B */}
            <div className={clsx(
              "rounded-lg p-3 transition-all",
              isTeamBTurn ? "bg-[color:var(--color-team-b)]/10 ring-2 ring-[color:var(--color-team-b)]" : "bg-surface-elevated"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-[color:var(--color-team-b)]" />
                <h3 className="font-semibold text-foreground text-sm flex-1">{teamB?.name}</h3>
                {isTeamBTurn && <Badge variant="primary" className="text-[10px]">Turn</Badge>}
              </div>
              <p className="text-[10px] text-muted mb-2 uppercase tracking-wide">Picked Maps</p>
              <div className="space-y-2">
                {teamBMaps.length === 0 ? (
                  <p className="text-xs text-muted italic">No maps picked yet</p>
                ) : (
                  teamBMaps.map((map) => (
                    <div key={map!.id} className="flex items-center gap-2 p-2 rounded bg-background">
                      <div className="w-8 h-5 rounded overflow-hidden bg-surface-elevated flex-shrink-0">
                        {map!.imgPath && (
                          <img src={resolveMapImageUrl(map!.imgPath)} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <span className="text-xs text-foreground truncate">{map!.description}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right - Map Grid (more space now) */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Available Maps</CardTitle>
              {isCaptain && isMyTurn && (
                <Badge variant="success" className="animate-pulse-glow">Your Turn</Badge>
              )}
              {isManager && currentMap && (
                <Button size="sm" onClick={onStartBan} disabled={actionLoading}>
                  Start Ban Phase
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isCaptain && !isMyTurn && (
              <div className="mb-4 p-3 rounded-lg bg-surface-elevated text-center">
                <p className="text-sm text-muted">Waiting for {currentTeam?.name} to pick...</p>
              </div>
            )}

            <div className="grid grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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
                      "relative rounded-lg overflow-hidden border-2 transition-all group",
                      picked
                        ? "border-border opacity-40 grayscale cursor-not-allowed"
                        : isCurrentMap
                        ? "border-primary ring-2 ring-primary/30"
                        : canSelect
                        ? "border-border hover:border-primary cursor-pointer hover:scale-[1.02]"
                        : "border-border cursor-default"
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
                          <span className="text-lg font-bold text-muted">{map.description.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-background">
                      <p className="text-xs font-medium text-foreground truncate">{map.description}</p>
                      <Badge variant="outline" className="text-[10px] mt-1">{map.type}</Badge>
                    </div>
                    {picked && (
                      <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                        <span className="text-xs text-muted font-semibold">PICKED</span>
                      </div>
                    )}
                    {isCurrentMap && (
                      <div className="absolute top-1 right-1">
                        <Badge variant="success" className="text-[10px]">Selected</Badge>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {isManager && (
        <div className="text-center text-sm text-muted">
          Manager View: Wait for captain to pick a map, then start ban phase.
        </div>
      )}
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

  // Group heroes by role
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
    // Check if team already has 2 total bans
    if (myTeamId && getTeamTotalBans(myTeamId) >= 2) {
      setBanWarning("Your team has already completed both bans.");
      setTimeout(() => setBanWarning(null), 3000);
      return;
    }
    
    // Check role-specific limit
    if (!canBanRole(hero.role)) {
      const roleName = hero.role.charAt(0) + hero.role.slice(1).toLowerCase();
      setBanWarning(`You already banned 2 ${roleName} heroes. Choose a different role.`);
      setTimeout(() => setBanWarning(null), 3000);
      return;
    }
    
    onBanHero(hero.id);
  };

  const renderHeroCard = (hero: Hero, canSelect: boolean, banned: boolean) => {
    const roleAtLimit = !canBanRole(hero.role);
    const teamDone = myTeamId ? getTeamTotalBans(myTeamId) >= 2 : false;
    const isDisabled = banned || actionLoading || roleAtLimit || teamDone;
    
    return (
      <button
        key={hero.id}
        onClick={() => !isDisabled && isCaptain && isMyTurn && handleHeroClick(hero)}
        disabled={isDisabled}
        className={clsx(
          "relative rounded-lg overflow-hidden border-2 transition-all flex flex-col",
          banned
            ? isManager 
              ? "border-danger cursor-not-allowed" // Manager sees red border
              : "border-muted/50 cursor-not-allowed grayscale" // Captain sees gray
            : teamDone
            ? "border-border cursor-not-allowed opacity-40" // Team finished banning
            : roleAtLimit && isCaptain
            ? "border-warning/50 cursor-not-allowed opacity-60" // Role at limit
            : canSelect
            ? "border-border hover:border-danger cursor-pointer hover:scale-105"
            : "border-border cursor-default opacity-60"
        )}
      >
        <div className="aspect-square bg-surface">
          {hero.imgPath ? (
            <img
              src={resolveHeroImageUrl(hero.imgPath)}
              alt={hero.name}
              className={clsx(
                "w-full h-full object-cover", 
                banned && isCaptain && "grayscale opacity-50" // Captain sees gray
              )}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xs font-bold text-muted">
                {hero.role.charAt(0)}{hero.id}
              </span>
            </div>
          )}
        </div>
        <div className="px-1 py-0.5 bg-background text-center">
          <span className="text-[9px] text-foreground truncate block">
            {hero.name}
          </span>
        </div>
        {/* Banned overlay - different for manager vs captain */}
        {banned && isManager && (
          <div className="absolute inset-0 bg-danger/70 flex items-center justify-center">
            <span className="text-white font-bold text-xl">X</span>
          </div>
        )}
        {banned && isCaptain && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-muted-foreground font-semibold text-[9px] uppercase">Banned</span>
          </div>
        )}
      </button>
    );
  };

  const renderHeroSection = (title: string, heroList: Hero[], roleColor: string) => (
    <div className="mb-4">
      <div className="flex items-center gap-3 mb-3 border-b border-border pb-2">
        <div className={clsx("w-1.5 h-5 rounded-full", roleColor)} />
        <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">{title}</h4>
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted bg-surface-elevated px-2 py-0.5 rounded-full">
          {heroList.length} heroes
        </span>
      </div>
      <div className="grid grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
        {heroList.map((hero) => {
          const banned = isHeroBanned(hero.id);
          const canSelect = isCaptain && isMyTurn && !banned && canBanRole(hero.role);
          return renderHeroCard(hero, canSelect, banned);
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
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

      {/* Current Map - Top */}
      <div className="text-center">
        {currentMap && (
          <div className="inline-flex items-center gap-4 bg-surface border border-border rounded-lg px-6 py-3">
            <span className="text-sm text-muted uppercase tracking-wide">Current Map</span>
            <span className="text-xl font-bold text-foreground">{currentMap.description}</span>
            <Badge variant="primary">{currentMap.type}</Badge>
          </div>
        )}
      </div>

      {/* Two Column Layout - Teams Panel + Hero Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* Left - Combined Teams Panel */}
        <Card className="border-border h-fit">
          <CardContent className="p-4">
            {/* Team A */}
            <div className={clsx(
              "rounded-lg p-3 mb-4 transition-all",
              isTeamATurn ? "bg-[color:var(--color-team-a)]/10 ring-2 ring-[color:var(--color-team-a)]" : "bg-surface-elevated"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-[color:var(--color-team-a)]" />
                <h3 className="font-semibold text-foreground text-sm flex-1">{teamA?.name}</h3>
                {teamABans.length >= 2 ? (
                  <Badge variant="success" className="text-[10px]">Done</Badge>
                ) : isTeamATurn ? (
                  <Badge variant="danger" className="text-[10px]">Banning</Badge>
                ) : null}
              </div>
              <p className="text-[10px] text-muted mb-2 uppercase tracking-wide">Banned Heroes</p>
              <div className="flex gap-2">
                {teamABans.length === 0 ? (
                  <>
                    <div className="w-12 h-12 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                      <span className="text-[10px] text-muted">1</span>
                    </div>
                    <div className="w-12 h-12 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                      <span className="text-[10px] text-muted">2</span>
                    </div>
                  </>
                ) : (
                  <>
                    {teamABans.map((heroId, idx) => renderBannedHero(heroId, idx))}
                    {teamABans.length < 2 && (
                      <div className="w-12 h-12 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                        <span className="text-[10px] text-muted">{teamABans.length + 1}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-border my-3" />

            {/* Team B */}
            <div className={clsx(
              "rounded-lg p-3 transition-all",
              isTeamBTurn ? "bg-[color:var(--color-team-b)]/10 ring-2 ring-[color:var(--color-team-b)]" : "bg-surface-elevated"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-[color:var(--color-team-b)]" />
                <h3 className="font-semibold text-foreground text-sm flex-1">{teamB?.name}</h3>
                {teamBBans.length >= 2 ? (
                  <Badge variant="success" className="text-[10px]">Done</Badge>
                ) : isTeamBTurn ? (
                  <Badge variant="danger" className="text-[10px]">Banning</Badge>
                ) : null}
              </div>
              <p className="text-[10px] text-muted mb-2 uppercase tracking-wide">Banned Heroes</p>
              <div className="flex gap-2">
                {teamBBans.length === 0 ? (
                  <>
                    <div className="w-12 h-12 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                      <span className="text-[10px] text-muted">1</span>
                    </div>
                    <div className="w-12 h-12 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                      <span className="text-[10px] text-muted">2</span>
                    </div>
                  </>
                ) : (
                  <>
                    {teamBBans.map((heroId, idx) => renderBannedHero(heroId, idx))}
                    {teamBBans.length < 2 && (
                      <div className="w-12 h-12 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                        <span className="text-[10px] text-muted">{teamBBans.length + 1}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right - Hero Grid (now has more space) */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Hero Bans</CardTitle>
              <div className="flex items-center gap-2">
                {isCaptain && myTeamId && getTeamTotalBans(myTeamId) >= 2 && (
                  <Badge variant="success">Your bans complete</Badge>
                )}
                {isCaptain && isMyTurn && myTeamId && getTeamTotalBans(myTeamId) < 2 && (
                  <Badge variant="warning" className="animate-pulse">Your Turn to Ban</Badge>
                )}
                {isManager && (
                  <Button size="sm" variant="secondary" onClick={onEndMap} disabled={actionLoading}>
                    End Map (Skip)
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Role Tabs */}
            <div className="flex gap-2 mb-6">
              {(["ALL", "TANK", "DPS", "SUPPORT"] as const).map((role) => (
                <Button
                  key={role}
                  variant={selectedRole === role ? "default" : "ghost"}
                  onClick={() => setSelectedRole(role)}
                  className="flex-1"
                  size="sm"
                >
                  {role === "ALL" ? "All" : role}
                  {isCaptain && isMyTurn && role !== "ALL" && !canBanRole(role) && (
                    <span className="ml-1.5 text-[10px] opacity-60">(Max)</span>
                  )}
                </Button>
              ))}
            </div>

            {isCaptain && myTeamId && getTeamTotalBans(myTeamId) >= 2 && (
              <div className="mb-4 p-3 rounded-lg bg-success/10 border border-success/30 text-center">
                <p className="text-sm text-success font-medium">Your team has completed both bans. Waiting for other team...</p>
              </div>
            )}
            
            {isCaptain && !isMyTurn && myTeamId && getTeamTotalBans(myTeamId) < 2 && (
              <div className="mb-4 p-3 rounded-lg bg-surface-elevated text-center">
                <p className="text-sm text-muted">Waiting for {currentTeam?.name} to ban...</p>
              </div>
            )}

            {/* Render heroes by role when ALL is selected */}
            {selectedRole === "ALL" ? (
              <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
                {renderHeroSection("Tank", tankHeroes, "bg-yellow-500")}
                {renderHeroSection("DPS", dpsHeroes, "bg-red-500")}
                {renderHeroSection("Support", supportHeroes, "bg-green-500")}
              </div>
            ) : (
              <div className="grid grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                {heroes.filter((h) => h.role === selectedRole).map((hero) => {
                  const banned = isHeroBanned(hero.id);
                  const canSelect = isCaptain && isMyTurn && !banned && canBanRole(hero.role);
                  return renderHeroCard(hero, canSelect, banned);
                })}
              </div>
            )}

            {/* Skip Ban Button - only show if team hasn't completed bans */}
            {isCaptain && isMyTurn && myTeamId && getTeamTotalBans(myTeamId) < 2 && (
              <div className="mt-6 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onBanHero(null)}
                  disabled={actionLoading}
                >
                  Skip Ban (No Hero)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
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
    <div className="space-y-6">
      {/* Current Map Display */}
      {currentMap && (
        <div className="text-center">
          <div className="inline-flex items-center gap-4 bg-surface border border-border rounded-lg px-6 py-3">
            <span className="text-sm text-muted uppercase tracking-wide">Game {currentGameNumber} Map</span>
            <span className="text-xl font-bold text-foreground">{currentMap.description}</span>
            <Badge variant="primary">{currentMap.type}</Badge>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
        {/* Left - Teams Info with Bans */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Teams</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Team A */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[color:var(--color-team-a)]" />
                  <span className="font-semibold text-foreground">{teamA?.name}</span>
                </div>
                <span className="text-2xl font-bold text-[color:var(--color-team-a)]">{teamAWins}</span>
              </div>
              <p className="text-xs text-muted mb-2">Banned Heroes:</p>
              <div className="flex gap-2">
                {teamABans.length === 0 ? (
                  <span className="text-xs text-muted">No bans</span>
                ) : (
                  teamABans.map((heroId, idx) => renderBannedHeroEndMap(heroId, idx))
                )}
              </div>
              {isManager && (
                <div className="flex items-center gap-2 mt-2">
                  <div className={clsx("w-2 h-2 rounded-full", draftState.match.teamAready ? "bg-success" : "bg-muted")} />
                  <span className="text-xs text-muted">{draftState.match.teamAready ? "Ready" : "Not Ready"}</span>
                </div>
              )}
            </div>

            <div className="border-t border-border my-4" />

            {/* Team B */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[color:var(--color-team-b)]" />
                  <span className="font-semibold text-foreground">{teamB?.name}</span>
                </div>
                <span className="text-2xl font-bold text-[color:var(--color-team-b)]">{teamBWins}</span>
              </div>
              <p className="text-xs text-muted mb-2">Banned Heroes:</p>
              <div className="flex gap-2">
                {teamBBans.length === 0 ? (
                  <span className="text-xs text-muted">No bans</span>
                ) : (
                  teamBBans.map((heroId, idx) => renderBannedHeroEndMap(heroId, idx))
                )}
              </div>
              {isManager && (
                <div className="flex items-center gap-2 mt-2">
                  <div className={clsx("w-2 h-2 rounded-full", draftState.match.teamBready ? "bg-success" : "bg-muted")} />
                  <span className="text-xs text-muted">{draftState.match.teamBready ? "Ready" : "Not Ready"}</span>
                </div>
              )}
            </div>

            <div className="border-t border-border my-4" />

            <p className="text-xs text-muted text-center">
              First to {winsNeeded} wins | Best of {draftState.match.bestOf}
            </p>
          </CardContent>
        </Card>

        {/* Right - Result Registration / Captain Ready */}
        <Card className="border-border">
          <CardContent className="p-6">
            {/* Manager: Register Match Result Form */}
            {isManager && !resultRegistered && !matchIsFinished && (
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2 text-center">
                  Register Game {currentGameNumber} Result
                </h3>
                <p className="text-sm text-muted text-center mb-6">
                  Select the winner of {currentMap?.description || "this map"}
                </p>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => onSubmitResult(teamA?.id || 0)}
                    disabled={actionLoading}
                    className="flex flex-col items-center gap-2 h-auto py-6 border-2 border-[color:var(--color-team-a)] hover:bg-[color:var(--color-team-a)]/10"
                  >
                    <span className="text-2xl font-bold text-[color:var(--color-team-a)]">{teamA?.name}</span>
                    <span className="text-sm text-muted">Won</span>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => onSubmitResult(null)}
                    disabled={actionLoading}
                    className="flex flex-col items-center gap-2 h-auto py-6 border-2"
                  >
                    <span className="text-2xl font-bold text-muted">Draw</span>
                    <span className="text-sm text-muted">Tie Game</span>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => onSubmitResult(teamB?.id || 0)}
                    disabled={actionLoading}
                    className="flex flex-col items-center gap-2 h-auto py-6 border-2 border-[color:var(--color-team-b)] hover:bg-[color:var(--color-team-b)]/10"
                  >
                    <span className="text-2xl font-bold text-[color:var(--color-team-b)]">{teamB?.name}</span>
                    <span className="text-sm text-muted">Won</span>
                  </Button>
                </div>
                {actionLoading && (
                  <p className="text-sm text-muted text-center">Submitting result...</p>
                )}
              </div>
            )}

            {/* Manager: Result registered, wait for captains */}
            {isManager && resultRegistered && !matchIsFinished && (
              <div className="text-center">
                <Badge variant="success" className="mb-4">Game {currentGameNumber} Result Registered</Badge>
                <p className="text-sm text-muted mb-6">
                  Waiting for both captains to be ready for the next map.
                </p>
                <Button 
                  size="lg" 
                  onClick={onStartMapPicking} 
                  disabled={actionLoading || !bothReady}
                  className="px-8"
                >
                  {actionLoading ? "Starting..." : "Start Next Map"}
                </Button>
                {!bothReady && (
                  <p className="text-xs text-muted mt-2">Both captains must be ready</p>
                )}
              </div>
            )}

            {/* Captain: Ready button */}
            {isCaptain && !matchIsFinished && (
              <div className="text-center">
                <h3 className="text-xl font-bold text-foreground mb-4">
                  {resultRegistered ? "Get Ready for Next Map" : "Waiting for Results"}
                </h3>
                {currentMap && (
                  <p className="text-sm text-muted mb-6">
                    After you finish playing on <span className="font-semibold text-foreground">{currentMap.description}</span>, 
                    press the button below to tell the manager you are ready to continue!
                  </p>
                )}
                {!amIReady ? (
                  <Button 
                    size="lg" 
                    onClick={onSetReady} 
                    disabled={actionLoading}
                    className="px-8"
                  >
                    {actionLoading ? "Setting ready..." : "I'm Ready for Next Map!"}
                  </Button>
                ) : (
                  <div>
                    <Badge variant="success" className="text-sm px-4 py-2">You are ready</Badge>
                    <p className="text-xs text-muted mt-2">
                      Waiting for {resultRegistered ? "the other captain and manager..." : "manager to register results..."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Match finished */}
            {matchIsFinished && (
              <div className="text-center py-8">
                <Badge variant="success" className="mb-4">Match Complete</Badge>
                <p className="text-3xl font-bold text-primary">
                  {teamAWins > teamBWins ? teamA?.name : teamB?.name} Wins!
                </p>
                <p className="text-muted mt-2">
                  Final Score: {teamAWins} - {teamBWins}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
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
  const winner = teamAWins > teamBWins ? teamA : teamB;

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <Card className="w-full max-w-lg">
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
    <Card className="mt-8">
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
