"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/features/session/SessionProvider";
import {
  readNetworkSessionUser,
  type NetworkSessionUser,
} from "@/features/networkSession/storage";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MapTimer } from "@/components/match/MapTimer";
import { PauseRequestNotification } from "@/components/match/PauseRequestNotification";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import {
  getMatches,
  getTeams,
  getMembers,
  createDraft,
  getDraftByMatchId,
  updateManagerMatch,
  finishPendingRegisters,
  getAllPlayerStats,
  createBatchPlayerStats,
  managerTogglePause,
  managerClearPauseRequest,
  type Match,
  type Team,
  type DraftState,
  type Member,
  type MatchStatGameEntry,
  type MatchStatEntryRow,
} from "@/lib/api";
import { formatDateEST, formatDateTimeEST } from "@/lib/dateUtils";
import type { PlayerStat } from "@/lib/api/types";

type TabValue = "scheduled" | "active" | "pending" | "stats";
type MapType = "CONTROL" | "HYBRID" | "PAYLOAD" | "PUSH" | "FLASHPOINT";
type HeroRole = "TANK" | "DPS" | "SUPPORT";

type PendingStatFormState = {
  mapType: MapType;
  matchTitle: string;
};

const POLL_INTERVAL = 12000;

const DEFAULT_PENDING_STAT_FORM: PendingStatFormState = {
  mapType: "FLASHPOINT",
  matchTitle: "",
};

