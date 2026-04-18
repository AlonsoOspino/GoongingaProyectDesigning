"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { getTeams, type Team } from "@/lib/api";
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
  const [selectedRole, setSelectedRole] = useState<"TANK" | "DPS" | "SUPPORT">("TANK");

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

  // Show draft history only when match is PENDINGRESULT or FINISHED
  const showDraftHistory = matchStatus === "PENDINGREGISTERS" || matchStatus === "FINISHED" || currentPhase === "FINISHED";

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
    if (!draftState?.phaseStartedAt || currentPhase === "STARTING" || currentPhase === "ENDMAP" || currentPhase === "FINISHED") {
      setTimeLeft(TURN_DURATION);
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
      const updated = await pickMap(token, draftId, { mapId, teamId: myTeamId });
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
      const updated = await banHero(token, draftId, { heroId, teamId: myTeamId });
      setDraftState(updated);
    } catch (err) {
      console.error("Failed to ban hero:", err);
    } finally {
      setActionLoading(false);
    }
  }

  const getBannedHeroesByTeam = (teamId: number) => {
    if (!draftState?.actions) return [];
    return draftState.actions
      .filter((a) => a.teamId === teamId && a.action === "BAN" && a.gameNumber === draftState.match.gameNumber)
      .map((a) => a.value)
      .filter((v): v is number => v !== null);
  };

  const isHeroBanned = (heroId: number) => {
    return draftState?.bannedHeroes?.includes(heroId) || false;
  };

  const isMapPicked = (mapId: number) => {
    return draftState?.pickedMaps?.includes(mapId) || false;
  };

  const getBanCountByRole = (teamId: number, role: "TANK" | "DPS" | "SUPPORT") => {
    if (!draftState?.actions || !draftState?.heroes) return 0;
    const heroesOfRole = draftState.heroes.filter((h) => h.role === role).map((h) => h.id);
    return draftState.actions.filter(
      (a) =>
        a.teamId === teamId &&
        a.action === "BAN" &&
        a.gameNumber === draftState.match.gameNumber &&
        a.value !== null &&
        heroesOfRole.includes(a.value)
    ).length;
  };

  const canBanRole = (role: "TANK" | "DPS" | "SUPPORT") => {
    if (!myTeamId) return false;
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
                Game {draftState.match.gameNumber}
              </Badge>
            </div>
            <div className="flex items-center gap-4">
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
              {(currentPhase === "MAPPICKING" || currentPhase === "BAN") && (
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

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Phase Content */}
        {currentPhase === "STARTING" && (
          <StartingPhase
            isManager={isManager}
            isCaptain={isCaptain}
            teamA={teamA}
            teamB={teamB}
            match={draftState.match}
            onStart={handleStartMapPicking}
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
            myTeamId={myTeamId}
            selectedRole={selectedRole}
            setSelectedRole={setSelectedRole}
            onBanHero={handleBanHero}
            onEndMap={handleEndMap}
            isHeroBanned={isHeroBanned}
            getBannedHeroesByTeam={getBannedHeroesByTeam}
            canBanRole={canBanRole}
            actionLoading={actionLoading}
          />
        )}

        {currentPhase === "ENDMAP" && (
          <EndMapPhase
            isManager={isManager}
            draftState={draftState}
            teams={teams}
            onStartMapPicking={handleStartMapPicking}
            actionLoading={actionLoading}
          />
        )}

        {currentPhase === "FINISHED" && (
          <FinishedPhase draftState={draftState} teams={teams} />
        )}

        {/* Draft History - Only shown after PENDINGRESULT/FINISHED */}
        {showDraftHistory && <DraftHistory draftState={draftState} teams={teams} />}
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
  onStart,
  actionLoading,
}: {
  isManager: boolean;
  isCaptain: boolean;
  teamA?: Team;
  teamB?: Team;
  match: DraftState["match"];
  onStart: () => void;
  actionLoading: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-2xl">
        <CardContent className="p-8">
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">Waiting to Start</h2>
          
          <div className="flex items-center justify-center gap-12 mb-8">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-[color:var(--color-team-a)]/20 border-2 border-[color:var(--color-team-a)] mx-auto mb-3 flex items-center justify-center">
                <span className="text-2xl font-bold text-[color:var(--color-team-a)]">
                  {teamA?.name?.charAt(0) || "A"}
                </span>
              </div>
              <p className="font-semibold text-foreground mb-2">{teamA?.name}</p>
              {/* Ready badges only visible to manager */}
              {isManager && (
                <Badge variant={match.teamAready ? "success" : "default"}>
                  {match.teamAready ? "Ready" : "Not Ready"}
                </Badge>
              )}
            </div>

            <div className="text-4xl font-bold text-muted">VS</div>

            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-[color:var(--color-team-b)]/20 border-2 border-[color:var(--color-team-b)] mx-auto mb-3 flex items-center justify-center">
                <span className="text-2xl font-bold text-[color:var(--color-team-b)]">
                  {teamB?.name?.charAt(0) || "B"}
                </span>
              </div>
              <p className="font-semibold text-foreground mb-2">{teamB?.name}</p>
              {isManager && (
                <Badge variant={match.teamBready ? "success" : "default"}>
                  {match.teamBready ? "Ready" : "Not Ready"}
                </Badge>
              )}
            </div>
          </div>

          {isManager && (
            <div className="text-center">
              <p className="text-muted mb-4 text-sm">
                Waiting for both captains to be ready. Start when ready.
              </p>
              <Button size="lg" onClick={onStart} disabled={actionLoading} className="px-8">
                {actionLoading ? "Starting..." : "Start Map Picking"}
              </Button>
            </div>
          )}

          {isCaptain && (
            <p className="text-center text-muted">
              Waiting for the manager to start the draft...
            </p>
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
  
  // Get all picked maps for this match (show as banned/grayed)
  const pickedMaps = draftState.pickedMaps || [];
  
  // Get team-specific picks for display in ban columns
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

      {/* Three Column Layout - Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_200px] gap-6">
        {/* Left - Team A Picked Maps */}
        <div className={clsx(
          "rounded-lg border p-4 transition-all",
          isTeamATurn ? "border-[color:var(--color-team-a)] bg-[color:var(--color-team-a)]/5" : "border-border bg-surface"
        )}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-[color:var(--color-team-a)]" />
            <h3 className="font-semibold text-foreground">{teamA?.name}</h3>
            {isTeamATurn && <Badge variant="primary" className="ml-auto text-xs">Turn</Badge>}
          </div>
          <div className="space-y-2">
            {teamAMaps.length === 0 ? (
              <p className="text-xs text-muted">No maps picked</p>
            ) : (
              teamAMaps.map((map) => (
                <div key={map!.id} className="flex items-center gap-2 p-2 rounded bg-surface-elevated">
                  <div className="w-10 h-6 rounded overflow-hidden bg-background">
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

        {/* Middle - Map Grid */}
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

            <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
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

        {/* Right - Team B Picked Maps */}
        <div className={clsx(
          "rounded-lg border p-4 transition-all",
          isTeamBTurn ? "border-[color:var(--color-team-b)] bg-[color:var(--color-team-b)]/5" : "border-border bg-surface"
        )}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-[color:var(--color-team-b)]" />
            <h3 className="font-semibold text-foreground">{teamB?.name}</h3>
            {isTeamBTurn && <Badge variant="primary" className="ml-auto text-xs">Turn</Badge>}
          </div>
          <div className="space-y-2">
            {teamBMaps.length === 0 ? (
              <p className="text-xs text-muted">No maps picked</p>
            ) : (
              teamBMaps.map((map) => (
                <div key={map!.id} className="flex items-center gap-2 p-2 rounded bg-surface-elevated">
                  <div className="w-10 h-6 rounded overflow-hidden bg-background">
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
      </div>

      {/* Manager Controls */}
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
  myTeamId,
  selectedRole,
  setSelectedRole,
  onBanHero,
  onEndMap,
  isHeroBanned,
  getBannedHeroesByTeam,
  canBanRole,
  actionLoading,
}: {
  isManager: boolean;
  isCaptain: boolean;
  isMyTurn: boolean;
  draftState: DraftState;
  teams: Team[];
  myTeamId?: number | null;
  selectedRole: "TANK" | "DPS" | "SUPPORT";
  setSelectedRole: (role: "TANK" | "DPS" | "SUPPORT") => void;
  onBanHero: (heroId: number | null) => void;
  onEndMap: () => void;
  isHeroBanned: (heroId: number) => boolean;
  getBannedHeroesByTeam: (teamId: number) => number[];
  canBanRole: (role: "TANK" | "DPS" | "SUPPORT") => boolean;
  actionLoading: boolean;
}) {
  const currentTeam = teams.find((t) => t.id === draftState.currentTurnTeamId);
  const teamA = teams.find((t) => t.id === draftState.match.teamAId);
  const teamB = teams.find((t) => t.id === draftState.match.teamBId);
  const heroes = draftState.heroes || [];
  const currentMap = draftState.allMaps?.find((m) => m.id === draftState.currentMapId);

  const teamABans = teamA ? getBannedHeroesByTeam(teamA.id) : [];
  const teamBBans = teamB ? getBannedHeroesByTeam(teamB.id) : [];

  const roleHeroes = heroes.filter((h) => h.role === selectedRole);

  const isTeamATurn = draftState.currentTurnTeamId === teamA?.id;
  const isTeamBTurn = draftState.currentTurnTeamId === teamB?.id;

  const renderBannedHero = (heroId: number) => {
    const hero = heroes.find((h) => h.id === heroId);
    return (
      <div
        key={heroId}
        className="w-14 h-14 rounded-lg bg-danger/20 border border-danger/50 flex items-center justify-center overflow-hidden"
      >
        {hero?.imgPath ? (
          <img src={resolveHeroImageUrl(hero.imgPath)} alt="" className="w-full h-full object-cover grayscale" />
        ) : (
          <span className="text-xs text-danger font-bold">#{heroId}</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
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

      {/* Three Column Layout - Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_200px] gap-6">
        {/* Left - Team A Bans */}
        <div className={clsx(
          "rounded-lg border p-4 transition-all",
          isTeamATurn ? "border-[color:var(--color-team-a)] bg-[color:var(--color-team-a)]/5 animate-turn-glow" : "border-border bg-surface"
        )}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-[color:var(--color-team-a)]" />
            <h3 className="font-semibold text-foreground">{teamA?.name}</h3>
            {isTeamATurn && <Badge variant="danger" className="ml-auto text-xs">Banning</Badge>}
          </div>
          <p className="text-xs text-muted mb-3 uppercase tracking-wide">Banned Heroes</p>
          <div className="flex flex-wrap gap-2">
            {teamABans.length === 0 ? (
              <>
                <div className="w-14 h-14 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                  <span className="text-xs text-muted">1</span>
                </div>
                <div className="w-14 h-14 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                  <span className="text-xs text-muted">2</span>
                </div>
              </>
            ) : (
              <>
                {teamABans.map(renderBannedHero)}
                {teamABans.length < 2 && (
                  <div className="w-14 h-14 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                    <span className="text-xs text-muted">{teamABans.length + 1}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Middle - Hero Grid */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Hero Bans</CardTitle>
              {isCaptain && isMyTurn && (
                <Badge variant="warning" className="animate-pulse">Your Turn to Ban</Badge>
              )}
              {isManager && (
                <Button size="sm" variant="secondary" onClick={onEndMap} disabled={actionLoading}>
                  End Map (Skip)
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Role Tabs */}
            <div className="flex gap-2 mb-6">
              {(["TANK", "DPS", "SUPPORT"] as const).map((role) => (
                <Button
                  key={role}
                  variant={selectedRole === role ? "default" : "ghost"}
                  onClick={() => setSelectedRole(role)}
                  className="flex-1"
                  size="sm"
                >
                  {role}
                  {isCaptain && isMyTurn && !canBanRole(role) && (
                    <span className="ml-1.5 text-[10px] opacity-60">(Max)</span>
                  )}
                </Button>
              ))}
            </div>

            {isCaptain && !isMyTurn && (
              <div className="mb-4 p-3 rounded-lg bg-surface-elevated text-center">
                <p className="text-sm text-muted">Waiting for {currentTeam?.name} to ban...</p>
              </div>
            )}

            {/* Hero Grid */}
            <div className="grid grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-2">
              {roleHeroes.map((hero) => {
                const banned = isHeroBanned(hero.id);
                const canSelect = isCaptain && isMyTurn && !banned && canBanRole(hero.role);

                return (
                  <button
                    key={hero.id}
                    onClick={() => canSelect && onBanHero(hero.id)}
                    disabled={!canSelect || actionLoading}
                    className={clsx(
                      "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                      banned
                        ? "border-danger/50 opacity-50 cursor-not-allowed"
                        : canSelect
                        ? "border-border hover:border-danger cursor-pointer hover:scale-105"
                        : "border-border cursor-default opacity-60"
                    )}
                  >
                    {hero.imgPath ? (
                      <img
                        src={resolveHeroImageUrl(hero.imgPath)}
                        alt={`Hero ${hero.id}`}
                        className={clsx("w-full h-full object-cover", banned && "grayscale")}
                      />
                    ) : (
                      <div className="w-full h-full bg-surface flex items-center justify-center">
                        <span className="text-xs font-bold text-muted">
                          {hero.role.charAt(0)}{hero.id}
                        </span>
                      </div>
                    )}
                    {banned && (
                      <div className="absolute inset-0 bg-danger/50 flex items-center justify-center animate-banned">
                        <span className="text-white font-bold text-[10px] uppercase">Banned</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Skip Ban Button */}
            {isCaptain && isMyTurn && (
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

        {/* Right - Team B Bans */}
        <div className={clsx(
          "rounded-lg border p-4 transition-all",
          isTeamBTurn ? "border-[color:var(--color-team-b)] bg-[color:var(--color-team-b)]/5 animate-turn-glow" : "border-border bg-surface"
        )}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-[color:var(--color-team-b)]" />
            <h3 className="font-semibold text-foreground">{teamB?.name}</h3>
            {isTeamBTurn && <Badge variant="danger" className="ml-auto text-xs">Banning</Badge>}
          </div>
          <p className="text-xs text-muted mb-3 uppercase tracking-wide">Banned Heroes</p>
          <div className="flex flex-wrap gap-2">
            {teamBBans.length === 0 ? (
              <>
                <div className="w-14 h-14 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                  <span className="text-xs text-muted">1</span>
                </div>
                <div className="w-14 h-14 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                  <span className="text-xs text-muted">2</span>
                </div>
              </>
            ) : (
              <>
                {teamBBans.map(renderBannedHero)}
                {teamBBans.length < 2 && (
                  <div className="w-14 h-14 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                    <span className="text-xs text-muted">{teamBBans.length + 1}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== END MAP PHASE ====================

function EndMapPhase({
  isManager,
  draftState,
  teams,
  onStartMapPicking,
  actionLoading,
}: {
  isManager: boolean;
  draftState: DraftState;
  teams: Team[];
  onStartMapPicking: () => void;
  actionLoading: boolean;
}) {
  const winsNeeded = Math.ceil(draftState.match.bestOf / 2);
  const teamAWins = draftState.match.mapWinsTeamA;
  const teamBWins = draftState.match.mapWinsTeamB;
  const teamA = teams.find((t) => t.id === draftState.match.teamAId);
  const teamB = teams.find((t) => t.id === draftState.match.teamBId);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <Card className="w-full max-w-lg">
        <CardContent className="p-8 text-center">
          <h2 className="text-xl font-bold text-foreground mb-6">
            Game {draftState.match.gameNumber} Complete
          </h2>

          <div className="flex items-center justify-center gap-8 mb-6">
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

          <p className="text-sm text-muted mb-6">
            First to {winsNeeded} wins
          </p>

          {isManager && (
            <Button size="lg" onClick={onStartMapPicking} disabled={actionLoading}>
              {actionLoading ? "Starting..." : "Start Next Map"}
            </Button>
          )}

          {!isManager && (
            <p className="text-muted text-sm">Waiting for manager to start next map...</p>
          )}
        </CardContent>
      </Card>
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
}: {
  draftState: DraftState;
  teams: Team[];
}) {
  const actions = draftState.actions || [];
  const heroes = draftState.heroes || [];
  const maps = draftState.allMaps || [];

  if (actions.length === 0) return null;

  const getTeamName = (teamId: number) =>
    teams.find((t) => t.id === teamId)?.name || `Team ${teamId}`;

  const getActionDisplay = (action: DraftState["actions"][0]) => {
    if (action.action === "SKIP") {
      return "Skipped";
    }
    if (action.action === "PICK" && action.value) {
      const map = maps.find((m) => m.id === action.value);
      return map ? `Picked ${map.description}` : `Picked Map #${action.value}`;
    }
    if (action.action === "BAN" && action.value) {
      const hero = heroes.find((h) => h.id === action.value);
      return hero ? `Banned ${hero.role} Hero` : `Banned Hero #${action.value}`;
    }
    return action.action;
  };

  // Group by game
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
