"use client";

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/features/session/SessionProvider";
import { readNetworkSessionUser, type NetworkSessionUser } from "@/features/networkSession/storage";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  ApiError,
  getDraftByMatchId,
  getDraftState,
  getDraftShareInfo,
  startMapPicking,
  yieldPlayoffFirstPick,
  pickMap,
  startBan,
  banHero,
  endGame,
  type DraftState,
  type GameMap,
  type Hero,
} from "@/lib/api";
import {
  getTeams,
  submitMatchResult,
  undoMatchResult,
  resetManagerMatch,
  updateCaptainMatch,
  captainRequestPause,
  managerTogglePause,
  managerClearPauseRequest,
  type Team,
} from "@/lib/api";
import { clsx } from "clsx";
import { resolveGenericBackendAsset, resolveHeroImageUrl, resolveMapImageUrl } from "@/lib/assetUrls";
import { MapImage, MapBackground, useImageReady, preloadImages } from "@/components/draft/MapImage";
import waitingStyles from "@/components/draft/waiting-room.module.css";
import { isBracketMatch, getRequiredWins, getSeriesLength } from "@/lib/match-format";

const POLL_INTERVAL = 3000;
const TURN_DURATION = 95;
const KEY_CANVAS_WIDTH = 1920;
const KEY_CANVAS_HEIGHT = 1080;
const KEY_CONTENT_MAX_WIDTH = "max-w-[1840px]";

type Phase = "STARTING" | "MAPPICKING" | "BAN" | "PLAYING" | "ENDMAP" | "FINISHED";
type OverlayKind = "BAN" | "MAP_PICK" | "MAP_PICKING_COUNTDOWN" | "BAN_START_COUNTDOWN";

const SESSION_EXPIRED_MESSAGE =
  "Tu sesion expiro o quedo invalida en este navegador. Vuelve a iniciar sesion para continuar.";

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function isSessionFailure(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 401) return true;
  return error.status === 403 && /login token|invalid token|no token|token malformed/i.test(error.message);
}

type DraftOverlay = {
  id: string;
  kind: OverlayKind;
  title: string;
  subtitle?: string;
  team?: Team;
  hero?: Hero | null;
  map?: GameMap | null;
  durationMs: number;
  countdownFrom?: number;
};