function ManagerDashboardWorkspace({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated } = useSession();
  const [networkUser, setNetworkUser] = useState<NetworkSessionUser | null>(null);
  const [networkReady, setNetworkReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("scheduled");
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [drafts, setDrafts] = useState<Record<number, DraftState | null>>({});
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [creatingDraft, setCreatingDraft] = useState<number | null>(null);
  const [activeStatMatchId, setActiveStatMatchId] = useState<number | null>(null);
  const [statForms, setStatForms] = useState<Record<number, PendingStatFormState>>({});
  const [gameEntries, setGameEntries] = useState<Record<number, MatchStatGameEntry[]>>({});
  const [confirmingMatchId, setConfirmingMatchId] = useState<number | null>(null);
  const [statMessages, setStatMessages] = useState<Record<number, string>>({});
  const [finishingMatchId, setFinishingMatchId] = useState<number | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [notificationsSupported, setNotificationsSupported] = useState(false);
  // Stats tab state
  const [allStats, setAllStats] = useState<PlayerStat[]>([]);
  const [statsSearch, setStatsSearch] = useState("");
  const [statsTopFilter, setStatsTopFilter] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const prevMatchesRef = useRef<Match[]>([]);

  const canManage = Boolean(networkUser?.roles.some((role) => role === "SOCIAL_MEDIA" || role === "ADMIN"));
  const accessReady = isHydrated && networkReady;

  useEffect(() => {
    const refreshNetworkUser = () => {
      setNetworkUser(readNetworkSessionUser());
      setNetworkReady(true);
    };
    refreshNetworkUser();
    window.addEventListener("network-session-changed", refreshNetworkUser);
    window.addEventListener("storage", refreshNetworkUser);
    return () => {
      window.removeEventListener("network-session-changed", refreshNetworkUser);
      window.removeEventListener("storage", refreshNetworkUser);
    };
  }, []);

  useEffect(() => {
    if (accessReady && (!isAuthenticated || !canManage)) {
      router.push("/login");
    }
  }, [accessReady, isAuthenticated, canManage, router]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationsSupported(true);
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && canManage) {
      loadData();
    }
  }, [isAuthenticated, canManage]);

  useEffect(() => {
    if (!isAuthenticated || !canManage) return;
    pollRef.current = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadData(true);
    }, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isAuthenticated, canManage]);

  const sendNotification = useCallback((title: string, body: string) => {
    if (notificationPermission === "granted" && typeof window !== "undefined" && "Notification" in window) {
      new Notification(title, { body, icon: "/favicon.ico", tag: "manager-notification" });
    }
  }, [notificationPermission]);

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      const [matchesData, teamsData, membersData] = await Promise.all([
        getMatches(),
        getTeams(),
        getMembers(),
      ]);

      for (const match of matchesData) {
        const prevMatch = prevMatchesRef.current.find((m) => m.id === match.id);
        if (prevMatch) {
          const wasNotBothReady = !(prevMatch.teamAready === 1 && prevMatch.teamBready === 1);
          const isNowBothReady = match.teamAready === 1 && match.teamBready === 1;
          if (wasNotBothReady && isNowBothReady && match.status === "SCHEDULED") {
            const teamAName = teamsData.find((t) => t.id === match.teamAId)?.name || "Team A";
            const teamBName = teamsData.find((t) => t.id === match.teamBId)?.name || "Team B";
            sendNotification("Teams Ready!", `${teamAName} vs ${teamBName} - Both teams are ready.`);
          }
        }
      }

      prevMatchesRef.current = matchesData;
      setMatches(matchesData);
      setTeams(teamsData);
      setMembers(membersData);
      setDataError(null);

        const activeMatches = matchesData.filter((m) => m.status === "ACTIVE");
      const draftPromises = activeMatches.map(async (match) => {
        try {
          const draft = await getDraftByMatchId(match.id, { token: token ?? undefined });
          return { matchId: match.id, draft };
        } catch {
          return { matchId: match.id, draft: null };
        }
      });

      const draftResults = await Promise.all(draftPromises);
      const newDrafts: Record<number, DraftState | null> = {};
      for (const result of draftResults) {
        newDrafts[result.matchId] = result.draft;
      }
      setDrafts(newDrafts);
    } catch (err) {
      console.error("Failed to load data:", err);
      setDataError(err instanceof Error ? err.message : "League operations could not be refreshed.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadStats() {
    if (!token) return;
    setStatsLoading(true);
    try {
      const data = await getAllPlayerStats(token);
      setAllStats(data);
      setStatsError(null);
    } catch (err) {
      console.error("Failed to load stats:", err);
      setStatsError(err instanceof Error ? err.message : "Player stats could not be loaded.");
    } finally {
      setStatsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "stats" && token && allStats.length === 0) {
      loadStats();
    }
  }, [activeTab, token]);

  async function handleCreateDraft(matchId: number) {
    if (!token) return;
    setCreatingDraft(matchId);
    try {
      await createDraft(token, matchId);
      router.push(`/draft-table/${matchId}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      // If draft already exists, redirect to it instead of showing error
      if (errorMsg.includes("already exists")) {
        router.push(`/draft-table/${matchId}`);
      } else {
        console.error("Failed to create draft:", err);
        alert("Failed to create draft table. Make sure both teams are ready.");
      }
    } finally {
      setCreatingDraft(null);
    }
  }

  function getPlayersForMatch(match: Match) {
    return members.filter((member) => member.teamId === match.teamAId || member.teamId === match.teamBId);
  }

  function getOrCreateStatForm(matchId: number) {
    return statForms[matchId] ?? DEFAULT_PENDING_STAT_FORM;
  }

  function openStatForm(match: Match) {
    const matchId = match.id;
    setActiveStatMatchId((prev) => (prev === matchId ? null : matchId));
    setStatForms((prev) => {
      if (prev[matchId]) return prev;
      return {
        ...prev,
        [matchId]: {
          ...DEFAULT_PENDING_STAT_FORM,
          matchTitle: String(match.title || ""),
        },
      };
    });
  }

  function updateStatForm(matchId: number, patch: Partial<PendingStatFormState>) {
    setStatForms((prev) => ({
      ...prev,
      [matchId]: { ...(prev[matchId] ?? DEFAULT_PENDING_STAT_FORM), ...patch },
    }));
  }

  function updateGameRow(matchId: number, gameIndex: number, rowIndex: number, patch: Partial<MatchStatEntryRow>) {
    setGameEntries((prev) => {
      const entries = prev[matchId] || [];
      const target = entries[gameIndex];
      if (!target) return prev;
      const rows = [...target.rows];
      rows[rowIndex] = { ...rows[rowIndex], ...patch };
      const nextEntries = [...entries];
      nextEntries[gameIndex] = { ...target, rows };
      return { ...prev, [matchId]: nextEntries };
    });
  }

  function addGameEntry(match: Match) {
    const matchPlayers = getPlayersForMatch(match);
    const form = getOrCreateStatForm(match.id);
    const expectedGames = Math.max(1, (match.mapWinsTeamA || 0) + (match.mapWinsTeamB || 0));
    const existingEntries = gameEntries[match.id] || [];
    if (existingEntries.length >= expectedGames) {
      setStatMessages((prev) => ({
        ...prev,
        [match.id]: `All ${expectedGames} game entries are already open.`,
      }));
      return;
    }
    const rows: MatchStatEntryRow[] = matchPlayers.slice(0, 10).map((player) => ({
      userId: player.id,
      role: "DPS",
      kills: 0,
      assists: 0,
      deaths: 0,
      damage: 0,
      healing: 0,
      mitigation: 0,
    }));
    setGameEntries((prev) => ({
      ...prev,
      [match.id]: [...(prev[match.id] || []), { mapType: form.mapType, gameDuration: 0, rows, players: matchPlayers }],
    }));
    setStatMessages((prev) => ({ ...prev, [match.id]: `Game ${existingEntries.length + 1} is ready for manual entry.` }));
  }

  async function handleConfirmBatch(matchId: number) {
    if (!token) return;
    const form = getOrCreateStatForm(matchId);
    const title = form.matchTitle.trim();
    if (!title) {
      setStatMessages((prev) => ({
        ...prev,
        [matchId]: "Please set a match title first (example: MATCH OF NEPAL).",
      }));
      return;
    }

    const entries = gameEntries[matchId] || [];
    const expectedGames = Math.max(1, (matches.find((m) => m.id === matchId)?.mapWinsTeamA || 0) + (matches.find((m) => m.id === matchId)?.mapWinsTeamB || 0));
    if (entries.length < expectedGames) {
      setStatMessages((prev) => ({
        ...prev,
        [matchId]: `Complete ${expectedGames} game entries before saving (${entries.length}/${expectedGames} ready).`,
      }));
      return;
    }
    const entriesToSave = entries.slice(0, expectedGames);
    if (entriesToSave.some((entry) => entry.gameDuration <= 0)) {
      setStatMessages((prev) => ({ ...prev, [matchId]: "Enter a duration for every game before saving." }));
      return;
    }

    setConfirmingMatchId(matchId);
    setStatMessages((prev) => ({ ...prev, [matchId]: "Saving player stats..." }));

    try {
      await updateManagerMatch(token, matchId, { title });

      const result = await createBatchPlayerStats(token, {
        matchId,
        games: entriesToSave.map((entry, batchIndex) => ({
          mapType: entry.mapType,
          gameNumber: batchIndex + 1,
          gameDuration: entry.gameDuration,
          rows: entry.rows.slice(0, 10).map((row) => ({
            userId: row.userId,
            role: row.role,
            kills: Number(row.kills),
            assists: Number(row.assists),
            deaths: Number(row.deaths),
            damage: Number(row.damage),
            healing: Number(row.healing),
            mitigation: Number(row.mitigation),
          })),
        })),
      });
      setStatMessages((prev) => ({
        ...prev,
        [matchId]: `Saved ${result.count} player stats across ${entriesToSave.length} game(s) for ${title}. Mark as finished when done.`,
      }));
      setGameEntries((prev) => ({ ...prev, [matchId]: [] }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save match stats.";
      setStatMessages((prev) => ({ ...prev, [matchId]: message }));
    } finally {
      setConfirmingMatchId(null);
    }
  }

  async function handleFinishMatch(matchId: number) {
    if (!token) return;
    setFinishingMatchId(matchId);
    try {
      await finishPendingRegisters(token, matchId);
      setStatMessages((prev) => ({ ...prev, [matchId]: "Match moved to FINISHED." }));
      await loadData(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to mark match as finished.";
      setStatMessages((prev) => ({ ...prev, [matchId]: message }));
    } finally {
      setFinishingMatchId(null);
    }
  }

  const getTeamName = (teamId: number) =>
    teams.find((t) => t.id === teamId)?.name || `Team ${teamId}`;

  const scheduledMatches = matches.filter((m) => m.status === "SCHEDULED");
  const activeMatches = matches.filter((m) => m.status === "ACTIVE");
  const pendingMatches = matches.filter((m) => m.status === "PENDINGREGISTERS");

  // Group scheduled matches by week
  const scheduledByWeek = scheduledMatches.reduce((acc, m) => {
    const w = m.semanas || 1;
    if (!acc[w]) acc[w] = [];
    acc[w].push(m);
    return acc;
  }, {} as Record<number, Match[]>);

  // Find the next upcoming match (soonest startDate)
  const nextMatch = scheduledMatches
    .filter((m) => m.startDate)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0] || null;

  // Stats filtering
  const statsFiltered = (() => {
    let data = [...allStats];
    if (statsSearch.trim()) {
      const q = statsSearch.trim().toLowerCase();
      // We need member nicknames - join by userId
      const memberMap = new Map(members.map((m) => [m.id, m]));
      data = data.filter((s) => {
        const m = memberMap.get(s.userId);
        return m?.nickname?.toLowerCase().includes(q) || m?.user?.toLowerCase().includes(q);
      });
    }
    if (statsTopFilter) {
      const field = statsTopFilter as keyof PlayerStat;
      data = [...data].sort((a, b) => (b[field] as number) - (a[field] as number)).slice(0, 10);
    }
    return data;
  })();

  // Average stats per player
  const playerAverages = (() => {
    const memberMap = new Map(members.map((m) => [m.id, m]));
    const byPlayer: Record<number, PlayerStat[]> = {};
    for (const s of allStats) {
      if (!byPlayer[s.userId]) byPlayer[s.userId] = [];
      byPlayer[s.userId].push(s);
    }
    return Object.entries(byPlayer).map(([userId, stats]) => {
      const member = memberMap.get(Number(userId));
      const avg = (field: keyof PlayerStat) =>
        stats.reduce((acc, s) => acc + (s[field] as number), 0) / stats.length;
      return {
        userId: Number(userId),
        nickname: member?.nickname || `Player #${userId}`,
        games: stats.length,
        avgDmg: Math.round(avg("damagePer10")),
        avgHeal: Math.round(avg("healingPer10")),
        avgMit: Math.round(avg("mitigationPer10")),
        avgKills: +avg("killsPer10").toFixed(1),
        avgAssists: +avg("assistsPer10").toFixed(1),
        avgDeaths: +avg("deathsPer10").toFixed(1),
      };
    });
  })();

  const searchedPlayer = (() => {
    if (!statsSearch.trim()) return null;
    const q = statsSearch.trim().toLowerCase();
    return playerAverages.find(
      (p) => p.nickname.toLowerCase().includes(q)
    ) || null;
  })();

  if (!accessReady) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted">Loading...</div></div>;
  }

  if (!isAuthenticated || !canManage) {
    return <div className="min-h-screen bg-background flex items-center justify-center" role="status"><div className="border border-border bg-surface px-6 py-5 text-muted">Redirecting to authorized access…</div></div>;
  }

  return (
    <main className={embedded ? "manager-workspace py-4" : "min-h-screen bg-background py-8"}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{embedded ? "League operations" : "Manager Dashboard"}</h1>
            <p className="text-muted mt-1">Manage matches, create draft tables, and register results</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={nextMatch ? `/assets-edition?matchId=${nextMatch.id}` : "/assets-edition"}
              className="inline-flex items-center justify-center rounded-md bg-surface-elevated text-foreground hover:bg-border active:bg-border/90 px-3 py-1.5 text-sm font-medium transition-colors"
            >
              Edit assets
            </Link>
            {notificationsSupported && notificationPermission === "default" ? <Button size="sm" variant="secondary" onClick={() => void Notification.requestPermission().then(setNotificationPermission)}>Enable alerts</Button> : null}
            <div className={`w-2 h-2 rounded-full ${dataError ? "bg-danger" : "bg-success animate-pulse"}`} aria-hidden="true" />
            <span className="text-xs text-muted">{dataError ? "Updates interrupted" : "Live updates"}</span>
          </div>
        </div>

        {dataError ? <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-danger/50 bg-danger/10 p-4" role="alert"><span>Could not refresh league operations: {dataError}</span><Button size="sm" variant="secondary" onClick={() => void loadData()}>Try again</Button></div> : null}

        {/* Overview cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Scheduled", count: scheduledMatches.length, color: "text-foreground" },
            { label: "Active", count: activeMatches.length, color: "text-accent" },
            { label: "Pending Results", count: pendingMatches.length, color: "text-warning" },
          ].map(({ label, count, color }) => (
            <Card key={label} variant="featured">
              <CardContent className="p-6">
                <p className="text-sm text-muted">{label}</p>
                <p className={`text-3xl font-bold ${color}`}>{count}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Next match highlight */}
        {nextMatch && (
          <div className="mb-6 p-4 rounded-xl border-2 border-primary bg-primary/5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs text-primary uppercase tracking-wide font-semibold mb-1">Next Match</p>
                <p className="text-xl font-bold text-foreground">
                  {getTeamName(nextMatch.teamAId)} <span className="text-muted">vs</span> {getTeamName(nextMatch.teamBId)}
                </p>
                <p className="text-sm text-muted mt-1">
                  Week {nextMatch.semanas} &middot; BO{nextMatch.bestOf} &middot;{" "}
                  {nextMatch.startDate
                    ? formatDateTimeEST(nextMatch.startDate)
                    : "No date set"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={nextMatch.teamAready ? "success" : "default"}>
                  {getTeamName(nextMatch.teamAId).slice(0, 8)}: {nextMatch.teamAready ? "✓" : "—"}
                </Badge>
                <Badge variant={nextMatch.teamBready ? "success" : "default"}>
                  {getTeamName(nextMatch.teamBId).slice(0, 8)}: {nextMatch.teamBready ? "✓" : "—"}
                </Badge>
                <Button
                  onClick={() => handleCreateDraft(nextMatch.id)}
                  disabled={creatingDraft === nextMatch.id}
                  size="sm"
                >
                  {creatingDraft === nextMatch.id ? "Creating..." : "Create Draft"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList className="mb-6">
            <TabsTrigger value="scheduled">Scheduled ({scheduledMatches.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({activeMatches.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({pendingMatches.length})</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>

          {/* SCHEDULED TAB */}
          <TabsContent value="scheduled">
            <div className="space-y-8">
              {loading ? (
                <p className="text-muted text-center py-8">Loading...</p>
              ) : scheduledMatches.length === 0 ? (
                <p className="text-muted text-center py-8">No scheduled matches.</p>
              ) : (
                Object.entries(scheduledByWeek)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([week, weekMatches]) => (
                    <div key={week}>
                      <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
                        Week {week}
                      </h3>
                      <div className="space-y-3">
                        {weekMatches
                          .sort((a, b) => (a.startDate && b.startDate ? new Date(a.startDate).getTime() - new Date(b.startDate).getTime() : 0))
                          .map((match) => {
                            const bothReady = match.teamAready === 1 && match.teamBready === 1;
                            const teamAName = getTeamName(match.teamAId);
                            const teamBName = getTeamName(match.teamBId);
                            const isNext = match.id === nextMatch?.id;

                            return (
                              <div
                                key={match.id}
                                className={`border rounded-lg p-4 transition-all ${
                                  isNext
                                    ? "border-primary bg-primary/5"
                                    : bothReady
                                    ? "border-success bg-success/5"
                                    : "border-border bg-surface"
                                }`}
                              >
                                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      {isNext && <Badge variant="primary" className="text-xs">Next Match</Badge>}
                                      <span className="text-lg font-semibold text-foreground">{teamAName}</span>
                                      <span className="text-muted">vs</span>
                                      <span className="text-lg font-semibold text-foreground">{teamBName}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted">
                                      <Badge variant="secondary">{match.type}</Badge>
                                      <span>BO{match.bestOf}</span>
                                      {match.startDate && (
                                        <span>{formatDateTimeEST(match.startDate)}</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${match.teamAready ? "bg-success text-white" : "bg-surface-elevated text-muted"}`}>
                                      {teamAName.charAt(0)}
                                    </div>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${match.teamBready ? "bg-success text-white" : "bg-surface-elevated text-muted"}`}>
                                      {teamBName.charAt(0)}
                                    </div>
                                    <Button
                                      onClick={() => handleCreateDraft(match.id)}
                                      disabled={creatingDraft === match.id}
                                      size="sm"
                                    >
                                      {creatingDraft === match.id ? "Creating..." : "Create Draft"}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </TabsContent>

          {/* ACTIVE TAB */}
          <TabsContent value="active">
            <Card variant="featured">
              <CardHeader><CardTitle>Active Matches</CardTitle></CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted text-center py-8">Loading...</p>
                ) : activeMatches.length === 0 ? (
                  <p className="text-muted text-center py-8">No active matches.</p>
                ) : (
                  <div className="space-y-4">
                    {activeMatches.map((match) => {
                      const draft = drafts[match.id];
                      const hasMapStarted = match.mapStartedAt;
                      return (
                        <div key={match.id} className="border border-accent/30 rounded-lg p-4 bg-accent/5">
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-lg font-semibold text-foreground">{getTeamName(match.teamAId)}</span>
                                  <span className="font-mono text-xl text-accent">{match.mapWinsTeamA} - {match.mapWinsTeamB}</span>
                                  <span className="text-lg font-semibold text-foreground">{getTeamName(match.teamBId)}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <Badge variant="primary">Game {(match.gameNumber || 0) + 1}</Badge>
                                  {draft && <Badge variant="secondary">{draft.phase}</Badge>}
                                </div>
                              </div>
                              <Link href={`/draft-table/${match.id}`}>
                                <Button variant="secondary">View Draft</Button>
                              </Link>
                            </div>

                            {/* Map Timer */}
                            {hasMapStarted && (
                              <div className="border-t border-accent/20 pt-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted">Map Timer</span>
                                  <MapTimer
                                    mapStartedAt={match.mapStartedAt ?? null}
                                    isPaused={match.mapTimerPaused || false}
                                    onPauseToggle={(paused) => managerTogglePause(token!, match.id, paused)}
                                    showPauseButton
                                    size="sm"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Pause Request Notification */}
                            {match.pauseRequestedBy && (
                              <div className="border-t border-warning/20 pt-3">
                                <PauseRequestNotification
                                  captainName={match.pauseRequestedBy === match.teamAId ? getTeamName(match.teamAId) : getTeamName(match.teamBId)}
                                  teamName={match.pauseRequestedBy === match.teamAId ? getTeamName(match.teamAId) : getTeamName(match.teamBId)}
                                  isManager
                                  onAccept={() => managerTogglePause(token!, match.id, true)}
                                  onDeny={() => managerClearPauseRequest(token!, match.id)}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PENDING TAB */}
          <TabsContent value="pending">
            <Card variant="featured">
              <CardHeader><CardTitle>Pending Results</CardTitle></CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted text-center py-8">Loading...</p>
                ) : pendingMatches.length === 0 ? (
                  <p className="text-muted text-center py-8">No matches pending results.</p>
                ) : (
                  <div className="space-y-4">
                    {pendingMatches.map((match) => {
                      const teamAName = getTeamName(match.teamAId);
                      const teamBName = getTeamName(match.teamBId);
                      const matchPlayers = getPlayersForMatch(match);
                      const form = getOrCreateStatForm(match.id);
                      const entries = gameEntries[match.id] || [];
                      const expectedGames = Math.max(1, (match.mapWinsTeamA || 0) + (match.mapWinsTeamB || 0));
                      const isOpen = activeStatMatchId === match.id;

                      return (
                        <div key={match.id} className="border border-warning/30 rounded-lg p-4 bg-warning/5">
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="text-lg font-semibold text-foreground">{teamAName}</span>
                                <span className="font-mono text-lg text-warning">{match.mapWinsTeamA} - {match.mapWinsTeamB}</span>
                                <span className="text-lg font-semibold text-foreground">{teamBName}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted">
                                <Badge variant="secondary">{match.type}</Badge>
                                <span>BO{match.bestOf}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="secondary" onClick={() => openStatForm(match)}>
                                {isOpen ? "Hide Stats Form" : "Register Stats"}
                              </Button>
                              <Link href={`/draft-table/${match.id}`}>
                                <Button size="sm" variant="secondary">View Draft</Button>
                              </Link>
                            </div>
                          </div>

                          {isOpen && (
                            <div className="mt-4 border-t border-border pt-4 space-y-4">
                              <p className="text-sm text-muted">
                                Enter the official scoreboard values for each played map. Match rosters are loaded automatically; verify roles, duration, and values before saving.
                              </p>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <label className="text-sm md:col-span-3">
                                  <span className="text-muted block mb-1">Match Title</span>
                                  <input
                                    type="text"
                                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                                    placeholder="MATCH OF NEPAL"
                                    value={form.matchTitle}
                                    onChange={(e) => updateStatForm(match.id, { matchTitle: e.target.value })}
                                  />
                                </label>

                                <label className="text-sm">
                                  <span className="text-muted block mb-1">Default map type</span>
                                  <select
                                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                                    value={form.mapType}
                                    onChange={(e) => updateStatForm(match.id, { mapType: e.target.value as MapType })}
                                  >
                                    {["CONTROL", "HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"].map((t) => (
                                      <option key={t} value={t}>{t}</option>
                                    ))}
                                  </select>
                                </label>

                              </div>

                              <div className="flex flex-wrap items-center gap-3">
                                <Button onClick={() => addGameEntry(match)} disabled={entries.length >= expectedGames}>
                                  {entries.length >= expectedGames ? "All games added" : `Add game ${entries.length + 1}`}
                                </Button>
                                <Button
                                  onClick={() => void handleConfirmBatch(match.id)}
                                  disabled={entries.length < expectedGames || confirmingMatchId === match.id}
                                >
                                  {confirmingMatchId === match.id ? "Saving..." : `Save ${entries.length} game${entries.length === 1 ? "" : "s"}`}
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    if (window.confirm("Mark this match finished? This publishes the final score and stats.")) void handleFinishMatch(match.id);
                                  }}
                                  disabled={finishingMatchId === match.id}
                                >
                                  {finishingMatchId === match.id ? "Finishing..." : "Mark Match Finished"}
                                </Button>
                                {statMessages[match.id] && (
                                  <span className="text-sm text-muted" role="status" aria-live="polite">{statMessages[match.id]}</span>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {Array.from({ length: expectedGames }).map((_, slotIndex) => {
                                  const entry = entries[slotIndex];
                                  return (
                                    <div
                                      key={slotIndex}
                                      className={`rounded-md border p-3 ${entry ? "border-success/40 bg-success/5" : "border-border bg-surface/40"}`}
                                    >
                                      <p className="text-sm font-semibold text-foreground">Game {slotIndex + 1}</p>
                                      <p className="text-xs text-muted">
                                        {entry ? "Manual entry open" : "Not added"}
                                      </p>
                                      {entry && (
                                        <p className="text-xs text-muted mt-1">
                                          {entry.mapType} &middot; {entry.gameDuration ? `${entry.gameDuration}s` : "Duration required"}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {entries.map((entry, gameIndex) => (
                                <div key={gameIndex} className="space-y-3 rounded-md border border-border p-3 bg-surface/40">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-foreground">Game {gameIndex + 1} stats</p>
                                    <button type="button" className="text-xs font-semibold text-danger underline underline-offset-4" onClick={() => setGameEntries((current) => ({ ...current, [match.id]: (current[match.id] || []).filter((_, index) => index !== gameIndex) }))}>Remove game</button>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <label className="text-sm block">
                                    <span className="text-muted">Map type</span>
                                    <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={entry.mapType} onChange={(event) => setGameEntries((prev) => { const list = [...(prev[match.id] || [])]; list[gameIndex] = { ...entry, mapType: event.target.value as MapType }; return { ...prev, [match.id]: list }; })}>
                                      {["CONTROL", "HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"].map((type) => <option key={type} value={type}>{type}</option>)}
                                    </select>
                                  </label>
                                  <label className="text-sm block">
                                    <span className="text-muted">Duration in seconds</span>
                                    <input
                                      type="number" min={1}
                                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                                      value={entry.gameDuration || ""}
                                      onChange={(e) =>
                                        setGameEntries((prev) => {
                                          const list = [...(prev[match.id] || [])];
                                          list[gameIndex] = { ...entry, gameDuration: Number(e.target.value || 0) };
                                          return { ...prev, [match.id]: list };
                                        })
                                      }
                                    />
                                  </label>
                                  </div>

                                  <div className="overflow-x-auto rounded-md border border-border">
                                    <table className="w-full text-sm">
                                      <thead className="bg-surface">
                                        <tr>
                                          {["#", "Player", "Role", "K", "A", "D", "DMG", "HEAL", "MIT"].map((h) => (
                                            <th key={h} className="px-2 py-2 text-left text-xs">{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {entry.rows.slice(0, 10).map((row, rowIndex) => (
                                          <tr key={rowIndex} className="border-t border-border">
                                            <td className="px-2 py-1 text-xs text-muted">{rowIndex + 1}</td>
                                            <td className="px-2 py-1">
                                              <select
                                                className="w-36 rounded border border-border bg-background px-2 py-1 text-xs"
                                                value={row.userId ?? ""}
                                                onChange={(e) => updateGameRow(match.id, gameIndex, rowIndex, { userId: e.target.value ? Number(e.target.value) : null })}
                                              >
                                                <option value="">— select —</option>
                                                {entry.players.map((player) => (
                                                  <option key={player.id} value={player.id}>{player.nickname}</option>
                                                ))}
                                              </select>
                                            </td>
                                            <td className="px-2 py-1">
                                              <select
                                                className="w-20 rounded border border-border bg-background px-2 py-1 text-xs"
                                                value={row.role}
                                                onChange={(e) => updateGameRow(match.id, gameIndex, rowIndex, { role: e.target.value as HeroRole })}
                                              >
                                                <option value="TANK">TANK</option>
                                                <option value="DPS">DPS</option>
                                                <option value="SUPPORT">SUPPORT</option>
                                              </select>
                                            </td>
                                            {(["kills", "assists", "deaths", "damage", "healing", "mitigation"] as const).map((field) => (
                                              <td key={field} className="px-2 py-1">
                                                <input
                                                  type="number" min={0}
                                                  className="w-16 rounded border border-border bg-background px-2 py-1 text-xs"
                                                  value={row[field]}
                                                  onChange={(e) => updateGameRow(match.id, gameIndex, rowIndex, { [field]: Number(e.target.value || 0) })}
                                                />
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* STATS TAB */}
          <TabsContent value="stats">
            <div className="space-y-6">
              {statsError ? <div className="flex flex-wrap items-center justify-between gap-3 border border-danger/50 bg-danger/10 p-4" role="alert"><span>Could not load player stats: {statsError}</span><Button size="sm" variant="secondary" onClick={() => void loadStats()}>Try again</Button></div> : null}
              {/* Search bar */}
              <Card variant="featured">
                <CardContent className="p-4">
                  <Input
                    label="Search player"
                    placeholder="Type a nickname to see that player's stats..."
                    value={statsSearch}
                    onChange={(e) => { setStatsSearch(e.target.value); setStatsTopFilter(null); }}
                  />
                </CardContent>
              </Card>

              {/* If searching, show player summary card first */}
              {searchedPlayer && (
                <Card variant="featured">
                  <CardContent className="p-6">
                    <p className="text-xs text-primary uppercase tracking-wide font-semibold mb-2">Player Average Stats / 10 min</p>
                    <p className="text-xl font-bold text-foreground mb-4">{searchedPlayer.nickname} <span className="text-sm text-muted font-normal">({searchedPlayer.games} games)</span></p>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                      {[
                        { label: "DMG", value: searchedPlayer.avgDmg, color: "text-danger" },
                        { label: "HEAL", value: searchedPlayer.avgHeal, color: "text-success" },
                        { label: "MIT", value: searchedPlayer.avgMit, color: "text-primary" },
                        { label: "ELIMS", value: searchedPlayer.avgKills, color: "text-accent" },
                        { label: "ASSISTS", value: searchedPlayer.avgAssists, color: "text-foreground" },
                        { label: "DEATHS", value: searchedPlayer.avgDeaths, color: "text-muted" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="text-center">
                          <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
                          <p className="text-xs text-muted">{label}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top 10 buttons */}
              <div className="flex flex-wrap gap-2">
                <p className="text-sm text-muted self-center">Top 10:</p>
                {[
                  { label: "DMG", field: "damagePer10" },
                  { label: "Mitigated", field: "mitigationPer10" },
                  { label: "Kills", field: "killsPer10" },
                  { label: "Healing", field: "healingPer10" },
                  { label: "Assists", field: "assistsPer10" },
                  { label: "Least Deaths", field: "deathsPer10" },
                ].map(({ label, field }) => (
                  <Button
                    key={field}
                    size="sm"
                    variant={statsTopFilter === field ? "default" : "ghost"}
                    onClick={() => {
                      setStatsSearch("");
                      setStatsTopFilter(statsTopFilter === field ? null : field);
                    }}
                  >
                    {label}
                  </Button>
                ))}
                {(statsTopFilter || statsSearch) && (
                  <Button size="sm" variant="ghost" onClick={() => { setStatsTopFilter(null); setStatsSearch(""); }}>
                    Clear
                  </Button>
                )}
              </div>

              {/* Stats table */}
              <Card variant="featured">
                <CardHeader>
                  <CardTitle>
                    {statsTopFilter
                      ? `Top 10 — ${statsTopFilter.replace("Per10", "").replace("damage", "Damage").replace("healing", "Healing").replace("mitigation", "Mitigation").replace("kills", "Kills").replace("assists", "Assists").replace("deaths", "Deaths")} per 10 min`
                      : statsSearch
                      ? `Stats for "${statsSearch}"`
                      : "All Player Stats (avg / 10 min)"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {statsLoading ? (
                    <p className="text-muted text-center py-8">Loading stats...</p>
                  ) : playerAverages.length === 0 ? (
                    <p className="text-muted text-center py-8">No stats recorded yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-surface border-b border-border">
                          <tr>
                            {["Player", "Games", "DMG/10", "HEAL/10", "MIT/10", "ELIMS/10", "AST/10", "DEATHS/10"].map((h) => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            let rows = [...playerAverages];
                            if (statsSearch.trim()) {
                              const q = statsSearch.trim().toLowerCase();
                              rows = rows.filter((p) => p.nickname.toLowerCase().includes(q));
                            }
                            if (statsTopFilter) {
                              const fieldMap: Record<string, keyof typeof rows[0]> = {
                                damagePer10: "avgDmg", mitigationPer10: "avgMit",
                                killsPer10: "avgKills", healingPer10: "avgHeal",
                                assistsPer10: "avgAssists", deathsPer10: "avgDeaths",
                              };
                              const sortKey = fieldMap[statsTopFilter];
                              const ascending = statsTopFilter === "deathsPer10";
                              rows = [...rows].sort((a, b) => ascending
                                ? (a[sortKey] as number) - (b[sortKey] as number)
                                : (b[sortKey] as number) - (a[sortKey] as number)
                              ).slice(0, 10);
                            }
                            return rows.map((p, i) => (
                              <tr key={p.userId} className="border-t border-border hover:bg-surface/50 transition-colors">
                                <td className="px-4 py-3">
                                  {statsTopFilter && <span className="text-xs text-muted mr-2">#{i + 1}</span>}
                                  <span className="font-medium text-foreground">{p.nickname}</span>
                                </td>
                                <td className="px-4 py-3 text-muted">{p.games}</td>
                                <td className="px-4 py-3 font-mono text-danger">{p.avgDmg.toLocaleString()}</td>
                                <td className="px-4 py-3 font-mono text-success">{p.avgHeal.toLocaleString()}</td>
                                <td className="px-4 py-3 font-mono text-primary">{p.avgMit.toLocaleString()}</td>
                                <td className="px-4 py-3 font-mono">{p.avgKills}</td>
                                <td className="px-4 py-3 font-mono">{p.avgAssists}</td>
                                <td className="px-4 py-3 font-mono text-muted">{p.avgDeaths}</td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </main>
  );
}

export default function ManagerDashboardPage() {
  const searchParams = useSearchParams();
  return <ManagerDashboardWorkspace embedded={searchParams.get("embedded") === "1"} />;
}
