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
  pickMapType,
  yieldPlayoffFirstPick,
  pickMap,
  startBan,
  banHero,
  endGame,
  type DraftState,
  type GameMap,
  type Hero,
  type MapType,
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
import { DraftStage, TeamRail, teamVars, type TeamSide } from "@/components/draft/DraftStage";
import { BanTile, type HeroTileState } from "@/components/draft/BanTile";
import { BanSlot, EmptyBanSlot } from "@/components/draft/BanRail";
import { BanCeremony, type BanCeremonyRequest } from "@/components/draft/BanCeremony";
import { MapTypeIcon, MapTypePlate, MAP_TYPE_LABEL } from "@/components/draft/MapTypePlate";
import stageStyles from "@/components/draft/draft-stage.module.css";
import waitingStyles from "@/components/draft/waiting-room.module.css";
import playing from "@/components/draft/playing-stage.module.css";
import { isBracketMatch, getRequiredWins, getSeriesLength } from "@/lib/match-format";
import { useDraftTableDevData } from "@/app/draft-table-dev/DraftTableDevContext";
import {
  banDraftTableDevHero,
  createDraftTableDevState,
  createDraftTableDevTeams,
  endDraftTableDevGame,
  pickDraftTableDevMap,
  pickDraftTableDevMapType,
  readyNextDraftTableDevCaptain,
  startDraftTableDevBans,
  startDraftTableDevMapPicking,
  submitDraftTableDevResult,
  undoDraftTableDevResult,
  yieldDraftTableDevFirstPick,
  type DraftTableDevData,
} from "@/app/draft-table-dev/demo-data";

const POLL_INTERVAL = 3000;
const TURN_DURATION = 95;
const KEY_CANVAS_WIDTH = 1920;
const KEY_CANVAS_HEIGHT = 1080;
const KEY_CONTENT_MAX_WIDTH = "max-w-[1840px]";

type Phase = "STARTING" | "MAPTYPEPICKING" | "MAPPICKING" | "BAN" | "PLAYING" | "ENDMAP" | "FINISHED";
// Phase changes used to open a blocking 5-second countdown card. It hid the
// board on every transition, so it is gone: phases now animate themselves in
// and bans announce through a lower third that leaves the draft visible.
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

