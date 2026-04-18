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

const POLL_INTERVAL = 3000; // 3 seconds
const TURN_DURATION = 75; // 1 minute 15 seconds

type Phase = "STARTING" | "MAPPICKING" | "BAN" | "ENDMAP" | "FINISHED";

export default function DraftTablePage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated } = useSession();
  
  const matchId = Number(params.matchId);
  
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const draftId = draftState?.id; // Get draftId from the loaded draft state
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TURN_DURATION);
  
  // For hero ban selection
  const [selectedRole, setSelectedRole] = useState<"TANK" | "DPS" | "SUPPORT">("TANK");
  
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Determine user role in this draft
  const isManager = user?.role === "MANAGER";
  const isCaptain = user?.role === "CAPTAIN";
  const myTeamId = user?.teamId;
  
  const isMyTurn = draftState?.currentTurnTeamId === myTeamId;
  const currentPhase = draftState?.phase as Phase;

  // Get team info
  const teamA = teams.find((t) => t.id === draftState?.match?.teamAId);
  const teamB = teams.find((t) => t.id === draftState?.match?.teamBId);
  const myTeam = teams.find((t) => t.id === myTeamId);
  const opponentTeam = myTeamId === teamA?.id ? teamB : teamA;

  // Load initial data
  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      loadData();
    }
  }, [isHydrated, isAuthenticated, matchId]);

  // Setup polling
  useEffect(() => {
    if (!draftState || currentPhase === "FINISHED") return;

    pollRef.current = setInterval(() => {
      fetchDraftState();
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [draftState, currentPhase]);

  // Timer countdown
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

  // Manager actions
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

  // Captain actions
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

  // Get banned heroes by team for current game
  const getBannedHeroesByTeam = (teamId: number) => {
    if (!draftState?.actions) return [];
    return draftState.actions
      .filter((a) => a.teamId === teamId && a.action === "BAN" && a.gameNumber === draftState.match.gameNumber)
      .map((a) => a.value)
      .filter((v): v is number => v !== null);
  };

  // Check if hero is banned
  const isHeroBanned = (heroId: number) => {
    return draftState?.bannedHeroes?.includes(heroId) || false;
  };

  // Check if map is picked
  const isMapPicked = (mapId: number) => {
    return draftState?.pickedMaps?.includes(mapId) || false;
  };

  // Get ban count by role for current game and team
  const getBanCountByRole = (teamId: number, role: "TANK" | "DPS" | "SUPPORT") => {
    if (!draftState?.actions || !draftState?.heroes) return 0;
    const heroesOfRole = draftState.heroes.filter((h) => h.role === role).map((h) => h.id);
    return draftState.actions
      .filter(
        (a) =>
          a.teamId === teamId &&
          a.action === "BAN" &&
          a.gameNumber === draftState.match.gameNumber &&
          a.value !== null &&
          heroesOfRole.includes(a.value)
      ).length;
  };

  // Check if can ban this role (max 2 per role per game)
  const canBanRole = (role: "TANK" | "DPS" | "SUPPORT") => {
    if (!myTeamId) return false;
    return getBanCountByRole(myTeamId, role) < 2;
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isHydrated || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted">Loading draft table...</div>
      </div>
    );
  }

  if (error || !draftState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-danger mb-4">{error || "Draft not found"}</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background py-4 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Draft Table</h1>
              <p className="text-muted">
                {teamA?.name} vs {teamB?.name} | Game {draftState.match.gameNumber}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge
                variant={
                  currentPhase === "STARTING"
                    ? "default"
                    : currentPhase === "FINISHED"
                    ? "success"
                    : "warning"
                }
                className="text-lg px-4 py-2"
              >
                {currentPhase}
              </Badge>
              {(currentPhase === "MAPPICKING" || currentPhase === "BAN") && (
                <div
                  className={clsx(
                    "text-3xl font-mono font-bold",
                    timeLeft <= 15 ? "text-danger animate-pulse" : "text-foreground"
                  )}
                >
                  {formatTime(timeLeft)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Score Display */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{teamA?.name}</p>
                <p className="text-5xl font-bold text-primary">{draftState.match.mapWinsTeamA}</p>
              </div>
              <div className="text-4xl text-muted">vs</div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{teamB?.name}</p>
                <p className="text-5xl font-bold text-accent">{draftState.match.mapWinsTeamB}</p>
              </div>
            </div>
            {draftState.currentMapId && draftState.allMaps && (
              <div className="mt-4 text-center">
                <p className="text-sm text-muted">Current Map</p>
                <p className="text-xl font-semibold text-foreground">
                  {draftState.allMaps.find((m) => m.id === draftState.currentMapId)?.description || "Unknown"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Phase-specific content */}
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

        {/* Draft History */}
        <DraftHistory draftState={draftState} teams={teams} />
      </div>
    </main>
  );
}

// ==================== PHASE COMPONENTS ====================

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
    <Card>
      <CardHeader>
        <CardTitle>Waiting to Start</CardTitle>
      </CardHeader>
      <CardContent className="text-center py-12">
        <div className="flex items-center justify-center gap-8 mb-8">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-surface mx-auto mb-2 flex items-center justify-center">
              <span className="text-3xl font-bold text-primary">
                {teamA?.name?.charAt(0) || "A"}
              </span>
            </div>
            <p className="font-semibold text-foreground">{teamA?.name}</p>
            <Badge variant={match.teamAready ? "success" : "warning"}>
              {match.teamAready ? "Ready" : "Not Ready"}
            </Badge>
          </div>
          <div className="text-4xl text-muted">vs</div>
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-surface mx-auto mb-2 flex items-center justify-center">
              <span className="text-3xl font-bold text-accent">
                {teamB?.name?.charAt(0) || "B"}
              </span>
            </div>
            <p className="font-semibold text-foreground">{teamB?.name}</p>
            <Badge variant={match.teamBready ? "success" : "warning"}>
              {match.teamBready ? "Ready" : "Not Ready"}
            </Badge>
          </div>
        </div>

        {isManager && (
          <div>
            <p className="text-muted mb-4">
              Waiting for both captains to be ready. Once ready, start the map picking phase.
            </p>
            <Button
              size="lg"
              onClick={onStart}
              disabled={actionLoading}
            >
              {actionLoading ? "Starting..." : "Start Map Picking"}
            </Button>
          </div>
        )}

        {isCaptain && (
          <p className="text-muted">
            Waiting for the manager to start the draft...
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MapPickingPhase({
  isManager,
  isCaptain,
  isMyTurn,
  draftState,
  teams,
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
  onPickMap: (mapId: number) => void;
  onStartBan: () => void;
  isMapPicked: (mapId: number) => boolean;
  actionLoading: boolean;
}) {
  const currentTeam = teams.find((t) => t.id === draftState.currentTurnTeamId);
  const availableMaps = draftState.availableMaps || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Map Picking</span>
          {currentTeam && (
            <Badge variant="warning">{currentTeam.name}&apos;s Turn</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isManager && (
          <div className="mb-6 p-4 bg-surface rounded-lg">
            <p className="text-muted mb-2">Manager View: Wait for captain to pick a map, then start ban phase.</p>
            <Button onClick={onStartBan} disabled={actionLoading || !draftState.currentMapId}>
              {actionLoading ? "Starting..." : "Start Ban Phase"}
            </Button>
          </div>
        )}

        {isCaptain && isMyTurn && (
          <div className="mb-6 p-4 bg-accent/10 border border-accent rounded-lg">
            <p className="text-accent font-semibold">Your turn! Select a map for this game.</p>
          </div>
        )}

        {isCaptain && !isMyTurn && (
          <div className="mb-6 p-4 bg-surface rounded-lg">
            <p className="text-muted">Waiting for opponent to pick a map...</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {availableMaps.map((map) => {
            const picked = isMapPicked(map.id);
            const isCurrentMap = map.id === draftState.currentMapId;

            return (
              <button
                key={map.id}
                onClick={() => !picked && isCaptain && isMyTurn && onPickMap(map.id)}
                disabled={picked || !isCaptain || !isMyTurn || actionLoading}
                className={clsx(
                  "relative rounded-lg overflow-hidden border-2 transition-all",
                  picked
                    ? "border-muted opacity-50 grayscale cursor-not-allowed"
                    : isCurrentMap
                    ? "border-accent ring-2 ring-accent"
                    : isCaptain && isMyTurn
                    ? "border-border hover:border-primary cursor-pointer"
                    : "border-border cursor-default"
                )}
              >
                <div className="aspect-video bg-surface flex items-center justify-center">
                  {map.imgPath ? (
                    <img
                      src={map.imgPath}
                      alt={map.description}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-muted">
                      {map.description.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="p-2 bg-background">
                  <p className="text-sm font-medium text-foreground truncate">
                    {map.description}
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    {map.type}
                  </Badge>
                </div>
                {picked && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <span className="text-muted font-semibold">Picked</span>
                  </div>
                )}
                {isCurrentMap && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="success">Selected</Badge>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

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

  return (
    <div className="space-y-6">
      {/* Current Map Display */}
      {currentMap && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-4">
              <span className="text-muted">Current Map:</span>
              <span className="text-xl font-bold text-foreground">{currentMap.description}</span>
              <Badge variant="secondary">{currentMap.type}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ban Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Team A Bans */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{teamA?.name} Bans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {teamABans.length === 0 ? (
                <span className="text-muted text-sm">No bans yet</span>
              ) : (
                teamABans.map((heroId) => {
                  const hero = heroes.find((h) => h.id === heroId);
                  return (
                    <div
                      key={heroId}
                      className="w-12 h-12 rounded-lg bg-danger/20 border border-danger flex items-center justify-center"
                    >
                      {hero?.imgPath ? (
                        <img src={hero.imgPath} alt="" className="w-10 h-10 rounded" />
                      ) : (
                        <span className="text-xs text-danger">#{heroId}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current Turn */}
        <Card className="border-accent">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-center">Current Turn</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-2xl font-bold text-accent">{currentTeam?.name}</p>
            {isManager && (
              <Button className="mt-4" onClick={onEndMap} disabled={actionLoading}>
                End Map (Skip to next)
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Team B Bans */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{teamB?.name} Bans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {teamBBans.length === 0 ? (
                <span className="text-muted text-sm">No bans yet</span>
              ) : (
                teamBBans.map((heroId) => {
                  const hero = heroes.find((h) => h.id === heroId);
                  return (
                    <div
                      key={heroId}
                      className="w-12 h-12 rounded-lg bg-danger/20 border border-danger flex items-center justify-center"
                    >
                      {hero?.imgPath ? (
                        <img src={hero.imgPath} alt="" className="w-10 h-10 rounded" />
                      ) : (
                        <span className="text-xs text-danger">#{heroId}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hero Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Hero Bans</span>
            {isCaptain && isMyTurn && (
              <Badge variant="warning">Your Turn to Ban!</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Role Tabs */}
          <div className="flex gap-2 mb-6">
            {(["TANK", "DPS", "SUPPORT"] as const).map((role) => (
              <Button
                key={role}
                variant={selectedRole === role ? "default" : "secondary"}
                onClick={() => setSelectedRole(role)}
                className="flex-1"
              >
                {role}
                {isCaptain && isMyTurn && !canBanRole(role) && (
                  <span className="ml-2 text-xs opacity-60">(Max)</span>
                )}
              </Button>
            ))}
          </div>

          {/* Hero Grid */}
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
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
                      ? "border-danger/50 grayscale opacity-50 cursor-not-allowed"
                      : canSelect
                      ? "border-border hover:border-primary cursor-pointer hover:scale-105"
                      : "border-border cursor-default opacity-70"
                  )}
                >
                  {hero.imgPath ? (
                    <img
                      src={hero.imgPath}
                      alt={`Hero ${hero.id}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface flex items-center justify-center">
                      <span className="text-sm font-bold text-muted">
                        {hero.role.charAt(0)}{hero.id}
                      </span>
                    </div>
                  )}
                  {banned && (
                    <div className="absolute inset-0 bg-danger/40 flex items-center justify-center">
                      <span className="text-white font-bold text-xs">BANNED</span>
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
                onClick={() => onBanHero(null)}
                disabled={actionLoading}
              >
                Skip Ban (No Hero Banned)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
    <Card>
      <CardHeader>
        <CardTitle>Game {draftState.match.gameNumber} Complete</CardTitle>
      </CardHeader>
      <CardContent className="text-center py-8">
        <div className="flex items-center justify-center gap-8 mb-8">
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">{teamA?.name}</p>
            <p className="text-5xl font-bold text-primary">{teamAWins}</p>
          </div>
          <div className="text-4xl text-muted">-</div>
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">{teamB?.name}</p>
            <p className="text-5xl font-bold text-accent">{teamBWins}</p>
          </div>
        </div>

        <p className="text-muted mb-6">
          First to {winsNeeded} wins. Current: {teamAWins} - {teamBWins}
        </p>

        {isManager && (
          <Button size="lg" onClick={onStartMapPicking} disabled={actionLoading}>
            {actionLoading ? "Starting..." : "Start Next Map Picking"}
          </Button>
        )}

        {!isManager && (
          <p className="text-muted">Waiting for manager to start next map...</p>
        )}
      </CardContent>
    </Card>
  );
}

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
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Match Complete</CardTitle>
      </CardHeader>
      <CardContent className="text-center py-12">
        <div className="mb-8">
          <p className="text-muted mb-2">Winner</p>
          <p className="text-4xl font-bold text-accent">{winner?.name}</p>
        </div>

        <div className="flex items-center justify-center gap-8 mb-8">
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">{teamA?.name}</p>
            <p className="text-5xl font-bold text-primary">{teamAWins}</p>
          </div>
          <div className="text-4xl text-muted">-</div>
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">{teamB?.name}</p>
            <p className="text-5xl font-bold text-accent">{teamBWins}</p>
          </div>
        </div>

        <Badge variant="success" className="text-lg px-6 py-2">
          FINISHED
        </Badge>
      </CardContent>
    </Card>
  );
}

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
      return hero ? `Banned ${hero.role} Hero #${action.value}` : `Banned Hero #${action.value}`;
    }
    return action.action;
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Draft History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {actions.map((action, index) => (
            <div
              key={action.id || index}
              className="flex items-center justify-between p-2 bg-surface rounded text-sm"
            >
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  G{action.gameNumber}
                </Badge>
                <span className="font-medium text-foreground">
                  {getTeamName(action.teamId)}
                </span>
              </div>
              <span className="text-muted">{getActionDisplay(action)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