export default function DraftTablePage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated, clearSession } = useSession();
  const searchParams = useSearchParams();
  const urlKey = searchParams?.get("key");

  const matchId = Number(params.matchId);
  const isObsKeyAccess = Boolean(urlKey);

  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const draftId = draftState?.id;
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TURN_DURATION);
  const [selectedRole, setSelectedRole] = useState<"ALL" | "TANK" | "DPS" | "SUPPORT">("ALL");
  const [banWarning, setBanWarning] = useState<string | null>(null);
  const [heroCacheById, setHeroCacheById] = useState<Record<number, Hero>>({});
  const [mapCacheById, setMapCacheById] = useState<Record<number, GameMap>>({});
  const [pauseActionPending, setPauseActionPending] = useState(false);
  const [isNavHidden, setIsNavHidden] = useState(false);
  const [overlayQueue, setOverlayQueue] = useState<DraftOverlay[]>([]);
  const [activeOverlay, setActiveOverlay] = useState<DraftOverlay | null>(null);
  const [overlayCountdown, setOverlayCountdown] = useState<number | null>(null);
  const [keyFitScale, setKeyFitScale] = useState(1);
  const [shareOverlayOpen, setShareOverlayOpen] = useState(false);
  const [shareInfo, setShareInfo] = useState<{ matchId: number; key: string; url: string } | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [networkUser, setNetworkUser] = useState<NetworkSessionUser | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const overlayCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const actionErrorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const seenActionIdsRef = useRef<Set<number>>(new Set());
  const hasInitializedActionsRef = useRef(false);
  const hasInitializedPhaseRef = useRef(false);
  const prevPhaseRef = useRef<Phase | null>(null);
  const overlayIdRef = useRef(0);

  useEffect(() => {
    const refresh = () => setNetworkUser(readNetworkSessionUser());
    refresh();
    window.addEventListener("network-session-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("network-session-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const isManager = Boolean(networkUser?.roles.some((role) => role === "SOCIAL_MEDIA" || role === "ADMIN"));
  const isAdmin = Boolean(networkUser?.roles.includes("ADMIN"));
  // Destructive operational actions (full match reset) are open to both roles.
  const canResetMatch = isManager || isAdmin;
  const isCaptain = user?.role === "CAPTAIN";
  const isKeyAccess = isObsKeyAccess;
  const shouldRenderCompactHeader = true;
  const myTeamId = user?.teamId;
  const isMyTurn = draftState?.currentTurnTeamId === myTeamId;
  const currentPhase = draftState?.phase as Phase;
  const isMapSelectionLocked = currentPhase === "MAPPICKING" && Boolean(draftState?.currentMapId);
  const isOverlayActive = Boolean(activeOverlay);
  const overlayPositionClass = isKeyAccess ? "absolute" : "fixed";
  const overlayAlignClass = isKeyAccess ? "items-start pt-8" : "items-center";
  const floatingPositionClass = isKeyAccess ? "absolute" : "fixed";

  const teamA = teams.find((t) => t.id === draftState?.match?.teamAId);
  const teamB = teams.find((t) => t.id === draftState?.match?.teamBId);
  const firstPickerTeam = teams.find((t) => t.id === draftState?.currentTurnTeamId);
  const matchStatus = draftState?.match?.status;
  const currentGameNumber = (draftState?.match?.gameNumber || 0) + 1;

  const showActionError = useCallback((message: string) => {
    setActionError(message);
    if (actionErrorTimerRef.current) clearTimeout(actionErrorTimerRef.current);
    actionErrorTimerRef.current = setTimeout(() => {
      setActionError(null);
      actionErrorTimerRef.current = null;
    }, 10000);
  }, []);

  const handleRequestFailure = useCallback(
    (label: string, err: unknown, fallback: string) => {
      console.error(label, err);
      if (isSessionFailure(err)) {
        clearSession();
        showActionError(SESSION_EXPIRED_MESSAGE);
        return;
      }
      showActionError(getRequestErrorMessage(err, fallback));
    },
    [clearSession, showActionError]
  );

  useEffect(() => {
    return () => {
      if (actionErrorTimerRef.current) clearTimeout(actionErrorTimerRef.current);
    };
  }, []);

  // Show draft history once the match or draft has finished.
  const showDraftHistory = matchStatus === "FINISHED" || currentPhase === "FINISHED";

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
  }, [isHydrated, isAuthenticated, matchId, urlKey]);

  useEffect(() => {
    if (!draftState || currentPhase === "FINISHED") return;
    if (!isAuthenticated && !urlKey) return;
    pollRef.current = setInterval(() => {
      fetchDraftState();
    }, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [draftState, currentPhase, isAuthenticated, urlKey]);

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

    // Stop the turn timer once a map has been selected during MAPPICKING.
    if (isMapSelectionLocked) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const serverRemaining =
      typeof draftState.remainingSeconds === "number" && Number.isFinite(draftState.remainingSeconds)
        ? draftState.remainingSeconds
        : TURN_DURATION;

    setTimeLeft(Math.max(0, Math.min(TURN_DURATION, serverRemaining)));

    if (timerRef.current) clearInterval(timerRef.current);
    // Freeze the local countdown while the match is paused OR while a
    // pick/ban is being submitted to the server. Once the action is
    // confirmed and the next turn arrives, the server's fresh
    // `remainingSeconds` re-runs this effect and the timer resumes.
    if (isMatchPaused || actionLoading || isOverlayActive) {
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [draftState?.remainingSeconds, currentPhase, isMatchPaused, actionLoading, isMapSelectionLocked, isOverlayActive]);

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

  useEffect(() => {
    const maps = [...(draftState?.allMaps || []), ...(draftState?.availableMaps || [])];
    if (!maps.length) return;
    setMapCacheById((prev) => {
      const next = { ...prev };
      for (const map of maps) {
        next[map.id] = map;
      }
      return next;
    });
  }, [draftState?.allMaps, draftState?.availableMaps]);

  async function loadData() {
    try {
      const [draft, teamsData] = await Promise.all([
        getDraftByMatchId(matchId, { key: urlKey ?? undefined, token: token ?? undefined }),
        getTeams(),
      ]);
      setDraftState(draft);
      setTeams(teamsData);
      setError(null);
    } catch (err) {
      console.error("Failed to load draft:", err);
      if (isSessionFailure(err)) {
        clearSession();
        setError(SESSION_EXPIRED_MESSAGE);
      } else {
        setError(getRequestErrorMessage(err, "Failed to load draft table. It may not exist or has not been created yet."));
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchDraftState() {
    if (!draftId) return;
    try {
      const draft = await getDraftState(draftId, { key: urlKey ?? undefined, token: token ?? undefined });
      setDraftState(draft);
    } catch (err) {
      if (isSessionFailure(err)) {
        clearSession();
        showActionError(SESSION_EXPIRED_MESSAGE);
      } else {
        console.error("Failed to fetch draft state:", err);
      }
    }
  }

  async function handleStartMapPicking() {
    if (!token) {
      showActionError(SESSION_EXPIRED_MESSAGE);
      return;
    }
    if (!draftId) {
      showActionError("Draft no disponible todavia. Recarga la pagina e intenta otra vez.");
      return;
    }
    setActionLoading(true);
    try {
      const updated = await startMapPicking(token, draftId);
      setDraftState(updated);
      setActionError(null);
    } catch (err) {
      handleRequestFailure("Failed to start map picking:", err, "No se pudo iniciar el map picking.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleYieldFirstPick() {
    if (!token) {
      showActionError(SESSION_EXPIRED_MESSAGE);
      return;
    }
    if (!draftId) {
      showActionError("Draft no disponible todavia. Recarga la pagina e intenta otra vez.");
      return;
    }
    setActionLoading(true);
    try {
      const updated = await yieldPlayoffFirstPick(token, draftId);
      setDraftState(updated);
      setActionError(null);
    } catch (err) {
      handleRequestFailure("Failed to hand over first pick:", err, "No se pudo ceder la primera eleccion.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartBan() {
    if (!token) {
      showActionError(SESSION_EXPIRED_MESSAGE);
      return;
    }
    if (!draftId) {
      showActionError("Draft no disponible todavia. Recarga la pagina e intenta otra vez.");
      return;
    }
    setActionLoading(true);
    try {
      const updated = await startBan(token, draftId);
      setDraftState(updated);
      setActionError(null);
    } catch (err) {
      handleRequestFailure("Failed to start ban phase:", err, "No se pudo iniciar la fase de bans.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEndGame() {
    if (!token) {
      showActionError(SESSION_EXPIRED_MESSAGE);
      return;
    }
    if (!draftId) {
      showActionError("Draft no disponible todavia. Recarga la pagina e intenta otra vez.");
      return;
    }
    setActionLoading(true);
    try {
      const updated = await endGame(token, draftId);
      setDraftState(updated);
      setActionError(null);
    } catch (err) {
      handleRequestFailure("Failed to end game:", err, "No se pudo terminar el game.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePickMap(mapId: number) {
    if (!token) {
      showActionError(SESSION_EXPIRED_MESSAGE);
      return;
    }
    if (!draftId) {
      showActionError("Draft no disponible todavia. Recarga la pagina e intenta otra vez.");
      return;
    }
    if (!isMyTurn) {
      showActionError("No es tu turno de escoger mapa.");
      await fetchDraftState();
      return;
    }
    setActionLoading(true);
    try {
      const updated = await pickMap(token, draftId, { mapId, teamId: myTeamId ?? undefined });
      setDraftState(updated);
      setActionError(null);
    } catch (err) {
      handleRequestFailure("Failed to pick map:", err, "No se pudo escoger el mapa.");
      await fetchDraftState();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBanHero(heroId: number | null) {
    if (!token) {
      showActionError(SESSION_EXPIRED_MESSAGE);
      return;
    }
    if (!draftId) {
      showActionError("Draft no disponible todavia. Recarga la pagina e intenta otra vez.");
      return;
    }
    if (!isMyTurn) {
      showActionError("No es tu turno de banear.");
      await fetchDraftState();
      return;
    }
    setActionLoading(true);
    try {
      const updated = await banHero(token, draftId, { heroId, teamId: myTeamId ?? undefined });
      setDraftState(updated);
      setActionError(null);
    } catch (err) {
      handleRequestFailure("Failed to ban hero:", err, "No se pudo registrar el ban.");
      await fetchDraftState();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmitResult(winnerTeamId: number | null) {
    if (!token) {
      showActionError(SESSION_EXPIRED_MESSAGE);
      return;
    }
    if (!draftState) {
      showActionError("Draft no disponible todavia. Recarga la pagina e intenta otra vez.");
      return;
    }
    setActionLoading(true);
    try {
      await submitMatchResult(token, matchId, winnerTeamId);
      fetchDraftState();
      setActionError(null);
    } catch (err) {
      handleRequestFailure("Failed to submit result:", err, "No se pudo registrar el resultado.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUndoResult() {
    if (!token) {
      showActionError(SESSION_EXPIRED_MESSAGE);
      return;
    }
    if (!draftState) {
      showActionError("Draft no disponible todavia. Recarga la pagina e intenta otra vez.");
      return;
    }
    setActionLoading(true);
    try {
      await undoMatchResult(token, matchId);
      fetchDraftState();
      setActionError(null);
    } catch (err) {
      handleRequestFailure("Failed to undo result:", err, "No se pudo deshacer el resultado.");
    } finally {
      setActionLoading(false);
    }
  }

  // Rewinds the whole match to the schedule stage so it can be replayed from
  // scratch: clears the draft, the score, the timers, the ready flags and the
  // uploaded stats, and rolls back the standings.
  async function handleResetMatch() {
    if (!token) {
      showActionError(SESSION_EXPIRED_MESSAGE);
      return;
    }
    setResetPending(true);
    try {
      await resetManagerMatch(token, matchId);
      setResetConfirmOpen(false);
      setActionError(null);
      router.push(`/schedule/${matchId}`);
    } catch (err) {
      handleRequestFailure("Failed to reset match:", err, "No se pudo reiniciar el match.");
    } finally {
      setResetPending(false);
    }
  }

  async function handleSetReady() {
    if (!token) {
      showActionError(SESSION_EXPIRED_MESSAGE);
      return;
    }
    if (!isCaptain || !myTeamId) {
      showActionError("Solo el captain del match puede ponerse ready.");
      return;
    }
    setActionLoading(true);
    try {
      const payload = myTeamId === teamA?.id 
        ? { teamAready: 1 as const } 
        : { teamBready: 1 as const };
      await updateCaptainMatch(token, matchId, payload);
      fetchDraftState();
      setActionError(null);
    } catch (err) {
      handleRequestFailure("Failed to set ready:", err, "No se pudo marcar ready.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleOpenShareOverlay() {
    if (!token) {
      showActionError(SESSION_EXPIRED_MESSAGE);
      return;
    }

    setShareOverlayOpen(true);
    setShareCopied(null);
    if (shareInfo) return;

    setShareLoading(true);
    try {
      const info = await getDraftShareInfo(token, matchId);
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      setShareInfo({
        ...info,
        url: `${baseUrl}/draft-table/${info.matchId}?key=${encodeURIComponent(info.key)}`,
      });
    } catch (err) {
      handleRequestFailure("Failed to load draft share info:", err, "No se pudo generar el acceso para compartir.");
      setShareOverlayOpen(false);
    } finally {
      setShareLoading(false);
    }
  }

  async function handleCopyShareText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setShareCopied(label);
    } catch (_err) {
      setShareCopied("Could not copy");
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

  const getBanCountByRole = (_teamId: number, role: "TANK" | "DPS" | "SUPPORT") => {
    if (!draftState?.actions || !draftState?.heroes) return 0;
    const heroesOfRole = draftState.heroes.filter((h) => h.role === role).map((h) => h.id);
    return draftState.actions.filter(
      (a) =>
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
  const getMapById = useCallback(
    (mapId?: number | null) => {
      if (!mapId || !Number.isFinite(mapId)) return null;
      const liveMap =
        draftState?.allMaps?.find((map) => map.id === mapId) ||
        draftState?.availableMaps?.find((map) => map.id === mapId);
      if (liveMap) return liveMap;
      return mapCacheById[mapId] || null;
    },
    [draftState?.allMaps, draftState?.availableMaps, mapCacheById]
  );

  const enqueueOverlay = useCallback((overlay: DraftOverlay) => {
    setOverlayQueue((prev) => [...prev, overlay]);
  }, []);

  const getTeamById = useCallback(
    (teamId?: number | null) => teams.find((team) => team.id === teamId),
    [teams]
  );

  const getTeamToneClass = useCallback(
    (teamId?: number | null) => {
      if (!teamId) return "text-foreground";
      if (teamId === teamA?.id) return "text-[color:var(--color-team-a)]";
      if (teamId === teamB?.id) return "text-[color:var(--color-team-b)]";
      return "text-foreground";
    },
    [teamA?.id, teamB?.id]
  );

  useEffect(() => {
    if (!isKeyAccess) return;

    const updateScale = () => {
      const scale = Math.min(
        window.innerWidth / KEY_CANVAS_WIDTH,
        window.innerHeight / KEY_CANVAS_HEIGHT
      );
      setKeyFitScale(Number.isFinite(scale) && scale > 0 ? scale : 1);
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [isKeyAccess]);

  const wrapKeyView = (content: ReactNode) =>
    isKeyAccess ? (
      <div className="min-h-screen w-screen bg-black flex items-start justify-center">
        <div
          className="relative"
          style={{
            width: `${KEY_CANVAS_WIDTH}px`,
            height: `${KEY_CANVAS_HEIGHT}px`,
            transform: `scale(${keyFitScale})`,
            transformOrigin: "top center",
          }}
        >
          {content}
        </div>
      </div>
    ) : (
      content
    );

  useEffect(() => {
    if (activeOverlay || overlayQueue.length === 0) return;
    setActiveOverlay(overlayQueue[0]);
    setOverlayQueue((prev) => prev.slice(1));
  }, [activeOverlay, overlayQueue]);

  useEffect(() => {
    if (!activeOverlay) {
      setOverlayCountdown(null);
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      if (overlayCountdownRef.current) clearInterval(overlayCountdownRef.current);
      return;
    }

    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    if (overlayCountdownRef.current) clearInterval(overlayCountdownRef.current);

    overlayTimerRef.current = setTimeout(() => {
      setActiveOverlay(null);
    }, activeOverlay.durationMs);

    if (activeOverlay.countdownFrom) {
      setOverlayCountdown(activeOverlay.countdownFrom);
      overlayCountdownRef.current = setInterval(() => {
        setOverlayCountdown((prev) => (prev && prev > 1 ? prev - 1 : 1));
      }, 1000);
    } else {
      setOverlayCountdown(null);
    }
  }, [activeOverlay]);

  useEffect(() => {
    if (!draftState?.actions) return;

    if (!hasInitializedActionsRef.current) {
      draftState.actions.forEach((action) => seenActionIdsRef.current.add(action.id));
      hasInitializedActionsRef.current = true;
      return;
    }

    const newActions = draftState.actions.filter(
      (action) => !seenActionIdsRef.current.has(action.id)
    );

    if (!newActions.length) return;

    newActions.forEach((action) => {
      if (action.gameNumber !== currentGameNumber) {
        seenActionIdsRef.current.add(action.id);
        return;
      }

      if (action.action === "BAN") {
        const team = getTeamById(action.teamId);
        const hero = action.value ? getHeroById(action.value) : null;
        enqueueOverlay({
          id: `ban-${action.id}-${overlayIdRef.current++}`,
          kind: "BAN",
          title: team?.name ? `${team.name} has banned` : "A team has banned",
          subtitle: hero?.name ?? (action.value ? "Unknown Hero" : "No Ban"),
          team,
          hero,
          durationMs: 3000,
        });
        seenActionIdsRef.current.add(action.id);
        return;
      }

      if (action.action === "PICK") {
        const team = getTeamById(action.teamId);
        const pickedMapId = Number(action.value);
        const map = getMapById(pickedMapId) || getMapById(draftState.currentMapId);
        if (!map && Number.isFinite(pickedMapId)) {
          // Sometimes the action arrives one poll before the map list;
          // defer until map metadata is available to avoid "Unknown Map".
          return;
        }
        enqueueOverlay({
          id: `pick-${action.id}-${overlayIdRef.current++}`,
          kind: "MAP_PICK",
          title: team?.name ? `${team.name} picked` : "Map picked",
          subtitle: map?.description ?? "Map selected",
          team,
          map,
          durationMs: 3000,
        });
        seenActionIdsRef.current.add(action.id);
        return;
      }

      seenActionIdsRef.current.add(action.id);
    });
  }, [draftState?.actions, currentGameNumber, draftState?.currentMapId, enqueueOverlay, getHeroById, getMapById, getTeamById]);

  useEffect(() => {
    if (!currentPhase) return;

    if (!hasInitializedPhaseRef.current) {
      prevPhaseRef.current = currentPhase;
      hasInitializedPhaseRef.current = true;
      return;
    }

    const prevPhase = prevPhaseRef.current;

    if (currentPhase === "MAPPICKING" && prevPhase !== "MAPPICKING") {
      enqueueOverlay({
        id: `map-start-${overlayIdRef.current++}`,
        kind: "MAP_PICKING_COUNTDOWN",
        title: "MAP PICKING STARTS IN",
        durationMs: 5000,
        countdownFrom: 5,
      });
    }

    if (currentPhase === "BAN" && prevPhase !== "BAN") {
      enqueueOverlay({
        id: `ban-start-${overlayIdRef.current++}`,
        kind: "BAN_START_COUNTDOWN",
        title: "BAN DRAFT STARTS IN",
        durationMs: 5000,
        countdownFrom: 5,
      });
    }

    prevPhaseRef.current = currentPhase;
  }, [currentPhase, enqueueOverlay]);

  // Use the currently-selected map as the page backdrop for captains and
  // managers. We compute the URL here (before any early return) so the
  // useImageReady hook below always runs in the same order on every render.
  const backgroundMap = draftState?.allMaps?.find((m) => m.id === draftState.currentMapId);
  const backgroundMapUrl = backgroundMap?.imgPath ? resolveMapImageUrl(backgroundMap.imgPath) : null;
  const backgroundReady = useImageReady(backgroundMapUrl);

  // Warm the image cache for every map in the pool as soon as we know
  // the draft state. This means whichever map gets picked next, its
  // background is already decoded by the time the BAN phase starts —
  // no 1-2s flash on phase transitions, no re-fetch when phases swap.
  useEffect(() => {
    if (!draftState?.allMaps?.length) return;
    const urls = draftState.allMaps
      .map((m) => (m.imgPath ? resolveMapImageUrl(m.imgPath) : null))
      .filter((u): u is string => !!u);
    if (urls.length) preloadImages(urls);
  }, [draftState?.allMaps]);

  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      if (overlayCountdownRef.current) clearInterval(overlayCountdownRef.current);
    };
  }, []);

  if (!isHydrated || loading) {
    return wrapKeyView(
      <div
        className={clsx("bg-background flex items-center justify-center", !isKeyAccess && "min-h-screen")}
        style={
          isKeyAccess
            ? {
                width: `${KEY_CANVAS_WIDTH}px`,
                height: `${KEY_CANVAS_HEIGHT}px`,
              }
            : undefined
        }
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted">Loading draft table...</p>
        </div>
      </div>
    );
  }


  if (error || !draftState) {
    return wrapKeyView(
      <div
        className={clsx("bg-background flex items-center justify-center", !isKeyAccess && "min-h-screen")}
        style={
          isKeyAccess
            ? {
                width: `${KEY_CANVAS_WIDTH}px`,
                height: `${KEY_CANVAS_HEIGHT}px`,
              }
            : undefined
        }
      >
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

  // The BAN phase always shows hero portraits over the picked map's
  // backdrop. When we land directly on a BAN phase (refresh or first
  // open) the artwork hasn't been fetched yet, so we hold the UI on a
  // dedicated loading screen until the bytes are decoded. This avoids
  // showing the bans before the background painted in.
  const waitingForBanBackground =
    currentPhase === "BAN" && !!backgroundMapUrl && !backgroundReady;

  return wrapKeyView(
    <main
      className={clsx("relative bg-background", !isKeyAccess && "min-h-screen", isObsKeyAccess && "overflow-hidden")}
      style={
        isKeyAccess
          ? {
              width: `${KEY_CANVAS_WIDTH}px`,
              height: `${KEY_CANVAS_HEIGHT}px`,
              overflow: "hidden",
            }
          : undefined
      }
    >
      {/* Map background — only paints once the bytes have loaded so we never
          flash a half-rendered image between phases. */}
      <MapBackground src={backgroundMapUrl} position={isKeyAccess ? "container" : "viewport"} />
      <div className="relative w-full h-full">
        {waitingForBanBackground && (
          <div className={clsx(overlayPositionClass, "inset-0 z-50 bg-background flex items-center justify-center")}>
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm uppercase tracking-widest text-muted">
                Loading ban phase...
              </p>
              {backgroundMap?.description && (
                <p className="text-xs text-muted/70">
                  Preparing {backgroundMap.description}
                </p>
              )}
            </div>
          </div>
        )}

        {activeOverlay && (
          <div
            className={clsx(
              overlayPositionClass,
              "inset-0 z-50 flex justify-center bg-black/60 backdrop-blur-sm",
              overlayAlignClass
            )}
          >
            <div className="w-[min(620px,92vw)] rounded-2xl border border-border/60 bg-gradient-to-br from-surface/95 via-surface-elevated/95 to-surface/90 p-6 shadow-2xl shadow-black/40 ring-1 ring-white/10 animate-fade-in">
              {activeOverlay.kind === "MAP_PICKING_COUNTDOWN" || activeOverlay.kind === "BAN_START_COUNTDOWN" ? (
                <div className="text-center">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-muted">Get Ready</p>
                  <h2 className="text-3xl md:text-4xl font-black text-foreground mt-2">
                    {activeOverlay.title}
                  </h2>
                  <div className="mt-5 text-6xl md:text-7xl font-black text-primary">
                    {overlayCountdown ?? activeOverlay.countdownFrom ?? 5}
                  </div>
                  <p className="text-xs text-muted mt-4">Timer resumes when the alert ends.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-5 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border bg-surface-elevated">
                      {activeOverlay.team?.logo ? (
                        <img
                          src={resolveGenericBackendAsset(activeOverlay.team.logo)}
                          alt={activeOverlay.team.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm font-bold text-muted">
                          {activeOverlay.team?.name?.charAt(0) || "T"}
                        </div>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-[11px] uppercase tracking-widest text-muted">
                        {activeOverlay.kind === "BAN" ? "Ban Alert" : "Map Pick"}
                      </p>
                      <p
                        className={clsx(
                          "text-2xl md:text-3xl font-black",
                          getTeamToneClass(activeOverlay.team?.id)
                        )}
                      >
                        {activeOverlay.title}
                      </p>
                    </div>
                  </div>

                  {activeOverlay.kind === "BAN" && (
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-danger/60 bg-danger/10">
                        {activeOverlay.hero?.imgPath ? (
                          <img
                            src={resolveHeroImageUrl(activeOverlay.hero.imgPath)}
                            alt={activeOverlay.hero.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-black text-danger">
                            {activeOverlay.hero?.name?.charAt(0) || "?"}
                          </div>
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-[11px] uppercase tracking-widest text-muted">Hero</p>
                        <p className="text-2xl md:text-3xl font-black text-danger">
                          {activeOverlay.subtitle}
                        </p>
                        {activeOverlay.hero?.role && (
                          <Badge variant="danger" className="mt-2">
                            {activeOverlay.hero.role}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {activeOverlay.kind === "MAP_PICK" && (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-full max-w-md rounded-xl overflow-hidden border-2 border-primary/50">
                        <MapImage
                          src={activeOverlay.map?.imgPath ? resolveMapImageUrl(activeOverlay.map.imgPath) : null}
                          alt={activeOverlay.subtitle ?? "Map"}
                          fallbackInitial={activeOverlay.map?.description?.charAt(0) || "M"}
                          className="w-full aspect-video"
                        />
                      </div>
                      <p className="text-2xl md:text-3xl font-black text-foreground">
                        {activeOverlay.subtitle}
                      </p>
                      {activeOverlay.map?.type && (
                        <Badge variant="primary">{activeOverlay.map.type}</Badge>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="relative z-10 w-full h-full">
        {shouldRenderCompactHeader && (
          <header className="relative border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
            <div
              className={clsx(
                "relative mx-auto py-3",
                isObsKeyAccess ? `${KEY_CONTENT_MAX_WIDTH} px-6` : "max-w-7xl px-4"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <span
                      className={clsx(
                        "font-semibold text-[color:var(--color-team-a)]",
                        isObsKeyAccess ? "text-2xl" : "text-lg"
                      )}
                    >
                      {teamA?.name}
                    </span>
                    <span className={clsx("font-bold text-foreground", isObsKeyAccess ? "text-4xl" : "text-2xl")}>
                      {draftState.match.mapWinsTeamA}
                    </span>
                    <span className="text-muted">-</span>
                    <span className={clsx("font-bold text-foreground", isObsKeyAccess ? "text-4xl" : "text-2xl")}>
                      {draftState.match.mapWinsTeamB}
                    </span>
                    <span
                      className={clsx(
                        "font-semibold text-[color:var(--color-team-b)]",
                        isObsKeyAccess ? "text-2xl" : "text-lg"
                      )}
                    >
                      {teamB?.name}
                    </span>
                  </div>
                  <Badge variant="outline" className={clsx(isObsKeyAccess ? "text-sm" : "text-xs")}>
                    Game {currentGameNumber}
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  {/* Ready Status for Manager */}
                  {isManager && currentPhase === "STARTING" && (
                    <div className={clsx("flex items-center gap-2", isObsKeyAccess ? "text-sm" : "text-xs")}>
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
                    className={clsx("px-3 py-1", isObsKeyAccess && "text-sm px-4 py-1.5")}
                  >
                    {currentPhase}
                  </Badge>
                  {(currentPhase === "BAN" || currentPhase === "MAPPICKING") && !isMapSelectionLocked && (
                    <div
                      className={clsx(
                        "font-mono font-bold tabular-nums",
                        isObsKeyAccess ? "text-3xl" : "text-2xl",
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
        )}

        <div
          className={clsx(
            "w-full py-6",
            isObsKeyAccess ? `mx-auto ${KEY_CONTENT_MAX_WIDTH} px-6` : "px-3 md:px-6"
          )}
        >
          {actionError && !isObsKeyAccess && (
            <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger shadow-lg shadow-black/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium">{actionError}</p>
                <div className="flex shrink-0 items-center gap-2">
                  {!isAuthenticated && (
                    <Button size="sm" variant="danger" onClick={() => router.push("/login")}>
                      Login
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setActionError(null)} className="text-danger hover:text-danger">
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Phase Content */}
        {currentPhase === "STARTING" && (() => {
          // The Grand Final wraps the same starting phase in the presentation
          // stage. Build the phase once so both paths stay in sync.
          const startingPhase = (
            <StartingPhase
              isManager={isManager}
              isCaptain={isCaptain}
              isObsKeyAccess={isObsKeyAccess}
              teamA={teamA}
              teamB={teamB}
              match={draftState.match}
              amIReady={amIReady}
              onStart={handleStartMapPicking}
              onSetReady={handleSetReady}
              onUndoResult={handleUndoResult}
              firstPickerTeam={firstPickerTeam}
              canYieldFirstPick={
                isCaptain &&
                isBracketMatch(draftState.match) &&
                draftState.match.gameNumber === 0 &&
                draftState.currentTurnTeamId === myTeamId
              }
              onYieldFirstPick={handleYieldFirstPick}
              actionLoading={actionLoading}
              canResetMatch={canResetMatch && !isObsKeyAccess}
              onRequestResetMatch={() => setResetConfirmOpen(true)}
            />
          );

          return startingPhase;
        })()}

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
            isObsKeyAccess={isObsKeyAccess}
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
            isObsKeyAccess={isObsKeyAccess}
          />
        )}

        {currentPhase === "PLAYING" && (
          <PlayingPhase
            draftState={draftState}
            teams={teams}
            isManager={isManager}
            isObsKeyAccess={isObsKeyAccess}
            getHeroById={getHeroById}
            getBannedHeroesByTeam={getBannedHeroesByTeam}
            onEndGame={handleEndGame}
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
            isObsKeyAccess={isObsKeyAccess}
          />
        )}

        {currentPhase === "FINISHED" && (
          <FinishedPhase
            draftState={draftState}
            teams={teams}
            canResetMatch={canResetMatch && !isObsKeyAccess}
            onRequestResetMatch={() => setResetConfirmOpen(true)}
            actionLoading={actionLoading}
          />
        )}

        {/* Draft History - Only shown after PENDINGRESULT/FINISHED */}
        {showDraftHistory && !isObsKeyAccess && (
          <DraftHistory
            draftState={draftState}
            teams={teams}
            getHeroById={getHeroById}
            isObsKeyAccess={isObsKeyAccess}
          />
        )}
      </div>

      {showDraftHistory && isObsKeyAccess && (
        <div className="absolute bottom-6 left-6 right-6 z-30 mx-auto max-w-[1840px]">
          <DraftHistory
            draftState={draftState}
            teams={teams}
            getHeroById={getHeroById}
            isObsKeyAccess={isObsKeyAccess}
          />
        </div>
      )}

      {isCaptain && !isObsKeyAccess && (
        <div className={clsx(floatingPositionClass, "right-6 bottom-6 z-40")}>
          <Button size="sm" variant="secondary" onClick={handleOpenShareOverlay} disabled={shareLoading}>
            {shareLoading ? "Loading..." : "Share draft"}
          </Button>
        </div>
      )}

      {shareOverlayOpen && !isObsKeyAccess && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-[min(92vw,430px)] aspect-square rounded-lg border border-border bg-surface p-5 shadow-2xl shadow-black/50">
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Read-only draft</p>
                  <h2 className="mt-1 text-2xl font-black text-foreground">Share match #{matchId}</h2>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShareOverlayOpen(false)} aria-label="Close share draft">
                  X
                </Button>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-md border border-border bg-background/70 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-muted">Manager key</p>
                  <p className="mt-2 break-all font-mono text-sm text-foreground">
                    {shareInfo?.key || "Loading..."}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-background/70 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-muted">Viewer link</p>
                  <p className="mt-2 break-all font-mono text-xs text-foreground">
                    {shareInfo?.url || "Loading..."}
                  </p>
                </div>
              </div>

              <div className="mt-auto grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!shareInfo}
                  onClick={() => shareInfo && handleCopyShareText(shareInfo.key, "Key copied")}
                >
                  Copy key
                </Button>
                <Button
                  size="sm"
                  disabled={!shareInfo}
                  onClick={() => shareInfo && handleCopyShareText(shareInfo.url, "Link copied")}
                >
                  Copy link
                </Button>
              </div>
              {shareCopied && (
                <p className="mt-3 text-center text-xs font-semibold text-success">{shareCopied}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {resetConfirmOpen && !isObsKeyAccess && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-match-title"
        >
          <div className="w-[min(92vw,460px)] rounded-lg border border-danger/50 bg-surface p-5 shadow-2xl shadow-black/50">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-danger">
              Destructive action
            </p>
            <h2 id="reset-match-title" className="mt-1 text-2xl font-black text-foreground">
              Reset match #{matchId}?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              This sends the match back to the schedule stage. It will:
            </p>
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted">
              <li>· Delete the draft and every pick and ban</li>
              <li>· Clear the score, map results and uploaded player stats</li>
              <li>· Reset both captain ready flags and all timers</li>
              <li>· Roll back team standings and un-eliminate the loser</li>
            </ul>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-foreground">
              This cannot be undone.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setResetConfirmOpen(false)}
                disabled={resetPending}
              >
                Cancel
              </Button>
              <Button size="sm" variant="danger" onClick={handleResetMatch} disabled={resetPending}>
                {resetPending ? "Resetting..." : "Reset match"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isManager && (
        <div className={clsx(floatingPositionClass, "right-6 z-40", isObsKeyAccess ? "top-6" : "bottom-6")}>
          <Button size="sm" variant="secondary" onClick={() => toggleNavbar(!isNavHidden)}>
            {isNavHidden ? "Show header" : "Hide header"}
          </Button>
        </div>
      )}

      {/* Captain pause request button — wired to backend */}
      {(currentPhase === "MAPPICKING" || currentPhase === "BAN") && isCaptain && !isMatchPaused && (
        <button
          onClick={async () => {
            if (pauseActionPending) return;
            if (!token) {
              showActionError(SESSION_EXPIRED_MESSAGE);
              return;
            }
            setPauseActionPending(true);
            try {
              await captainRequestPause(token, matchId);
              await fetchDraftState();
              setActionError(null);
            } catch (err) {
              handleRequestFailure("Failed to request pause:", err, "No se pudo pedir pausa.");
            } finally {
              setPauseActionPending(false);
            }
          }}
          disabled={pauseActionPending || pauseRequestedBy === myTeamId}
          className={clsx(
            floatingPositionClass,
            "left-6 z-40 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-md transition-all flex items-center gap-1.5",
            isObsKeyAccess ? "top-6" : "bottom-6",
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
            if (pauseActionPending) return;
            if (!token) {
              showActionError(SESSION_EXPIRED_MESSAGE);
              return;
            }
            setPauseActionPending(true);
            try {
              await managerTogglePause(token, matchId, !isMatchPaused);
              await fetchDraftState();
              setActionError(null);
            } catch (err) {
              handleRequestFailure("Failed to toggle pause:", err, "No se pudo cambiar la pausa.");
            } finally {
              setPauseActionPending(false);
            }
          }}
          disabled={pauseActionPending}
          className={clsx(
            floatingPositionClass,
            "left-6 z-40 px-4 py-2 text-sm font-semibold rounded-lg shadow-md transition-all flex items-center gap-2",
            isObsKeyAccess ? "top-6" : "bottom-6",
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
        <div className={clsx(floatingPositionClass, "top-24 right-6 z-40 w-80 bg-surface border-2 border-warning rounded-xl shadow-2xl shadow-warning/20 animate-fade-in")}>
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
                  if (!token) {
                    showActionError(SESSION_EXPIRED_MESSAGE);
                    return;
                  }
                  setPauseActionPending(true);
                  try {
                    await managerTogglePause(token, matchId, true);
                    await fetchDraftState();
                    setActionError(null);
                  } catch (err) {
                    handleRequestFailure("Failed to approve pause:", err, "No se pudo aprobar la pausa.");
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
                  if (!token) {
                    showActionError(SESSION_EXPIRED_MESSAGE);
                    return;
                  }
                  setPauseActionPending(true);
                  try {
                    await managerClearPauseRequest(token, matchId);
                    await fetchDraftState();
                    setActionError(null);
                  } catch (err) {
                    handleRequestFailure("Failed to deny pause:", err, "No se pudo rechazar la pausa.");
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
        <div className={clsx(overlayPositionClass, "inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center")}>
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
                  if (pauseActionPending) return;
                  if (!token) {
                    showActionError(SESSION_EXPIRED_MESSAGE);
                    return;
                  }
                  setPauseActionPending(true);
                  try {
                    await managerTogglePause(token, matchId, false);
                    await fetchDraftState();
                    setActionError(null);
                  } catch (err) {
                    handleRequestFailure("Failed to resume:", err, "No se pudo resumir el match.");
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
      </div>
    </main>
  );
}

// ==================== STARTING PHASE ====================

function WaitingTeamLogo({ team, fallback }: { team?: Team; fallback: string }) {
  const [logoFailed, setLogoFailed] = useState(!team?.logo);
  return team?.logo && !logoFailed ? (
    <img
      src={resolveGenericBackendAsset(team.logo)}
      alt={`${team.name} logo`}
      onError={() => setLogoFailed(true)}
    />
  ) : <span aria-label={`${team?.name || fallback} logo`}>{team?.name?.slice(0, 2).toUpperCase() || fallback}</span>;
}

function StartingPhase({
  isManager,
  isCaptain,
  isObsKeyAccess,
  teamA,
  teamB,
  match,
  amIReady,
  onStart,
  onSetReady,
  onUndoResult,
  firstPickerTeam,
  canYieldFirstPick,
  onYieldFirstPick,
  actionLoading,
  canResetMatch,
  onRequestResetMatch,
}: {
  isManager: boolean;
  isCaptain: boolean;
  isObsKeyAccess: boolean;
  teamA?: Team;
  teamB?: Team;
  match: DraftState["match"];
  amIReady: boolean;
  onStart: () => void;
  onSetReady: () => void;
  onUndoResult: () => void;
  firstPickerTeam?: Team;
  canYieldFirstPick: boolean;
  onYieldFirstPick: () => void;
  actionLoading: boolean;
  canResetMatch: boolean;
  onRequestResetMatch: () => void;
}) {
  const bothReady = match.teamAready === 1 && match.teamBready === 1;
  const canUndoResult = isManager && match.status !== "FINISHED" && (match.mapResults?.length || 0) > 0;
  // Anything already committed on this match is worth warning about before a reset.
  const hasProgress =
    (match.mapResults?.length || 0) > 0 ||
    match.gameNumber > 0 ||
    match.teamAready === 1 ||
    match.teamBready === 1;

  return (
    <div className={clsx(waitingStyles.waitingRoom, isObsKeyAccess && waitingStyles.waitingRoomBroadcast)}>
      <div className={waitingStyles.waitingGrid} aria-hidden="true" />
      <header className={waitingStyles.waitingHeading}>
        <p>{match.gameNumber === 0 ? "CAPTAIN CHECK-IN" : `GAME ${match.gameNumber + 1} · RESET`}</p>
        <h2>{match.gameNumber === 0 ? "THE LOBBY IS OPEN" : "READY FOR THE NEXT MAP"}</h2>
        <span>{bothReady ? "Both teams are locked in." : "Captains, confirm your team when you are ready."}</span>
      </header>

      <div className={waitingStyles.waitingMatchup}>
        {[{ team: teamA, ready: match.teamAready, side: "a" }, { team: teamB, ready: match.teamBready, side: "b" }].map(({ team, ready, side }) => (
          <div key={side} className={`${waitingStyles.waitingTeam} ${waitingStyles[`waitingTeam${side.toUpperCase()}`]}`}>
            <div className={waitingStyles.waitingLogo}>
              <WaitingTeamLogo team={team} fallback={side.toUpperCase()} />
            </div>
            <h3>{team?.name || `Team ${side.toUpperCase()}`}</h3>
            <div className={`${waitingStyles.readyState} ${ready ? waitingStyles.readyStateActive : ""}`}>
              <i /> {ready ? "READY" : "AWAITING CAPTAIN"}
            </div>
          </div>
        ))}
        <div className={waitingStyles.waitingVs}>
          <small>BEST OF {getSeriesLength(match)}</small>
          <strong>VS</strong>
          <span>{Number(Boolean(match.teamAready)) + Number(Boolean(match.teamBready))} / 2 READY</span>
        </div>
      </div>

      {isBracketMatch(match) && match.gameNumber === 0 && (
        <div className={waitingStyles.firstPickNotice}>
          <span>FIRST MOVE</span>
          <p>{firstPickerTeam?.name || "Best seed"} holds first map pick and first ban.</p>
          {canYieldFirstPick && <Button type="button" variant="outline" size="sm" onClick={onYieldFirstPick} disabled={actionLoading}>Yield first choice</Button>}
        </div>
      )}

      <div className={waitingStyles.waitingActions}>
        {isCaptain && !amIReady && (
          <Button size="lg" onClick={onSetReady} disabled={actionLoading} className="px-10">
            {actionLoading ? "CONFIRMING..." : "CONFIRM TEAM READY"}
          </Button>
        )}
        {isCaptain && amIReady && <div className={waitingStyles.lockedMessage}><strong>YOU ARE LOCKED IN</strong><span>The manager will open map picking.</span></div>}
        {isManager && (
          <>
            {canUndoResult && <Button size="lg" variant="secondary" onClick={onUndoResult} disabled={actionLoading}>Fix Last Result</Button>}
            <Button size="lg" onClick={onStart} disabled={actionLoading} className="px-10">
              {actionLoading ? "OPENING..." : "OPEN MAP PICKING"}
            </Button>
            {!bothReady && <span className={waitingStyles.overrideNote}>Manager override available · captains are not both ready</span>}
          </>
        )}
        {!isCaptain && !isManager && <p className={waitingStyles.viewerMessage}>Waiting for both captains to check in.</p>}
      </div>

      {canResetMatch && (
        <div className={waitingStyles.dangerZone}>
          <div>
            <strong>Reset match</strong>
            <span>
              {hasProgress
                ? "Clears the draft, score, timers and uploaded stats, and rolls back the standings."
                : "Nothing to roll back yet · this match is already at its initial state."}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRequestResetMatch}
            disabled={actionLoading}
          >
            Reset to schedule
          </Button>
        </div>
      )}
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
  isObsKeyAccess,
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
  isObsKeyAccess: boolean;
}) {
  const currentTeam = teams.find((t) => t.id === draftState.currentTurnTeamId);
  const teamA = teams.find((t) => t.id === draftState.match.teamAId);
  const teamB = teams.find((t) => t.id === draftState.match.teamBId);
  const availableMaps = draftState.availableMaps || [];
  const currentMap = draftState.allMaps?.find((m) => m.id === draftState.currentMapId);
  const isTeamATurn = draftState.currentTurnTeamId === teamA?.id;
  const isTeamBTurn = draftState.currentTurnTeamId === teamB?.id;
  const isMapLocked = Boolean(currentMap);

  return (
    <div className={clsx("flex flex-col", isMapLocked ? "min-h-[60vh]" : "min-h-[80vh]")}>
      {/* Three Column Layout - Team A | Map Selection | Team B */}
      <div
        className={clsx(
          "flex-1 grid",
          isObsKeyAccess
            ? "grid-cols-[220px_minmax(0,1fr)_220px] xl:grid-cols-[260px_minmax(0,1fr)_260px] gap-6"
            : "grid-cols-[140px_1fr_140px] xl:grid-cols-[160px_1fr_160px] gap-4",
          // When in OBS manager-key mode, vertically center team blocks so
          // logos and player names align with the map area.
          isObsKeyAccess ? "items-center" : isMapLocked ? "items-center" : "items-start"
        )}
      >
        {/* Left - Team A: big logo on top, rectangle (name) below */}
        <div className="flex flex-col gap-4">
          <div className={clsx(
            "w-full aspect-square rounded-full overflow-hidden border-2 transition-all bg-surface-elevated",
            isTeamATurn
              ? "border-[color:var(--color-team-a)] animate-turn-glow-teal"
              : "border-[color:var(--color-team-a)]/40"
          )}>
            {teamA?.logo ? (
              <img src={resolveGenericBackendAsset(teamA.logo)} alt={teamA.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[color:var(--color-team-a)]/20 flex items-center justify-center">
                <span className={clsx("font-black text-[color:var(--color-team-a)]", isObsKeyAccess ? "text-6xl" : "text-5xl")}>
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
            <span className={clsx("font-bold text-foreground text-center leading-tight uppercase tracking-wide break-words", isObsKeyAccess ? "text-lg" : "text-base")}>
              {teamA?.name}
            </span>
            {isTeamATurn && (
              <Badge variant="primary" className={clsx("px-2 animate-pulse", isObsKeyAccess ? "text-sm" : "text-[10px]")}>Picking</Badge>
            )}
          </div>
        </div>

        {/* Center - Map Selection */}
        <div className="space-y-4">
          {/* Selected Map Display - Central */}
          {currentMap ? (
            <div className="flex flex-col items-center">
              <div className={clsx("relative w-full rounded-xl overflow-hidden border-4 border-primary shadow-2xl shadow-primary/30", isObsKeyAccess ? "max-w-3xl" : "max-w-md")}>
                <MapImage
                  src={currentMap.imgPath ? resolveMapImageUrl(currentMap.imgPath) : null}
                  alt={currentMap.description}
                  fallbackInitial={currentMap.description.charAt(0)}
                  className="w-full aspect-video"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
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
          {!currentMap && (
            <Card variant="featured">
              <CardHeader className={clsx("pb-2 pt-3", isObsKeyAccess && "pb-4")}>
                <div className="flex items-center justify-between">
                  <CardTitle className={clsx("text-base", isObsKeyAccess && "text-xl font-bold")}>Available Maps</CardTitle>
                  {isCaptain && isMyTurn && (
                    <Badge variant="success" className="animate-pulse-glow">Your Turn</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className={clsx("pb-4", isObsKeyAccess && "pb-6")}>
                {isCaptain && !isMyTurn && (
                  <div className={clsx("mb-3 p-2 rounded-lg bg-surface-elevated text-center", isObsKeyAccess && "mb-5 p-3")}>
                    <p className={clsx("text-xs text-muted", isObsKeyAccess && "text-base")}>Waiting for {currentTeam?.name} to pick...</p>
                  </div>
                )}

                <div className={clsx(
                  "grid",
                  isObsKeyAccess
                    ? "grid-cols-3 gap-6"
                    : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
                )}>
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
                        <div className={clsx(
                          "bg-surface-elevated",
                          isObsKeyAccess ? "aspect-video" : "aspect-video"
                        )}>
                          {map.imgPath ? (
                            <img
                              src={resolveMapImageUrl(map.imgPath)}
                              alt={map.description}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className={clsx("font-bold text-muted", isObsKeyAccess ? "text-4xl" : "text-sm")}>
                                {map.description.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className={clsx("bg-background", isObsKeyAccess ? "p-4" : "p-2")}>
                          <p className={clsx("font-medium text-foreground text-center", isObsKeyAccess ? "text-base" : "text-xs truncate")}>
                            {map.description}
                          </p>
                        </div>
                        {picked && (
                          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                            <span className={clsx("text-muted font-semibold", isObsKeyAccess ? "text-base" : "text-[10px]")}>USED</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          {currentMap && !isManager && (
            <div className="rounded-lg border border-border/50 bg-surface-elevated/50 p-3 text-center text-xs text-muted">
              Map locked. Waiting for the manager to start the ban phase.
            </div>
          )}
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
              <img src={resolveGenericBackendAsset(teamB.logo)} alt={teamB.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[color:var(--color-team-b)]/20 flex items-center justify-center">
                <span className={clsx("font-black text-[color:var(--color-team-b)]", isObsKeyAccess ? "text-6xl" : "text-5xl")}>
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
            <span className={clsx("font-bold text-foreground text-center leading-tight uppercase tracking-wide break-words", isObsKeyAccess ? "text-lg" : "text-base")}>
              {teamB?.name}
            </span>
            {isTeamBTurn && (
              <Badge variant="primary" className={clsx("px-2 animate-pulse", isObsKeyAccess ? "text-sm" : "text-[10px]")}>Picking</Badge>
            )}
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
  isObsKeyAccess,
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
  isObsKeyAccess: boolean;
}) {
  const currentTeam = teams.find((t) => t.id === draftState.currentTurnTeamId);
  const teamA = teams.find((t) => t.id === draftState.match.teamAId);
  const teamB = teams.find((t) => t.id === draftState.match.teamBId);
  const currentMap = draftState.allMaps?.find((m) => m.id === draftState.currentMapId);
  const currentGameNumber = (draftState.match.gameNumber || 0) + 1;
  const toastPositionClass = isObsKeyAccess ? "absolute" : "fixed";

  const teamABans = teamA ? getBannedHeroesByTeam(teamA.id) : [];
  const teamBBans = teamB ? getBannedHeroesByTeam(teamB.id) : [];

  const isTeamATurn = draftState.currentTurnTeamId === teamA?.id;
  const isTeamBTurn = draftState.currentTurnTeamId === teamB?.id;

  // Group heroes by role
  const tankHeroes = heroes.filter((h) => h.role === "TANK");
  const dpsHeroes = heroes.filter((h) => h.role === "DPS");
  const supportHeroes = heroes.filter((h) => h.role === "SUPPORT");
  const showBanTeamMarkers = isManager || isObsKeyAccess;
  const heroRoleById = useMemo(() => {
    const byId: Record<number, "TANK" | "DPS" | "SUPPORT"> = {};
    for (const hero of heroes) {
      byId[hero.id] = hero.role;
    }
    return byId;
  }, [heroes]);
  const roleBanCounts = useMemo(() => {
    const counts: Record<"TANK" | "DPS" | "SUPPORT", number> = {
      TANK: 0,
      DPS: 0,
      SUPPORT: 0,
    };
    for (const action of draftState.actions || []) {
      if (action.action !== "BAN" || action.gameNumber !== currentGameNumber || action.value === null) continue;
      const role = heroRoleById[action.value];
      if (role) {
        counts[role] += 1;
      }
    }
    return counts;
  }, [draftState.actions, currentGameNumber, heroRoleById]);
  const lockedRoles = (["TANK", "DPS", "SUPPORT"] as const).filter((role) => roleBanCounts[role] >= 2);
  const isRoleLocked = (role: "TANK" | "DPS" | "SUPPORT") => roleBanCounts[role] >= 2;
  const getRoleLimitMessage = (role: "TANK" | "DPS" | "SUPPORT") => `NO MORE ${role} BANS!`;

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
    if (isRoleLocked(hero.role) || !canBanRole(hero.role)) {
      setBanWarning(getRoleLimitMessage(hero.role));
      setTimeout(() => setBanWarning(null), 3000);
      return;
    }
    
    onBanHero(hero.id);
  };

  const [hoveredHero, setHoveredHero] = useState<number | null>(null);
  const [showRamattraOverlay, setShowRamattraOverlay] = useState(false);
  const prevBannedRef = useRef<Set<number>>(new Set());
  const hasInitializedRef = useRef(false);
  const ramattraOverlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isRamattraHero = useCallback((hero: Hero) => {
    const ramattraKey = `${hero.name || ""} ${hero.imgPath || ""}`.toLowerCase();
    const normalizedRamattraKey = ramattraKey.replace(/[^a-z]/g, "");
    return normalizedRamattraKey.includes("ramattra");
  }, []);

  useEffect(() => {
    if (!draftState?.actions) return;

    const currentBanned = new Set<number>(
      draftState.actions
        .filter((action) => action.action === "BAN" && action.gameNumber === currentGameNumber)
        .map((action) => action.value)
        .filter((value): value is number => Number.isInteger(value))
    );

    if (!hasInitializedRef.current) {
      prevBannedRef.current = currentBanned;
      hasInitializedRef.current = true;
      return;
    }

    const newlyBanned = Array.from(currentBanned).filter(
      (heroId) => !prevBannedRef.current.has(heroId)
    );

    if (newlyBanned.length) {
      const ramattraId = heroes.find(isRamattraHero)?.id;
      if (ramattraId && newlyBanned.includes(ramattraId)) {
        setShowRamattraOverlay(true);
        if (ramattraOverlayTimerRef.current) clearTimeout(ramattraOverlayTimerRef.current);
        ramattraOverlayTimerRef.current = setTimeout(() => setShowRamattraOverlay(false), 5000);
      }
    }

    prevBannedRef.current = currentBanned;
  }, [draftState?.actions, currentGameNumber, heroes, isRamattraHero]);

  useEffect(() => {
    return () => {
      if (ramattraOverlayTimerRef.current) clearTimeout(ramattraOverlayTimerRef.current);
    };
  }, []);

  const renderHeroCard = (hero: Hero, canSelect: boolean, banned: boolean) => {
    const roleAtLimit = isRoleLocked(hero.role);
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
        setBanWarning(getRoleLimitMessage(hero.role));
        setTimeout(() => setBanWarning(null), 3000);
        return;
      }
      
      // Otherwise use normal handler
      if (!isDisabled) {
        handleHeroClick(hero);
      }
    };

    const managerLabelTone = prevBannedByBoth
      ? "text-foreground"
      : prevBannedByTeamAOnly
      ? "text-red-300"
      : prevBannedByTeamBOnly
      ? "text-blue-300"
      : "text-muted";

    // Manager-style (including manager-key): previous-game bans are shown "turned off" (full grayscale).
    // The colored top stripe + tooltip still identify which team banned them.
    const managerGrayFilter = !banned && !roleAtLimit && showBanTeamMarkers && wasBannedBefore
      ? "grayscale(100%)"
      : undefined;

    const isRamattra = isRamattraHero(hero);

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
              // Role locked (2 bans already reached for this role in this game)
              : roleAtLimit
              ? "border-muted/50 cursor-not-allowed grayscale"
              // Previous game banned by my team (captain view) - RED tones
              : isCaptain && myTeamBannedBefore
              ? "border-danger/70 cursor-not-allowed"
              // Previous game banned (manager view)
              : showBanTeamMarkers && wasBannedBefore
              ? "border-border/70 cursor-not-allowed"
              : teamDone
              ? "border-border cursor-not-allowed opacity-40"
              : canSelect
              ? "border-border hover:border-danger hover:ring-2 hover:ring-danger/30 cursor-pointer hover:scale-110 hover:z-10"
              // Manager: available heroes stay fully lit. Captain (not their turn): keep dimmed.
              : clsx("border-border cursor-default", !isManager && !isObsKeyAccess && "opacity-60")
          )}
        >
          {!banned && showBanTeamMarkers && wasBannedBefore && (
            <div className="absolute top-1 left-1 z-20 flex items-center gap-1 rounded-full border border-border/70 bg-surface/80 px-1.5 py-1">
              {prevBannedByTeamAOnly && <span className="h-2 w-2 rounded-full bg-red-500" />}
              {prevBannedByTeamBOnly && <span className="h-2 w-2 rounded-full bg-blue-500" />}
              {prevBannedByBoth && (
                <>
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                </>
              )}
            </div>
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
                  // Role-locked heroes - grayscale for all viewers
                  !banned && roleAtLimit && "grayscale opacity-45",
                  // Previous game banned by my team (captain) - red tint
                  !banned && !roleAtLimit && isCaptain && myTeamBannedBefore && "opacity-60",
                  // Manager-style: previously-banned heroes look "turned off"
                  !banned && !roleAtLimit && showBanTeamMarkers && wasBannedBefore && "opacity-40",
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
            {!banned && !roleAtLimit && isCaptain && myTeamBannedBefore && (
              <div className="absolute inset-0 bg-danger/30" />
            )}
          </div>
          <div className={clsx(
            "px-1 py-0.5 text-center",
            !banned && (wasBannedBefore || roleAtLimit) ? "bg-surface-elevated" : "bg-background"
          )}>
            <span className={clsx(
              "text-[10px] truncate block font-semibold leading-tight",
              roleAtLimit ? "text-muted" : !banned && wasBannedBefore ? managerLabelTone : "text-foreground"
            )}>
              {hero.name}
            </span>
          </div>
          {/* Current game banned overlay - GRAY */}
          {banned && (
            <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center">
              <span className="text-white font-semibold text-[10px] uppercase">Banned</span>
            </div>
          )}
          {banned && isRamattra && showRamattraOverlay && (
            <img
              src="/NAOOORAMATTRA.gif"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 z-20 w-full h-full object-cover opacity-85 pointer-events-none"
            />
          )}
          {/* Previous game banned overlay for captain - diagonal red lines (ban indicator) */}
          {!banned && !roleAtLimit && isCaptain && myTeamBannedBefore && (
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
        {showBanTeamMarkers && wasBannedBefore && !banned && hoveredHero === hero.id && (
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
        <h4 className={clsx("font-bold text-foreground uppercase tracking-wider", isObsKeyAccess ? "text-xs" : "text-[10px]")}>{title}</h4>
        <div className="flex-1 h-px bg-border" />
        <span className={clsx("text-muted", isObsKeyAccess ? "text-xs" : "text-[10px]")}>{heroList.length}</span>
      </div>
      <div className={clsx(
        "grid gap-1.5",
        isObsKeyAccess
          ? "grid-cols-5 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-10 2xl:grid-cols-12"
          : "grid-cols-7 sm:grid-cols-9 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 2xl:grid-cols-16"
      )}>
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
    const slotSizeClass = isObsKeyAccess ? "w-32 h-36" : "w-24 h-28";
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
            "rounded-xl border-2 flex items-center justify-center",
            slotSizeClass,
            colorClasses.border,
            colorClasses.slotBg
          )}
        >
          <span className={clsx(isObsKeyAccess ? "text-sm" : "text-[11px]", "font-bold uppercase", colorClasses.text)}>Skip</span>
        </div>
      );
    }
    
    const hero = getHeroById(heroId);
    return (
      <div
        key={heroId}
        className={clsx("rounded-xl overflow-hidden border-2", slotSizeClass, colorClasses.border, colorClasses.bg)}
      >
        {hero?.imgPath ? (
          <>
            <img
              src={resolveHeroImageUrl(hero.imgPath)}
              alt={hero.name}
              className={clsx("w-full object-contain grayscale", isObsKeyAccess ? "h-24" : "h-20")}
            />
            <div className={clsx("px-1 bg-background/80", isObsKeyAccess ? "py-2" : "py-1.5")}>
              <p className={clsx(isObsKeyAccess ? "text-sm" : "text-[11px]", "font-semibold text-center truncate", colorClasses.text)}>
                {hero.name}
              </p>
            </div>
          </>
        ) : (
          <div className={clsx("w-full flex items-center justify-center", isObsKeyAccess ? "h-28" : "h-24")}>
            <span className={clsx(isObsKeyAccess ? "text-base" : "text-sm", "font-bold", colorClasses.text)}>#{heroId}</span>
          </div>
        )}
      </div>
    );
  };

  // Render empty ban slot (square)
  const renderEmptySlot = (slotNum: number) => (
    <div
      className={clsx(
        "rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-surface-elevated/30",
        isObsKeyAccess ? "w-32 h-36" : "w-24 h-28"
      )}
    >
      <span className={clsx(isObsKeyAccess ? "text-base" : "text-sm", "text-muted")}>{slotNum}</span>
    </div>
  );

  return (
    <div className="min-h-[85vh] flex flex-col">
      {/* Warning Toast */}
      {banWarning && (
        <div className={clsx(toastPositionClass, "top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in")}>
          <div className="bg-danger text-danger-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
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
          <div
            className={clsx(
              "inline-flex items-center gap-4 bg-gradient-to-r from-primary/10 to-accent/10 border-2 border-primary/50 rounded-lg shadow-lg shadow-primary/20",
              isObsKeyAccess ? "px-8 py-4" : "px-6 py-3"
            )}
          >
            <span className={clsx("text-primary uppercase tracking-widest font-bold", isObsKeyAccess ? "text-sm" : "text-xs")}>
              Playing On
            </span>
            <span className={clsx("font-black text-foreground", isObsKeyAccess ? "text-3xl" : "text-2xl")}>
              {currentMap.description}
            </span>
            <Badge variant="primary" className={clsx(isObsKeyAccess ? "text-sm px-4 py-1.5" : "px-3 py-1")}>
              {currentMap.type}
            </Badge>
          </div>
        )}
      </div>

      {/* Full Width Layout - Team A Bans | Hero Grid | Team B Bans */}
      <div className={clsx(
        "flex-1 grid",
        isObsKeyAccess
          ? "grid-cols-[220px_minmax(0,1fr)_220px] xl:grid-cols-[260px_minmax(0,1fr)_260px] gap-6"
          : "grid-cols-[140px_minmax(0,1fr)_140px] xl:grid-cols-[180px_minmax(0,1fr)_180px] gap-4"
      )}>
        {/* LEFT - Team A: big logo on top, rectangle with name + bans below */}
        <div className="flex flex-col gap-4 h-fit">
          <div className={clsx(
            "w-full aspect-square rounded-full overflow-hidden border-2 transition-all bg-surface-elevated",
            isTeamATurn
              ? "border-red-500 animate-turn-glow-red"
              : "border-red-500/50"
          )}>
            {teamA?.logo ? (
              <img src={resolveGenericBackendAsset(teamA.logo)} alt={teamA.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full bg-red-500/20 flex items-center justify-center">
                <span className={clsx("font-black text-red-300", isObsKeyAccess ? "text-6xl" : "text-5xl")}>
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
              <span className={clsx("font-bold text-red-200 text-center leading-tight uppercase tracking-wide break-words", isObsKeyAccess ? "text-lg" : "text-base")}>
                {teamA?.name}
              </span>
              {isTeamATurn && (
                <Badge variant="danger" className={clsx("px-2 animate-pulse", isObsKeyAccess ? "text-sm" : "text-[10px]")}>Banning</Badge>
              )}
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
              <span className={clsx("font-bold text-foreground uppercase tracking-wide", isObsKeyAccess ? "text-base" : "text-sm")}>
                Hero Bans
              </span>
              {isCaptain && isMyTurn && myTeamId && getTeamTotalBans(myTeamId) < 2 && (
                <Badge variant="warning" className={clsx("animate-pulse-glow", isObsKeyAccess ? "text-sm" : "text-xs")}>Your Turn</Badge>
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
                  className={clsx(
                    isObsKeyAccess ? "text-sm px-4" : "text-xs px-3",
                    role !== "ALL" && isRoleLocked(role) && "text-danger"
                  )}
                >
                  {role === "ALL" ? "All" : role}
                </Button>
              ))}
            </div>
          </div>

          {/* Status Messages */}
          {lockedRoles.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {lockedRoles.map((role) => (
                <div
                  key={role}
                  className="rounded-lg border border-danger/60 bg-danger/15 px-3 py-1.5"
                >
                  <p className={clsx("font-bold uppercase tracking-wide text-danger", isObsKeyAccess ? "text-sm" : "text-xs")}>
                    {getRoleLimitMessage(role)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {isCaptain && myTeamId && getTeamTotalBans(myTeamId) >= 2 && (
            <div className="mb-3 p-2 rounded-lg bg-success/10 border border-success/30 text-center">
              <p className={clsx("text-success font-semibold", isObsKeyAccess ? "text-sm" : "text-xs")}>
                Your team has completed both bans
              </p>
            </div>
          )}
          
          {isCaptain && !isMyTurn && myTeamId && getTeamTotalBans(myTeamId) < 2 && (
            <div className="mb-3 p-2 rounded-lg bg-surface-elevated border border-border text-center">
              <p className={clsx("text-muted", isObsKeyAccess ? "text-sm" : "text-xs")}>
                Waiting for {currentTeam?.name} to ban...
              </p>
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
              <div className={clsx(
                "grid gap-1.5",
                isObsKeyAccess
                  ? "grid-cols-6 sm:grid-cols-7 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-14"
                  : "grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 2xl:grid-cols-16"
              )}>
                {heroes.filter((h) => h.role === selectedRole).map((hero) => {
                  const banned = isHeroBanned(hero.id);
                  const myTeamBannedBefore = wasHeroBannedByMyTeamBefore(hero.id);
                  const canSelect = isCaptain && isMyTurn && !banned && !myTeamBannedBefore && canBanRole(hero.role);
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
                className={clsx("text-muted hover:text-foreground", isObsKeyAccess ? "text-sm" : "text-xs")}
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
              <img src={resolveGenericBackendAsset(teamB.logo)} alt={teamB.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full bg-blue-500/20 flex items-center justify-center">
                <span className={clsx("font-black text-blue-300", isObsKeyAccess ? "text-6xl" : "text-5xl")}>
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
              <span className={clsx("font-bold text-blue-200 text-center leading-tight uppercase tracking-wide break-words", isObsKeyAccess ? "text-lg" : "text-base")}>
                {teamB?.name}
              </span>
              {isTeamBTurn && (
                <Badge variant="danger" className={clsx("px-2 animate-pulse", isObsKeyAccess ? "text-sm" : "text-[10px]")}>Banning</Badge>
              )}
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

// ==================== PLAYING PHASE ====================

function PlayingPhase({
  draftState,
  teams,
  isManager,
  isObsKeyAccess,
  getHeroById,
  getBannedHeroesByTeam,
  onEndGame,
  actionLoading,
}: {
  draftState: DraftState;
  teams: Team[];
  isManager: boolean;
  isObsKeyAccess: boolean;
  getHeroById: (heroId: number) => Hero | null;
  getBannedHeroesByTeam: (teamId: number) => (number | null)[];
  onEndGame: () => void;
  actionLoading: boolean;
}) {
  const teamA = teams.find((t) => t.id === draftState.match.teamAId);
  const teamB = teams.find((t) => t.id === draftState.match.teamBId);
  const currentMap = draftState.allMaps?.find((m) => m.id === draftState.currentMapId);
  const teamABans = teamA ? getBannedHeroesByTeam(teamA.id) : [];
  const teamBBans = teamB ? getBannedHeroesByTeam(teamB.id) : [];

  const renderBanSlot = (heroId: number | null | undefined, index: number, side: "A" | "B") => {
    const borderClass = side === "A" ? "border-[color:var(--color-team-a)]/55" : "border-[color:var(--color-team-b)]/55";
    const accentClass = side === "A" ? "text-[color:var(--color-team-a)]" : "text-[color:var(--color-team-b)]";

    if (heroId === null) {
      return (
        <div
          key={`no-ban-${side}-${index}`}
          className={clsx("min-w-0 overflow-hidden rounded-lg border bg-surface-elevated/70", borderClass)}
        >
          <div className={clsx("flex aspect-[4/3] items-center justify-center text-xs font-black uppercase", accentClass)}>
            No Ban
          </div>
          <p className="truncate border-t border-border px-2 py-1.5 text-center text-[10px] font-semibold uppercase text-muted">
            Slot {index + 1}
          </p>
        </div>
      );
    }

    if (heroId === undefined) {
      return (
        <div
          key={`empty-ban-${side}-${index}`}
          className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface-elevated/40"
        >
          <div className="flex aspect-[4/3] items-center justify-center text-2xl font-black text-muted/50">?</div>
          <p className="truncate border-t border-border px-2 py-1.5 text-center text-[10px] font-semibold uppercase text-muted">
            Ban {index + 1}
          </p>
        </div>
      );
    }

    const hero = getHeroById(heroId);
    return (
      <div
        key={`ban-${side}-${heroId}-${index}`}
        className={clsx("min-w-0 overflow-hidden rounded-lg border bg-danger/10", borderClass)}
      >
        <div className="relative aspect-[4/3] bg-surface-elevated">
          {hero?.imgPath ? (
            <img
              src={resolveHeroImageUrl(hero.imgPath)}
              alt={hero.name}
              className="h-full w-full object-cover grayscale"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-black text-danger">#{heroId}</div>
          )}
          <div className="absolute inset-0 bg-danger/10" />
          <span className="absolute right-1.5 top-1.5 rounded bg-danger px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
            Banned
          </span>
        </div>
        <p className="truncate border-t border-danger/30 px-2 py-1.5 text-center text-xs font-bold uppercase text-danger">
          {hero?.name || `Hero ${heroId}`}
        </p>
      </div>
    );
  };

  const renderTeamBans = (team: Team | undefined, bans: (number | null)[], side: "A" | "B") => {
    const borderClass = side === "A" ? "border-[color:var(--color-team-a)]/50" : "border-[color:var(--color-team-b)]/50";
    const accentClass = side === "A" ? "text-[color:var(--color-team-a)]" : "text-[color:var(--color-team-b)]";
    const slots = [bans[0], bans[1]];

    return (
      <section className={clsx("rounded-lg border bg-surface-elevated/45 p-3", borderClass)}>
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <div className={clsx("grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border bg-surface-elevated", borderClass)}>
            {team?.logo ? (
              <img src={resolveGenericBackendAsset(team.logo)} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <span className={clsx("text-sm font-black", accentClass)}>{team?.name?.charAt(0) || side}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className={clsx("truncate text-sm font-black uppercase", accentClass)}>{team?.name || `Team ${side}`}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Bans this game</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {slots.map((heroId, index) => renderBanSlot(heroId, index, side))}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center gap-8">
      {/* Game is Playing Display */}
      <Card variant="featured" className={clsx("w-full", isObsKeyAccess ? "max-w-4xl" : "max-w-2xl")}>
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <p className={clsx("text-muted mb-2 uppercase tracking-wide", isObsKeyAccess ? "text-base" : "text-sm")}>
              Now Playing
            </p>
            <h1 className={clsx("font-black mb-4", isObsKeyAccess ? "text-5xl md:text-6xl" : "text-4xl md:text-5xl")}>
              <span className="text-[color:var(--color-team-a)]">{teamA?.name}</span>
              <span className="text-muted mx-4">vs</span>
              <span className="text-[color:var(--color-team-b)]">{teamB?.name}</span>
            </h1>
          </div>

          {/* Map Display */}
          {currentMap && (
            <div className="mb-8">
              <div className="rounded-xl overflow-hidden border-2 border-primary/50 shadow-lg">
                <MapImage
                  src={currentMap.imgPath ? resolveMapImageUrl(currentMap.imgPath) : null}
                  alt={currentMap.description}
                  fallbackInitial={currentMap.description.charAt(0)}
                  className={clsx("w-full", isObsKeyAccess ? "h-80" : "h-64")}
                />
              </div>
              <p className={clsx("text-center mt-4 font-semibold", isObsKeyAccess ? "text-xl" : "text-lg")}>
                {currentMap.description}
              </p>
              <p className={clsx("text-center text-muted mt-1", isObsKeyAccess ? "text-base" : "text-sm")}>
                Map Type: {currentMap.type}
              </p>
            </div>
          )}

          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {renderTeamBans(teamA, teamABans, "A")}
            {renderTeamBans(teamB, teamBBans, "B")}
          </div>

          {/* Game Ended Button - Only Manager Can End Game */}
          {isManager && (
            <div className="flex justify-center">
              <Button
                size="lg"
                className={clsx("bg-success hover:bg-success/90", isObsKeyAccess ? "px-10 text-lg" : "px-8")}
                onClick={onEndGame}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Game Ended"}
              </Button>
            </div>
          )}

          {!isManager && (
            <div className="text-center text-muted">
              <p className={clsx(isObsKeyAccess ? "text-base" : "text-sm")}>
                Waiting for manager to mark game as ended...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
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
  isObsKeyAccess,
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
  isObsKeyAccess: boolean;
}) {
  const winsNeeded = getRequiredWins(draftState.match);
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

  const actionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isManager) return;
    const timeout = setTimeout(() => {
      actionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => clearTimeout(timeout);
  }, [isManager]);

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* PLAYING ON MAP - Central Hero Display */}
      {currentMap && (
        <div className="flex-1 flex flex-col items-center justify-center py-8">
          <div className="text-center mb-6">
            <p className={clsx("text-primary uppercase tracking-widest font-bold mb-2 animate-pulse", isObsKeyAccess ? "text-xl" : "text-lg")}>
              Playing On Map...
            </p>
            <div className={clsx("relative w-full rounded-2xl overflow-hidden border-4 border-primary shadow-2xl shadow-primary/40", isObsKeyAccess ? "max-w-4xl" : "max-w-2xl")}>
              <MapImage
                src={currentMap.imgPath ? resolveMapImageUrl(currentMap.imgPath) : null}
                alt={currentMap.description}
                fallbackInitial={currentMap.description.charAt(0)}
                className="w-full aspect-video"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-center">
                <p className={clsx("font-black text-white mb-2", isObsKeyAccess ? "text-5xl" : "text-4xl")}>
                  {currentMap.description}
                </p>
                <Badge variant="primary" className={clsx(isObsKeyAccess ? "text-xl px-5 py-2.5" : "text-lg px-4 py-2")}>
                  {currentMap.type}
                </Badge>
              </div>
            </div>
          </div>

          {/* Score Display */}
          <div className="flex items-center justify-center gap-8 mb-6">
            <div className="text-center">
              <div className={clsx("rounded-full bg-[color:var(--color-team-a)]/30 border-2 border-[color:var(--color-team-a)] flex items-center justify-center mx-auto mb-2", isObsKeyAccess ? "w-16 h-16" : "w-12 h-12")}>
                <span className={clsx("font-bold text-[color:var(--color-team-a)]", isObsKeyAccess ? "text-2xl" : "text-lg")}>
                  {teamA?.name?.charAt(0) || "A"}
                </span>
              </div>
              <p className={clsx("text-foreground font-semibold mb-1", isObsKeyAccess ? "text-base" : "text-sm")}>
                {teamA?.name}
              </p>
              <p className={clsx("font-bold text-[color:var(--color-team-a)]", isObsKeyAccess ? "text-4xl" : "text-3xl")}>
                {teamAWins}
              </p>
            </div>
            <div className={clsx("text-muted font-bold", isObsKeyAccess ? "text-4xl" : "text-3xl")}>-</div>
            <div className="text-center">
              <div className={clsx("rounded-full bg-[color:var(--color-team-b)]/30 border-2 border-[color:var(--color-team-b)] flex items-center justify-center mx-auto mb-2", isObsKeyAccess ? "w-16 h-16" : "w-12 h-12")}>
                <span className={clsx("font-bold text-[color:var(--color-team-b)]", isObsKeyAccess ? "text-2xl" : "text-lg")}>
                  {teamB?.name?.charAt(0) || "B"}
                </span>
              </div>
              <p className={clsx("text-foreground font-semibold mb-1", isObsKeyAccess ? "text-base" : "text-sm")}>
                {teamB?.name}
              </p>
              <p className={clsx("font-bold text-[color:var(--color-team-b)]", isObsKeyAccess ? "text-4xl" : "text-3xl")}>
                {teamBWins}
              </p>
            </div>
          </div>

          <p className={clsx("text-muted", isObsKeyAccess ? "text-sm" : "text-xs")}>
            Game {currentGameNumber} | Best of {getSeriesLength(draftState.match)} | First to {winsNeeded}
          </p>
        </div>
      )}

      {/* Bottom Actions */}
      <div ref={actionsRef} className="border-t border-border pt-6">
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
  canResetMatch,
  onRequestResetMatch,
  actionLoading,
}: {
  draftState: DraftState;
  teams: Team[];
  canResetMatch: boolean;
  onRequestResetMatch: () => void;
  actionLoading: boolean;
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

          {canResetMatch && (
            <div className="mt-8 rounded-lg border border-danger/40 bg-danger/10 p-4 text-left">
              <p className="text-sm font-bold text-danger">Need to roll this back?</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Reset sends the match back to schedule and clears the draft, score, timers, stats and standings changes.
              </p>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={onRequestResetMatch}
                disabled={actionLoading}
                className="mt-4 w-full"
              >
                Reset to schedule
              </Button>
            </div>
          )}
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
  isObsKeyAccess,
}: {
  draftState: DraftState;
  teams: Team[];
  getHeroById: (heroId: number) => Hero | null;
  isObsKeyAccess: boolean;
}) {
  const actions = draftState.actions || [];
  const maps = draftState.allMaps || [];
  const [activeGameIndex, setActiveGameIndex] = useState(0);
  const teamA = teams.find((t) => t.id === draftState.match.teamAId);
  const teamB = teams.find((t) => t.id === draftState.match.teamBId);

  const getTeamName = (teamId: number) =>
    teams.find((t) => t.id === teamId)?.name || `Team ${teamId}`;

  const gameSlides = useMemo(
    () => {
      const groupedActions = actions.reduce((acc, action) => {
        if (!acc[action.gameNumber]) acc[action.gameNumber] = [];
        acc[action.gameNumber].push(action);
        return acc;
      }, {} as Record<number, typeof actions>);

      return (
        Object.entries(groupedActions)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([gameNum, gameActions]) => {
            const sortedActions = [...gameActions].sort((a, b) => a.order - b.order);
            const pickAction = sortedActions.find((action) => action.action === "PICK") ?? null;
            const pickedMapId = pickAction?.value ? Number(pickAction.value) : null;
            const map = pickedMapId ? maps.find((candidate) => candidate.id === pickedMapId) ?? null : null;
            const bans = sortedActions.filter((action) => action.action === "BAN").slice(0, 4);
            while (bans.length < 4) {
              bans.push({
                id: -Number(gameNum) * 10 - bans.length,
                draftId: draftState.id,
                teamId: 0,
                action: "BAN" as const,
                value: null,
                gameNumber: Number(gameNum),
                order: 100 + bans.length,
                createdAt: "",
              });
            }

            return {
              gameNumber: Number(gameNum),
              map,
              pickedMapId,
              pickTeamId: pickAction?.teamId ?? null,
              bans,
            };
          })
      );
    },
    [actions, draftState.id, maps]
  );

  useEffect(() => {
    setActiveGameIndex((current) => Math.min(current, Math.max(0, gameSlides.length - 1)));
  }, [gameSlides.length]);

  useEffect(() => {
    if (gameSlides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActiveGameIndex((current) => (current + 1) % gameSlides.length);
    }, 7000);

    return () => {
      window.clearInterval(timer);
    };
  }, [gameSlides.length]);

  if (actions.length === 0 || gameSlides.length === 0) return null;

  const activeSlide = gameSlides[Math.min(activeGameIndex, gameSlides.length - 1)];
  const cardHeightClass = isObsKeyAccess ? "min-h-[460px]" : "min-h-[520px]";
  const banIconClass = isObsKeyAccess ? "h-36 w-36 sm:h-40 sm:w-40" : "h-28 w-28 sm:h-32 sm:w-32";

  const activeSlideBansByTeam = [
    {
      teamId: draftState.match.teamAId,
      team: teamA,
      title: teamA?.name || getTeamName(draftState.match.teamAId),
      titleClass: "text-[color:var(--color-team-a)]",
      borderClass: "border-[color:var(--color-team-a)]/40",
      bgClass: "bg-[color:var(--color-team-a)]/10",
    },
    {
      teamId: draftState.match.teamBId,
      team: teamB,
      title: teamB?.name || getTeamName(draftState.match.teamBId),
      titleClass: "text-[color:var(--color-team-b)]",
      borderClass: "border-[color:var(--color-team-b)]/40",
      bgClass: "bg-[color:var(--color-team-b)]/10",
    },
  ].map((entry) => ({
    ...entry,
    bans: activeSlide.bans.filter((ban) => ban.teamId === entry.teamId),
  }));

  return (
    <Card variant="featured" className={clsx(isObsKeyAccess ? "mt-0 overflow-hidden bg-card/90" : "mt-8")}>
      <CardHeader className={clsx("flex flex-row items-center justify-between gap-3", isObsKeyAccess && "py-3")}>
        <CardTitle className="text-lg">Draft History</CardTitle>
        {gameSlides.length > 1 && (
          <div className="flex items-center gap-1">
            {gameSlides.map((slide, index) => (
              <button
                key={slide.gameNumber}
                type="button"
                onClick={() => setActiveGameIndex(index)}
                className={clsx(
                  "h-2.5 rounded-full transition-all",
                  index === activeGameIndex ? "w-8 bg-primary" : "w-2.5 bg-muted/40 hover:bg-muted/70"
                )}
                aria-label={`Show game ${slide.gameNumber}`}
              />
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className={isObsKeyAccess ? "pb-4" : undefined}>
        <div className={clsx("relative overflow-hidden rounded-lg border border-border bg-background/70", cardHeightClass)}>
          {activeSlide.map?.imgPath ? (
            <img
              src={resolveMapImageUrl(activeSlide.map.imgPath)}
              alt={activeSlide.map.description}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-surface-elevated" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-background/92 via-background/70 to-background/35" />
          <div className={clsx("relative z-10 h-full flex flex-col", isObsKeyAccess ? "p-4" : "p-4 sm:p-6")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Game {activeSlide.gameNumber}</p>
                <h4 className={clsx("mt-1 font-bold text-foreground", isObsKeyAccess ? "text-3xl" : "text-2xl")}>
                  {activeSlide.map?.description ?? (activeSlide.pickedMapId ? `Map #${activeSlide.pickedMapId}` : "Map pending")}
                </h4>
                {activeSlide.map?.type && (
                  <p className="mt-1 text-sm font-medium uppercase tracking-wide text-primary">{activeSlide.map.type}</p>
                )}
              </div>
              {activeSlide.pickTeamId && (
                <Badge variant="success" className="shrink-0">
                  Picked by {getTeamName(activeSlide.pickTeamId)}
                </Badge>
              )}
            </div>

            <div className="mt-6 flex-1 overflow-hidden">
              <div className={clsx("grid h-full gap-4", isObsKeyAccess ? "grid-cols-2" : "grid-cols-1 lg:grid-cols-2")}>
                {activeSlideBansByTeam.map((teamSection) => (
                  <div
                    key={teamSection.teamId}
                    className={clsx(
                      "flex h-full flex-col rounded-2xl border bg-background/55 p-4 shadow-xl shadow-black/25 backdrop-blur-sm",
                      teamSection.borderClass,
                      teamSection.bgClass
                    )}
                  >
                    <div className="mb-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-muted">Banned by</p>
                      <h5 className={clsx("mt-1 font-black uppercase tracking-wide", isObsKeyAccess ? "text-2xl" : "text-xl", teamSection.titleClass)}>
                        {teamSection.title}
                      </h5>
                    </div>

                    <div className="flex flex-wrap gap-4">
                      {teamSection.bans.length > 0 ? (
                        teamSection.bans.map((ban, index) => {
                          const hero = ban.value ? getHeroById(ban.value) : null;
                          const teamName = ban.teamId ? getTeamName(ban.teamId) : "No Ban";

                          return (
                            <div
                              key={`${activeSlide.gameNumber}-ban-${ban.id}-${index}`}
                              className={clsx(
                                "relative shrink-0 overflow-hidden rounded-2xl border border-danger/40 bg-danger/10 shadow-md shadow-black/30",
                                banIconClass
                              )}
                              title={`${teamName}: ${hero?.name ?? "No Ban"}`}
                            >
                              {hero?.imgPath ? (
                                <>
                                  <img
                                    src={resolveHeroImageUrl(hero.imgPath)}
                                    alt={hero.name}
                                    className="h-[78%] w-full object-cover grayscale"
                                  />
                                  <div className="flex h-[22%] items-center justify-center bg-background/80 px-2 text-center">
                                    <p className={clsx("font-semibold text-foreground truncate", isObsKeyAccess ? "text-sm" : "text-xs")}>
                                      {hero.name}
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <div className="flex h-full w-full items-center justify-center border border-dashed border-border/70 text-sm font-semibold uppercase tracking-wide text-muted">
                                  No Ban
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex h-full min-h-40 w-full items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/40 text-sm font-semibold uppercase tracking-wide text-muted">
                          No bans recorded
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