export default function DraftTablePage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated, clearSession } = useSession();
  const searchParams = useSearchParams();
  const urlKey = searchParams?.get("key");
  const devData = useDraftTableDevData();
  const isDevDemo = Boolean(devData);

  const matchId = devData?.match.id ?? Number(params.matchId);
  const isObsKeyAccess = Boolean(urlKey);

  const [draftState, setDraftState] = useState<DraftState | null>(() =>
    devData ? createDraftTableDevState(devData) : null
  );
  const draftId = draftState?.id;
  const [teams, setTeams] = useState<Team[]>(() =>
    devData ? createDraftTableDevTeams(devData) : []
  );
  const [loading, setLoading] = useState(!devData);
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
  // Bans are announced one at a time, center stage. Two bans landing in the
  // same poll queue rather than overlapping.
  const [ceremonyQueue, setCeremonyQueue] = useState<BanCeremonyRequest[]>([]);
  const [activeCeremony, setActiveCeremony] = useState<BanCeremonyRequest | null>(null);
  const [keyFitScale, setKeyFitScale] = useState(1);
  const [shareOverlayOpen, setShareOverlayOpen] = useState(false);
  const [shareInfo, setShareInfo] = useState<{ matchId: number; key: string; url: string } | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [networkUser, setNetworkUser] = useState<NetworkSessionUser | null>(null);

  // The positioned box a ban portrait flies across. In the broadcast view this
  // sits inside a scaled canvas, which BanCeremony corrects for.
  const draftCanvasRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const actionErrorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const seenActionIdsRef = useRef<Set<number>>(new Set());
  const hasInitializedActionsRef = useRef(false);

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

  const isManager = isDevDemo || Boolean(networkUser?.roles.some((role) => role === "SOCIAL_MEDIA" || role === "ADMIN"));
  const isAdmin = isDevDemo || Boolean(networkUser?.roles.includes("ADMIN"));
  // Destructive operational actions (full match reset) are open to both roles.
  const canResetMatch = isManager || isAdmin;
  const isCaptain = isDevDemo || user?.role === "CAPTAIN";
  const isKeyAccess = isObsKeyAccess;
  const shouldRenderCompactHeader = true;
  const myTeamId = isDevDemo
    ? draftState?.currentTurnTeamId ?? devData?.match.initialPickerTeamId
    : user?.teamId;
  const isMyTurn = draftState?.currentTurnTeamId === myTeamId;
  const currentPhase = draftState?.phase as Phase;
  const isMapSelectionLocked = currentPhase === "MAPPICKING" && Boolean(draftState?.currentMapId);
  const isCeremonyActive = Boolean(activeCeremony);
  const overlayPositionClass = isKeyAccess ? "absolute" : "fixed";
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

  const updateDemoState = (
    transition: (state: DraftState, data: DraftTableDevData) => DraftState
  ): boolean => {
    if (!isDevDemo || !devData || !draftState) return false;
    try {
      setDraftState(transition(draftState, devData));
      setActionError(null);
    } catch (err) {
      showActionError(getRequestErrorMessage(err, "The local demo action could not be completed."));
    }
    return true;
  };

  useEffect(() => {
    return () => {
      if (actionErrorTimerRef.current) clearTimeout(actionErrorTimerRef.current);
    };
  }, []);

  // Show draft history once the match or draft has finished.
  const showDraftHistory = matchStatus === "FINISHED" || currentPhase === "FINISHED";

  // Check if I'm ready (for captains)
  const amIReady = isDevDemo
    ? draftState?.match?.teamAready === 1 && draftState?.match?.teamBready === 1
    : isCaptain && myTeamId === teamA?.id
      ? draftState?.match?.teamAready === 1
      : draftState?.match?.teamBready === 1;

  useEffect(() => {
    if (isDevDemo) return;
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
  }, [isDevDemo, isHydrated, isAuthenticated, matchId, urlKey]);

  useEffect(() => {
    if (isDevDemo) return;
    if (!draftState || currentPhase === "FINISHED") return;
    if (!isAuthenticated && !urlKey) return;
    pollRef.current = setInterval(() => {
      fetchDraftState();
    }, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isDevDemo, draftState, currentPhase, isAuthenticated, urlKey]);

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
    if (!draftState || !["MAPTYPEPICKING", "MAPPICKING", "BAN"].includes(currentPhase ?? "")) {
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
    if (isMatchPaused || actionLoading || isCeremonyActive) {
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [draftState?.remainingSeconds, currentPhase, isMatchPaused, actionLoading, isMapSelectionLocked, isCeremonyActive]);

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
    if (isDevDemo) return;
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
    if (updateDemoState(startDraftTableDevMapPicking)) return;
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
    if (updateDemoState(yieldDraftTableDevFirstPick)) return;
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

  async function handlePickMapType(mapType: MapType) {
    if (updateDemoState((state, data) => pickDraftTableDevMapType(state, data, mapType))) return;
    if (!token) {
      showActionError(SESSION_EXPIRED_MESSAGE);
      return;
    }
    if (!draftId) {
      showActionError("Draft no disponible todavia. Recarga la pagina e intenta otra vez.");
      return;
    }
    if (!isMyTurn) {
      showActionError("No es tu turno de escoger el tipo de mapa.");
      await fetchDraftState();
      return;
    }

    setActionLoading(true);
    try {
      const updated = await pickMapType(token, draftId, {
        mapType,
        teamId: myTeamId ?? undefined,
      });
      setDraftState(updated);
      setActionError(null);
    } catch (err) {
      handleRequestFailure(
        "Failed to pick map type:",
        err,
        "No se pudo escoger el tipo de mapa."
      );
      await fetchDraftState();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartBan() {
    if (updateDemoState(startDraftTableDevBans)) return;
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
    if (updateDemoState(endDraftTableDevGame)) return;
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
    if (updateDemoState((state, data) => pickDraftTableDevMap(state, data, mapId))) return;
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
    if (updateDemoState((state, data) => banDraftTableDevHero(state, data, heroId))) return;
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
    if (updateDemoState((state, data) => submitDraftTableDevResult(state, data, winnerTeamId))) return;
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
    if (updateDemoState(undoDraftTableDevResult)) return;
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
    if (isDevDemo && devData) {
      setDraftState(createDraftTableDevState(devData));
      setTeams(createDraftTableDevTeams(devData));
      setResetConfirmOpen(false);
      setActionError(null);
      return;
    }
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
    if (updateDemoState(readyNextDraftTableDevCaptain)) return;
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

  const enqueueCeremony = useCallback((ceremony: BanCeremonyRequest) => {
    setCeremonyQueue((prev) => [...prev, ceremony]);
  }, []);

  const getTeamById = useCallback(
    (teamId?: number | null) => teams.find((team) => team.id === teamId),
    [teams]
  );

  // Left rail is always team A, right rail always team B. Everything that
  // needs a team color derives it from this instead of hardcoding a hue.
  const sideForTeam = useCallback(
    (teamId?: number | null): TeamSide => (teamId === teamB?.id ? "B" : "A"),
    [teamB?.id]
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
    if (activeCeremony || ceremonyQueue.length === 0) return;
    setActiveCeremony(ceremonyQueue[0]);
    setCeremonyQueue((prev) => prev.slice(1));
  }, [activeCeremony, ceremonyQueue]);

  const handleCeremonyComplete = useCallback((key: string) => {
    setActiveCeremony((current) => (current?.key === key ? null : current));
  }, []);

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
      seenActionIdsRef.current.add(action.id);

      if (action.gameNumber !== currentGameNumber) return;
      if (action.action !== "BAN") return;

      // A skipped turn has nothing to show. It still fills the rail slot.
      const hero = action.value ? getHeroById(action.value) : null;
      if (!hero) return;

      const team = getTeamById(action.teamId);
      // The slot it flies to is however many bans that team had already spent.
      const slotIndex = (draftState.actions || []).filter(
        (other) =>
          other.action === "BAN" &&
          other.teamId === action.teamId &&
          other.gameNumber === action.gameNumber &&
          other.order < action.order
      ).length;

      enqueueCeremony({
        key: `ban-${action.id}`,
        heroName: hero.name,
        imgPath: hero.imgPath ?? null,
        teamName: team?.name || "Unknown team",
        side: action.teamId === draftState.match.teamBId ? "B" : "A",
        teamId: action.teamId,
        slotIndex,
      });
    });
  }, [draftState?.actions, currentGameNumber, enqueueCeremony, getHeroById, getTeamById]);

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

  if ((!isDevDemo && !isHydrated) || loading) {
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
      <div ref={draftCanvasRef} className="relative w-full h-full">
        <BanCeremony
          request={activeCeremony}
          containerRef={draftCanvasRef}
          onComplete={handleCeremonyComplete}
        />

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
                  {(currentPhase === "MAPTYPEPICKING" || currentPhase === "BAN" || currentPhase === "MAPPICKING") && !isMapSelectionLocked && (
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

        {currentPhase === "MAPTYPEPICKING" && (
          <MapTypePickingPhase
            isCaptain={isCaptain}
            isMyTurn={isMyTurn}
            draftState={draftState}
            teams={teams}
            onPickMapType={handlePickMapType}
            actionLoading={actionLoading}
            isObsKeyAccess={isObsKeyAccess}
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
            getPreviousGameBanInfo={getPreviousGameBanInfo}
            getHeroBanInfo={getHeroBanInfo}
            getBannedHeroesByTeam={getBannedHeroesByTeam}
            getTeamTotalBans={getTeamTotalBans}
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

      {isCaptain && !isDevDemo && !isObsKeyAccess && (
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
              {isDevDemo ? "Local demo" : "Destructive action"}
            </p>
            <h2 id="reset-match-title" className="mt-1 text-2xl font-black text-foreground">
              Reset match #{matchId}?
            </h2>
            {isDevDemo ? (
              <p className="mt-3 text-sm leading-relaxed text-muted">
                This restores the ignored fixture and restarts the local rehearsal at captain check-in.
              </p>
            ) : (
              <>
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
              </>
            )}

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

      {isManager && !isDevDemo && (
        <div className={clsx(floatingPositionClass, "right-6 z-40", isObsKeyAccess ? "top-6" : "bottom-6")}>
          <Button size="sm" variant="secondary" onClick={() => toggleNavbar(!isNavHidden)}>
            {isNavHidden ? "Show header" : "Hide header"}
          </Button>
        </div>
      )}

      {/* Captain pause request button — wired to backend */}
      {!isDevDemo && (currentPhase === "MAPTYPEPICKING" || currentPhase === "MAPPICKING" || currentPhase === "BAN") && isCaptain && !isMatchPaused && (
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
      {!isDevDemo && (currentPhase === "MAPTYPEPICKING" || currentPhase === "MAPPICKING" || currentPhase === "BAN") && isManager && (
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
      {!isDevDemo && isManager && pauseRequestedBy && !isMatchPaused && (
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
  const teamAReady = match.teamAready === 1;
  const teamBReady = match.teamBready === 1;
  const bothReady = teamAReady && teamBReady;
  const isFirstGame = match.gameNumber === 0;
  const canUndoResult = isManager && match.status !== "FINISHED" && (match.mapResults?.length || 0) > 0;

  return (
    <DraftStage
      broadcast={isObsKeyAccess}
      left={
        <TeamRail
          team={teamA}
          side="A"
          ready={teamAReady}
          status={teamAReady ? "Ready" : "Awaiting captain"}
        />
      }
      right={
        <TeamRail
          team={teamB}
          side="B"
          ready={teamBReady}
          status={teamBReady ? "Ready" : "Awaiting captain"}
        />
      }
    >
      <div className={waitingStyles.checkIn}>
        {/*
          Stripped to the point. The rails already carry each team's crest, name
          and check-in state, so the middle only has to say what the lobby is
          waiting on and offer the one control that moves it forward. The meter,
          the run order and the mode explainer all repeated what the rails and
          the next screen already say.
        */}
        <p className={waitingStyles.standby} data-ready={bothReady ? "true" : "false"}>
          {bothReady ? "Both captains ready" : "Waiting for captains"}
        </p>

        <div className={waitingStyles.actions}>
          {isCaptain && !amIReady && (
            <Button size="lg" onClick={onSetReady} disabled={actionLoading} className="px-10">
              {actionLoading ? "Confirming..." : "Confirm team ready"}
            </Button>
          )}
          {isCaptain && amIReady && (
            <span className={waitingStyles.lockedNote}>You are locked in</span>
          )}
          {isManager && (
            <>
              {canUndoResult && (
                <Button size="lg" variant="secondary" onClick={onUndoResult} disabled={actionLoading}>
                  Fix last result
                </Button>
              )}
              <Button size="lg" onClick={onStart} disabled={actionLoading} className="px-10">
                {actionLoading
                  ? "Opening..."
                  : isFirstGame
                  ? "Open Control map picking"
                  : "Open map type picking"}
              </Button>
            </>
          )}
          {canYieldFirstPick && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onYieldFirstPick}
              disabled={actionLoading}
            >
              Yield first choice
            </Button>
          )}
        </div>

        {canResetMatch && (
          <button
            type="button"
            className={waitingStyles.resetLink}
            onClick={onRequestResetMatch}
            disabled={actionLoading}
          >
            Reset match to schedule
          </button>
        )}
      </div>
    </DraftStage>
  );
}

// ==================== MAP TYPE PICKING PHASE ====================

function MapTypePickingPhase({
  isCaptain,
  isMyTurn,
  draftState,
  teams,
  onPickMapType,
  actionLoading,
  isObsKeyAccess,
}: {
  isCaptain: boolean;
  isMyTurn: boolean;
  draftState: DraftState;
  teams: Team[];
  onPickMapType: (mapType: MapType) => void;
  actionLoading: boolean;
  isObsKeyAccess: boolean;
}) {
  const teamA = teams.find((team) => team.id === draftState.match.teamAId);
  const teamB = teams.find((team) => team.id === draftState.match.teamBId);
  const currentTeam = teams.find((team) => team.id === draftState.currentTurnTeamId);
  const isTeamATurn = draftState.currentTurnTeamId === teamA?.id;
  const isTeamBTurn = draftState.currentTurnTeamId === teamB?.id;
  const choosingSide: TeamSide = isTeamBTurn ? "B" : "A";
  const availableMapTypes = draftState.availableMapTypes || draftState.allowedMapTypes || [];
  const mapCounts = draftState.availableMapTypeCounts || {};
  const canChoose = isCaptain && isMyTurn && !actionLoading;
  const gameNumber = (draftState.match.gameNumber || 0) + 1;

  // Held between the click and the next poll so the board reacts immediately:
  // the chosen plate stays lit while the rest fall away.
  const [chosen, setChosen] = useState<MapType | null>(null);

  const handleSelect = (mapType: MapType) => {
    setChosen(mapType);
    onPickMapType(mapType);
  };

  return (
    <DraftStage
      broadcast={isObsKeyAccess}
      left={
        <TeamRail
          team={teamA}
          side="A"
          isTurn={isTeamATurn}
          status={isTeamATurn ? "Choosing" : undefined}
        />
      }
      right={
        <TeamRail
          team={teamB}
          side="B"
          isTurn={isTeamBTurn}
          status={isTeamBTurn ? "Choosing" : undefined}
        />
      }
    >
      <div className={waitingStyles.checkIn}>
        <header className={stageStyles.phaseHead}>
          <span className={stageStyles.phaseEyebrow}>Game {gameNumber} · Map type</span>
          <h2 className={stageStyles.phaseTitle}>
            {(currentTeam?.name || "The previous game's loser") + " picks the mode"}
          </h2>
          <p className={stageStyles.phaseNote}>
            From game two onward the losing team sets the mode, then picks a map inside it.
          </p>
        </header>

        {availableMapTypes.length > 0 ? (
          <div className={stageStyles.plateRow}>
            {availableMapTypes.map((mapType) => (
              <MapTypePlate
                key={mapType}
                mapType={mapType}
                mapCount={mapCounts[mapType] ?? 0}
                side={choosingSide}
                selectable={canChoose && !chosen}
                chosen={chosen === mapType}
                dismissed={Boolean(chosen) && chosen !== mapType}
                onSelect={handleSelect}
              />
            ))}
          </div>
        ) : (
          <div className="max-w-xl border-l-2 border-warning bg-warning/10 px-4 py-3 text-sm text-warning">
            No eligible map types have an unused map in this match pool. Ask a manager to review the pool
            configuration.
          </div>
        )}

        <p className={stageStyles.phaseNote} aria-live="polite">
          {isCaptain
            ? isMyTurn
              ? "Pick a mode to reveal its maps."
              : "Waiting for " + (currentTeam?.name || "the other captain") + "."
            : "Waiting for " + (currentTeam?.name || "the active captain") + " to choose the mode."}
        </p>
      </div>
    </DraftStage>
  );
}
// ==================== MAP PICKING PHASE ====================

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
  isObsKeyAccess,
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
  const selectedMapType = draftState.selectedMapType;
  const gameNumber = (draftState.match.gameNumber || 0) + 1;

  return (
    <DraftStage
      broadcast={isObsKeyAccess}
      left={
        <TeamRail
          team={teamA}
          side="A"
          isTurn={isTeamATurn && !isMapLocked}
          status={isTeamATurn && !isMapLocked ? "Picking" : undefined}
        />
      }
      right={
        <TeamRail
          team={teamB}
          side="B"
          isTurn={isTeamBTurn && !isMapLocked}
          status={isTeamBTurn && !isMapLocked ? "Picking" : undefined}
        />
      }
    >
      <div className={waitingStyles.checkIn}>
        {isMapLocked && currentMap ? (
          <>
            <header className={stageStyles.phaseHead}>
              <span className={stageStyles.phaseEyebrow}>Game {gameNumber} · Map locked</span>
              <h2 className={stageStyles.phaseTitle}>{currentMap.description}</h2>
            </header>
            <div
              className={clsx(
                "relative w-full overflow-hidden border border-border",
                isObsKeyAccess ? "max-w-3xl" : "max-w-xl"
              )}
            >
              <MapImage
                src={currentMap.imgPath ? resolveMapImageUrl(currentMap.imgPath) : null}
                alt={currentMap.description}
                fallbackInitial={currentMap.description.charAt(0)}
                className="aspect-video w-full"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 flex items-center gap-3 p-4">
                <MapTypeIcon mapType={currentMap.type} style={{ width: 32, height: 32 }} />
                <span className={stageStyles.phaseTitle}>{currentMap.description}</span>
              </div>
            </div>
            {isManager ? (
              <Button size="lg" onClick={onStartBan} disabled={actionLoading} className="px-8">
                Start ban phase
              </Button>
            ) : (
              <p className={stageStyles.phaseNote}>
                Map locked. Waiting for the manager to start the ban phase.
              </p>
            )}
          </>
        ) : (
          <>
            <header className={stageStyles.phaseHead}>
              <span className={stageStyles.phaseEyebrow}>
                Game {gameNumber}
                {selectedMapType ? " · " + MAP_TYPE_LABEL[selectedMapType] : ""}
              </span>
              <h2 className={stageStyles.phaseTitle}>
                {(currentTeam?.name || "The active captain") + " picks the map"}
              </h2>
              {selectedMapType && (
                <div className="flex items-center gap-2 pt-1">
                  <MapTypeIcon mapType={selectedMapType} style={{ width: 28, height: 28 }} />
                  <span className={stageStyles.plateMeta}>
                    {availableMaps.length} {availableMaps.length === 1 ? "map" : "maps"} available
                  </span>
                </div>
              )}
            </header>

            <div
              className={clsx(
                "grid w-full gap-3",
                isObsKeyAccess
                  ? "grid-cols-3 gap-6"
                  : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              )}
            >
              {availableMaps.map((map) => {
                const picked = isMapPicked(map.id);
                const canSelect = isCaptain && isMyTurn && !picked && !actionLoading;

                return (
                  <button
                    key={map.id}
                    type="button"
                    onClick={() => canSelect && onPickMap(map.id)}
                    disabled={!canSelect}
                    className={clsx(
                      "group relative overflow-hidden border transition-transform duration-200",
                      picked
                        ? "cursor-not-allowed border-border-subtle opacity-30 grayscale"
                        : canSelect
                        ? "cursor-pointer border-border hover:-translate-y-1 hover:border-accent"
                        : "cursor-default border-border-subtle opacity-60"
                    )}
                  >
                    <MapImage
                      src={map.imgPath ? resolveMapImageUrl(map.imgPath) : null}
                      alt={map.description}
                      fallbackInitial={map.description.charAt(0)}
                      className="aspect-video w-full"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-6">
                      <p className={stageStyles.banSlotName}>{map.description}</p>
                    </div>
                    {picked && (
                      <span className="absolute inset-0 grid place-items-center bg-background/70 font-mono text-[11px] uppercase tracking-widest text-muted">
                        Played
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className={stageStyles.phaseNote} aria-live="polite">
              {isCaptain
                ? isMyTurn
                  ? "Pick the map your team wants to play."
                  : "Waiting for " + (currentTeam?.name || "the other captain") + "."
                : "Waiting for " + (currentTeam?.name || "the active captain") + " to pick the map."}
            </p>
          </>
        )}
      </div>
    </DraftStage>
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
  getPreviousGameBanInfo,
  getHeroBanInfo,
  getBannedHeroesByTeam,
  getTeamTotalBans,
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
  getPreviousGameBanInfo: (heroId: number) => { bannedByTeamA: boolean; bannedByTeamB: boolean; teamNames: string[] };
  getHeroBanInfo: (heroId: number) => { bannedByTeamA: boolean; bannedByTeamB: boolean };
  getBannedHeroesByTeam: (teamId: number) => (number | null)[];
  getTeamTotalBans: (teamId: number) => number;
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
    const counts: Record<"TANK" | "DPS" | "SUPPORT", number> = { TANK: 0, DPS: 0, SUPPORT: 0 };
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
  const getRoleLimitMessage = (role: "TANK" | "DPS" | "SUPPORT") => "No more " + role + " bans this game";

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

    const newlyBanned = Array.from(currentBanned).filter((heroId) => !prevBannedRef.current.has(heroId));

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

  // Blocks the backend call and explains why, rather than letting the server
  // reject a click the board should never have accepted.
  const handleHeroClick = (hero: Hero) => {
    if (isHeroBanned(hero.id)) {
      setBanWarning("That hero is already banned this game.");
      setTimeout(() => setBanWarning(null), 3000);
      return;
    }

    if (wasHeroBannedByMyTeamBefore(hero.id)) {
      return;
    }

    if (myTeamId && getTeamTotalBans(myTeamId) >= 2) {
      setBanWarning("Your team has already used both bans.");
      setTimeout(() => setBanWarning(null), 3000);
      return;
    }

    if (isRoleLocked(hero.role) || !canBanRole(hero.role)) {
      setBanWarning(getRoleLimitMessage(hero.role));
      setTimeout(() => setBanWarning(null), 3000);
      return;
    }

    onBanHero(hero.id);
  };

  const renderHeroTile = (hero: Hero) => {
    const banned = isHeroBanned(hero.id);
    const roleAtLimit = isRoleLocked(hero.role);
    const teamDone = myTeamId ? getTeamTotalBans(myTeamId) >= 2 : false;
    const prevBanInfo = getPreviousGameBanInfo(hero.id);
    const wasBannedBefore = prevBanInfo.bannedByTeamA || prevBanInfo.bannedByTeamB;
    const myTeamBannedBefore = wasHeroBannedByMyTeamBefore(hero.id);
    const canSelect =
      isCaptain && isMyTurn && !banned && !myTeamBannedBefore && !roleAtLimit && !teamDone && canBanRole(hero.role);

    // The mark stays semantic red; team variables color the tile record around it.
    const banInfo = banned ? getHeroBanInfo(hero.id) : null;
    const strikeSide: TeamSide | null = banned ? (banInfo?.bannedByTeamB ? "B" : "A") : null;

    let state: HeroTileState;
    if (banned) {
      state = "struck";
    } else if (roleAtLimit) {
      state = "locked";
    } else if ((isCaptain && myTeamBannedBefore) || (showBanTeamMarkers && wasBannedBefore)) {
      state = "spent";
    } else if (canSelect) {
      state = "selectable";
    } else if (teamDone || (isCaptain && !isMyTurn)) {
      state = "dimmed";
    } else {
      state = "idle";
    }

    const handleClick = () => {
      if (!isCaptain || !isMyTurn || banned) return;
      if (roleAtLimit) {
        setBanWarning(getRoleLimitMessage(hero.role));
        setTimeout(() => setBanWarning(null), 3000);
        return;
      }
      handleHeroClick(hero);
    };

    const marker =
      !banned && showBanTeamMarkers && wasBannedBefore ? (
        <span className="absolute left-1 top-1 z-20 flex items-center gap-1">
          {prevBanInfo.bannedByTeamA && (
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-team-a)]" />
          )}
          {prevBanInfo.bannedByTeamB && (
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-team-b)]" />
          )}
        </span>
      ) : banned && isRamattraHero(hero) && showRamattraOverlay ? (
        <img
          src="/NAOOORAMATTRA.gif"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 h-full w-full object-cover opacity-85"
        />
      ) : null;

    return (
      <BanTile
        key={hero.id}
        hero={hero}
        state={state}
        strikeSide={strikeSide}
        marker={marker}
        onClick={handleClick}
        onMouseEnter={() => setHoveredHero(hero.id)}
        onMouseLeave={() => setHoveredHero(null)}
      >
        {showBanTeamMarkers && wasBannedBefore && !banned && hoveredHero === hero.id && (
          <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap border border-border bg-surface-elevated px-2 py-1 text-[11px] shadow-lg">
            <span className="text-muted">Banned by </span>
            <span className="text-foreground">{prevBanInfo.teamNames.join(" & ")}</span>
          </div>
        )}
      </BanTile>
    );
  };

  const gridColumns = isObsKeyAccess
    ? "grid-cols-5 xl:grid-cols-10 2xl:grid-cols-12"
    : "grid-cols-7 sm:grid-cols-9 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 2xl:grid-cols-16";

  const renderHeroSection = (title: string, heroList: Hero[], roleTone: string) => (
    <div className="mb-2">
      <div className={stageStyles.roleHead}>
        <span className={clsx("h-2.5 w-1 rounded-full", roleTone)} />
        <h4 className={stageStyles.phaseEyebrow}>{title}</h4>
      </div>
      <div className={clsx("grid gap-1.5", gridColumns)}>{heroList.map(renderHeroTile)}</div>
    </div>
  );

  const renderRailSlots = (bans: (number | null)[], side: TeamSide, teamId?: number) => {
    if (!teamId) return null;
    const slots = [];
    for (let index = 0; index < 2; index += 1) {
      if (index < bans.length) {
        const heroId = bans[index];
        slots.push(
          <BanSlot
            key={`${teamId}-${index}-${heroId ?? "skip"}`}
            hero={heroId === null ? null : getHeroById(heroId)}
            heroId={heroId}
            side={side}
            index={index}
            teamId={teamId}
          />
        );
      } else {
        slots.push(<EmptyBanSlot key={`${teamId}-empty-${index}`} slotNumber={index + 1} teamId={teamId} />);
      }
    }
    return slots;
  };

  return (
    <div className={stageStyles.banPhase}>
      {banWarning && (
        <div className={clsx(toastPositionClass, "left-1/2 top-20 z-50 -translate-x-1/2 animate-fade-in")}>
          <div className="flex items-center gap-2 border-l-2 border-danger bg-surface-inset px-4 py-2.5 shadow-xl">
            <span className="text-sm text-danger">{banWarning}</span>
          </div>
        </div>
      )}

      <DraftStage
        broadcast={isObsKeyAccess}
        left={
          <TeamRail
            team={teamA}
            side="A"
            isTurn={isTeamATurn}
            status={isTeamATurn ? "Banning" : `${getTeamTotalBans(teamA?.id ?? -1)} of 2 used`}
          >
            {renderRailSlots(teamABans, "A", teamA?.id)}
          </TeamRail>
        }
        right={
          <TeamRail
            team={teamB}
            side="B"
            isTurn={isTeamBTurn}
            status={isTeamBTurn ? "Banning" : `${getTeamTotalBans(teamB?.id ?? -1)} of 2 used`}
          >
            {renderRailSlots(teamBBans, "B", teamB?.id)}
          </TeamRail>
        }
      >
        <div className={stageStyles.banCenter}>
          <header className={stageStyles.banHeader}>
            <div className={stageStyles.banHeaderMap}>
              {currentMap && <MapTypeIcon mapType={currentMap.type} style={{ width: 26, height: 26 }} />}
              <h2 className={stageStyles.banHeaderTitle}>
                {currentMap?.description || "Hero bans"}
              </h2>
              <span className={stageStyles.phaseEyebrow}>Game {currentGameNumber}</span>
            </div>

            <div className={stageStyles.banHeaderControls}>
              {lockedRoles.map((role) => (
                <span key={role} className={stageStyles.roleLockedChip}>
                  {getRoleLimitMessage(role)}
                </span>
              ))}
              {(["ALL", "TANK", "DPS", "SUPPORT"] as const).map((role) => (
                <Button
                  key={role}
                  variant={selectedRole === role ? "default" : "ghost"}
                  onClick={() => setSelectedRole(role)}
                  size="sm"
                  className={clsx(
                    isObsKeyAccess ? "px-4 text-sm" : "px-3 text-xs",
                    role !== "ALL" && isRoleLocked(role) && "text-danger"
                  )}
                >
                  {role === "ALL" ? "All" : role}
                </Button>
              ))}
            </div>
          </header>

          <div className="flex-1">
            {selectedRole === "ALL" ? (
              <>
                {renderHeroSection("Tank", tankHeroes, "bg-warning")}
                {renderHeroSection("DPS", dpsHeroes, "bg-[color:var(--color-team-b)]")}
                {renderHeroSection("Support", supportHeroes, "bg-accent")}
              </>
            ) : (
              <div className={clsx("grid gap-1.5", gridColumns)}>
                {heroes.filter((h) => h.role === selectedRole).map(renderHeroTile)}
              </div>
            )}
          </div>

          <div className="mt-3 flex min-h-9 items-center justify-center gap-4" aria-live="polite">
            {isCaptain && isMyTurn && myTeamId && getTeamTotalBans(myTeamId) < 2 && (
              <>
                <span className={stageStyles.phaseNote}>Pick a hero to ban.</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onBanHero(null)}
                  disabled={actionLoading}
                  className="text-muted hover:text-foreground"
                >
                  Skip ban
                </Button>
              </>
            )}
            {isCaptain && !isMyTurn && myTeamId && getTeamTotalBans(myTeamId) < 2 && (
              <span className={stageStyles.phaseNote}>
                Waiting for {currentTeam?.name || "the other captain"} to ban.
              </span>
            )}
            {isCaptain && myTeamId && getTeamTotalBans(myTeamId) >= 2 && (
              <span className={stageStyles.phaseNote}>Your team has used both bans.</span>
            )}
          </div>
        </div>
      </DraftStage>
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
    // undefined is a ban that has not happened yet; null is a turn the captain
    // deliberately passed on. They are different states and read differently.
    if (heroId === undefined) {
      return (
        <div key={`pending-${side}-${index}`} className={playing.banSlot} data-filled="false">
          <div className={playing.banEmpty}>Ban {index + 1}</div>
        </div>
      );
    }

    if (heroId === null) {
      return (
        <div key={`skip-${side}-${index}`} className={playing.banSlot} data-filled="false">
          <div className={playing.banEmpty}>No ban</div>
        </div>
      );
    }

    const hero = getHeroById(heroId);

    return (
      <div key={`ban-${side}-${index}`} className={playing.banSlot} data-filled="true">
        {hero?.imgPath ? (
          <img src={resolveHeroImageUrl(hero.imgPath)} alt={hero.name || `Hero ${heroId}`} />
        ) : (
          <div className={playing.banEmpty}>#{heroId}</div>
        )}
        <span className={playing.banStrike} aria-hidden />
        <span className={playing.banName}>{hero?.name || `Hero ${heroId}`}</span>
      </div>
    );
  };

  const renderTeamBans = (team: Team | undefined, bans: (number | null)[], side: "A" | "B") => (
    <div
      className={clsx(
        playing.bans,
        side === "A" ? playing.bansTeamA : playing.bansTeamB,
        side === "B" && playing.bansRight
      )}
    >
      <div className={playing.bansHead}>
        <span className={playing.crest}>
          {team?.logo ? (
            <img src={resolveGenericBackendAsset(team.logo)} alt="" />
          ) : (
            <>{team?.name?.charAt(0) || side}</>
          )}
        </span>
        <span className={playing.bansLabel}>
          <span className={playing.bansTeamName}>{team?.name || `Team ${side}`}</span>
          <span className={playing.bansNote}>Bans this game</span>
        </span>
      </div>
      <div className={playing.banRow}>
        {[bans[0], bans[1]].map((heroId, index) => renderBanSlot(heroId, index, side))}
      </div>
    </div>
  );

  return (
    <div className={playing.stage} data-broadcast={isObsKeyAccess ? "true" : "false"}>
      {currentMap?.imgPath ? (
        <img
          className={playing.art}
          src={resolveMapImageUrl(currentMap.imgPath)}
          alt=""
          aria-hidden
        />
      ) : (
        <div className={playing.artFallback} aria-hidden>
          {currentMap?.description?.charAt(0) || "?"}
        </div>
      )}
      <div className={playing.scrim} aria-hidden />

      <header className={playing.top}>
        <span className={playing.kicker}>
          <span className={playing.liveDot} aria-hidden />
          Now playing
        </span>
        <h1 className={playing.matchup}>
          <span className={playing.teamA}>{teamA?.name}</span>
          <span className={playing.versus}>vs</span>
          <span className={playing.teamB}>{teamB?.name}</span>
        </h1>
      </header>

      <div className={playing.bottom}>
        {renderTeamBans(teamA, teamABans, "A")}

        {currentMap ? (
          <div className={playing.caption}>
            <span className={playing.mapName}>{currentMap.description}</span>
            <span className={playing.mapType}>{currentMap.type}</span>
          </div>
        ) : null}

        {renderTeamBans(teamB, teamBBans, "B")}
      </div>

      <div className={playing.action}>
        {isManager ? (
          <Button
            size="lg"
            className={clsx("bg-success hover:bg-success/90", isObsKeyAccess ? "px-10 text-lg" : "px-8")}
            onClick={onEndGame}
            disabled={actionLoading}
          >
            {actionLoading ? "Processing..." : "Game Ended"}
          </Button>
        ) : (
          <p className={playing.waiting}>Waiting for the manager to mark this game as ended</p>
        )}
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
