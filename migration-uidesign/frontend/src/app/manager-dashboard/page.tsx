"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/features/session/SessionProvider";
import {
  readNetworkSessionToken,
} from "@/features/networkSession/storage";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MapTimer } from "@/components/match/MapTimer";
import { PauseRequestNotification } from "@/components/match/PauseRequestNotification";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { OperationTeamLogo } from "@/components/admin/SeasonOperationUi";
import { getCurrentTournament } from "@/lib/api/admin";
import { getCurrentNetworkMember } from "@/lib/api/networkMember";
import { getMatchesByTournament, updateMatchSchedule } from "@/lib/api/match";
import { getLeaderboard } from "@/lib/api/team";
import { filterMatchesByDivision } from "@/features/tournament/divisions";
import {
  getMembers,
  getDraftByMatchId,
  getAllPlayerStats,
  managerTogglePause,
  managerClearPauseRequest,
  type Match,
  type Team,
  type DraftState,
  type Member,
} from "@/lib/api";
import { convertToISODateTime, formatDateTimeEST, formatForDateTimeInput } from "@/lib/dateUtils";
import styles from "./manager-dashboard.module.css";
import type { NetworkMember, PlayerStat, Tournament } from "@/lib/api/types";

type TabValue = "scheduled" | "active" | "results" | "stats";

const POLL_INTERVAL = 12000;

function ManagerDashboardWorkspace({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const { token, isAuthenticated, isHydrated } = useSession();
  const [networkUser, setNetworkUser] = useState<NetworkMember | null>(null);
  const [networkReady, setNetworkReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("scheduled");
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisionFilter, setDivisionFilter] = useState("");
  const [weekFilter, setWeekFilter] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [drafts, setDrafts] = useState<Record<number, DraftState | null>>({});
  // Phase per match, for every draft that exists. A match sitting in STARTING
  // before its first map still has status SCHEDULED, so the ACTIVE-only draft
  // fetch below never sees it.
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [scheduleMatch, setScheduleMatch] = useState<Match | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);
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
  const canSchedule = canManage || Boolean(networkUser?.roles.includes("DEVELOPER"));
  const accessReady = isHydrated && networkReady;

  useEffect(() => {
    let cancelled = false;
    const refreshNetworkUser = async () => {
      const sessionToken = token || readNetworkSessionToken();
      try {
        const current = sessionToken ? await getCurrentNetworkMember(sessionToken) : null;
        if (!cancelled) setNetworkUser(current);
      } catch { if (!cancelled) setNetworkUser(null); }
      finally { if (!cancelled) setNetworkReady(true); }
    };
    void refreshNetworkUser();
    window.addEventListener("network-session-changed", refreshNetworkUser);
    window.addEventListener("storage", refreshNetworkUser);
    return () => {
      cancelled = true;
      window.removeEventListener("network-session-changed", refreshNetworkUser);
      window.removeEventListener("storage", refreshNetworkUser);
    };
  }, [token]);

  useEffect(() => {
    if (accessReady && (!isAuthenticated || !canSchedule)) {
      router.push("/login");
    }
  }, [accessReady, isAuthenticated, canSchedule, router]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationsSupported(true);
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && canSchedule) {
      loadData();
    }
  }, [isAuthenticated, canSchedule, canManage]);

  useEffect(() => {
    if (!isAuthenticated || !canSchedule) return;
    pollRef.current = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadData(true);
    }, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isAuthenticated, canSchedule, canManage]);

  const sendNotification = useCallback((title: string, body: string) => {
    if (notificationPermission === "granted" && typeof window !== "undefined" && "Notification" in window) {
      new Notification(title, { body, icon: "/favicon.ico", tag: "manager-notification" });
    }
  }, [notificationPermission]);

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      const current = await getCurrentTournament({ cache: "no-store" });
      const [matchesData, teamsData, membersData, currentMember] = await Promise.all([
        getMatchesByTournament(current.id),
        getLeaderboard(current.id),
        canManage ? getMembers() : Promise.resolve<Member[]>([]),
        getCurrentNetworkMember(token || readNetworkSessionToken() || ""),
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
      setTournament(current);
      setNetworkUser(currentMember);
      setMembers(membersData);
      setDataError(null);

      const activeMatches = canManage ? matchesData.filter((m) => m.status === "ACTIVE") : [];
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
    if (!token || !canManage) return;
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

  /*
   * The casting dashboard renders this page inside an iframe. A plain
   * router.push there navigates the frame, so the draft table appeared
   * squeezed into the dashboard instead of opening. Break out to the top
   * window when embedded, which is what clicking the button plainly means.
   */
  const openDraftTable = useCallback(
    (matchId: number) => {
      const path = `/draft-table/${matchId}`;
      if (embedded && typeof window !== "undefined" && window.top && window.top !== window.self) {
        window.top.location.assign(path);
        return;
      }
      router.push(path);
    },
    [embedded, router]
  );

  const getTeamName = (teamId: number) =>
    teams.find((t) => t.id === teamId)?.name || `Team ${teamId}`;

  function openSchedule(match: Match) {
    const [date = "", time = ""] = (match.startDate ? formatForDateTimeInput(match.startDate) : "").split("T");
    setScheduleMatch(match);
    setScheduleDate(date);
    setScheduleTime(time.slice(0, 5));
    setScheduleError(null);
    setScheduleNotice(null);
  }

  async function saveSchedule() {
    if (!scheduleMatch || !scheduleDate || !scheduleTime || scheduleSaving) return;
    const sessionToken = token || readNetworkSessionToken();
    if (!sessionToken) { setScheduleError("Sign in again to save the schedule."); return; }
    setScheduleSaving(true);
    setScheduleError(null);
    try {
      const updated = await updateMatchSchedule(sessionToken, scheduleMatch.id, convertToISODateTime(`${scheduleDate}T${scheduleTime}`));
      setMatches((current) => current.map((match) => match.id === updated.id ? updated : match));
      setScheduleMatch(null);
      setScheduleNotice("Schedule saved. Your division's Discord scheduling channel will be notified.");
      void loadData(true);
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : "Unable to save the schedule.");
    } finally {
      setScheduleSaving(false);
    }
  }

  const visibleMatches = filterMatchesByDivision(matches, teams, divisionFilter ? Number(divisionFilter) : null)
    .filter((match) => !weekFilter || (match.type === "ROUNDROBIN" && String(match.semanas) === weekFilter));
  const scheduledMatches = visibleMatches.filter((m) => m.status === "SCHEDULED");
  const activeMatches = visibleMatches.filter((m) => m.status === "ACTIVE");
  const finishedMatches = visibleMatches.filter((m) => m.status === "FINISHED");
  const weeks = Array.from(new Set(matches.filter((match) => match.type === "ROUNDROBIN").map((match) => match.semanas || 1))).sort((a, b) => a - b);

  // Group scheduled matches by week
  const scheduledByWeek = scheduledMatches.reduce((acc, m) => {
    const division = m.divisionName || teams.find((team) => team.id === m.teamAId)?.divisionName;
    const w = m.type === "ROUNDROBIN" ? `${m.semanas || 1}${division ? ` · ${division}` : ""}` : `Playoffs · ${m.type}`;
    if (!acc[w]) acc[w] = [];
    acc[w].push(m);
    return acc;
  }, {} as Record<string, Match[]>);

  // Find the next upcoming match (soonest startDate)
  const nextMatch = scheduledMatches
    .filter((m) => m.startDate)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0] || null;

  // Average stats per player
  const playerAverages = (() => {
    const memberMap = new Map(members.map((m) => [m.id, m]));
    const byPlayer: Record<number, PlayerStat[]> = {};
    const matchIds = new Set(visibleMatches.map((match) => match.id));
    for (const s of allStats.filter((stat) => matchIds.has(stat.matchId))) {
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

  if (!isAuthenticated || !canSchedule) {
    return <div className="min-h-screen bg-background flex items-center justify-center" role="status"><div className="border border-border bg-surface px-6 py-5 text-muted">Redirecting to authorized access…</div></div>;
  }

  return (
    <main className={embedded ? "manager-workspace py-4" : "min-h-screen bg-background py-8"}>
      <div className="container mx-auto px-4">
        <header className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.kicker}>Overtime Productions</span>
            <h1 className={styles.title}>{embedded ? "League operations" : "Manager Dashboard"}</h1>
            <p className={styles.subtitle}>{tournament?.name || "League operations"} · {canManage ? "Manage matches, open draft tables, and register results" : "Schedule matches and notify each division on Discord"}</p>
          </div>
          <div className={styles.headerAside}>
            {networkUser?.roles.includes("ADMIN") && <Link href="/admin-dashboard/schedule" target={embedded ? "_top" : undefined} className="text-sm text-accent underline">Manage weekly schedule</Link>}
            {notificationsSupported && notificationPermission === "default" ? <Button size="sm" variant="secondary" onClick={() => void Notification.requestPermission().then(setNotificationPermission)}>Enable alerts</Button> : null}
            <span className={`${styles.livePill} ${dataError ? styles.livePillDown : ""}`}>
              <span className={styles.liveDot} aria-hidden="true" />
              {dataError ? "Updates interrupted" : "Live updates"}
            </span>
          </div>
        </header>

        {dataError ? <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-danger/50 bg-danger/10 p-4" role="alert"><span>Could not refresh league operations: {dataError}</span><Button size="sm" variant="secondary" onClick={() => void loadData()}>Try again</Button></div> : null}
        {scheduleNotice && <p role="status" className="mb-6 rounded-sm border border-success/30 bg-success/10 p-3 text-sm text-success">{scheduleNotice}</p>}
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <Select label="Division / league" value={divisionFilter} options={[{ value: "", label: "All divisions" }, ...(tournament?.divisions || []).map((division) => ({ value: String(division.id), label: division.name }))]} onChange={(event) => setDivisionFilter(event.target.value)} />
          <Select label="Week" value={weekFilter} options={[{ value: "", label: "All weeks" }, ...weeks.map((week) => ({ value: String(week), label: `Week ${week}` }))]} onChange={(event) => setWeekFilter(event.target.value)} />
        </div>

        {/* A match in progress is the state that needs someone watching, so it
            is the only counter that carries the accent. */}
        <div className={styles.counters}>
          {[
            { label: "Scheduled", count: scheduledMatches.length, accent: false },
            { label: "Active", count: activeMatches.length, accent: activeMatches.length > 0 },
          ].map(({ label, count, accent }) => (
            <div key={label} className={`${styles.counter} ${accent ? styles.counterAccent : ""}`}>
              <span className={styles.counterLabel}>{label}</span>
              <span className={styles.counterValue}>{count}</span>
            </div>
          ))}
        </div>

        {/* Next match highlight */}
        {nextMatch && (
          <div className={styles.nextBand}>
            <div>
              <div>
                <p className={styles.nextLabel}>Next Match</p>
                <p className={styles.nextTeams}>
                  {getTeamName(nextMatch.teamAId)} <span className={styles.nextVersus}>vs</span> {getTeamName(nextMatch.teamBId)}
                </p>
                <p className={styles.nextMeta}>
                  Week {nextMatch.semanas} &middot; BO{nextMatch.bestOf} &middot;{" "}
                  {nextMatch.startDate
                    ? formatDateTimeEST(nextMatch.startDate)
                    : "No date set"}
                </p>
              </div>
              <div className={styles.nextActions}>
                <Badge variant={nextMatch.teamAready ? "success" : "default"}>
                  {getTeamName(nextMatch.teamAId).slice(0, 8)}: {nextMatch.teamAready ? "✓" : "—"}
                </Badge>
                <Badge variant={nextMatch.teamBready ? "success" : "default"}>
                  {getTeamName(nextMatch.teamBId).slice(0, 8)}: {nextMatch.teamBready ? "✓" : "—"}
                </Badge>
                {canManage && <Button
                  onClick={() => openDraftTable(nextMatch.id)}
                  size="sm"
                >
                  View Draft
                </Button>}
                <Button size="sm" variant="secondary" onClick={() => openSchedule(nextMatch)}>Reschedule</Button>
              </div>
            </div>
          </div>
        )}

        <Tabs value={canManage ? activeTab : "scheduled"} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList className="mb-6">
            <TabsTrigger value="scheduled">Scheduled ({scheduledMatches.length})</TabsTrigger>
            {canManage && <TabsTrigger value="active">Active ({activeMatches.length})</TabsTrigger>}
            {canManage && <TabsTrigger value="results">Results ({finishedMatches.length})</TabsTrigger>}
            {canManage && <TabsTrigger value="stats">Stats</TabsTrigger>}
          </TabsList>

          {/* SCHEDULED TAB */}
          <TabsContent value="scheduled">
            <p className="mb-4 text-sm text-muted">Schedule or reschedule a pending match to notify its division&apos;s Discord scheduling channel. Enter times in Eastern Time (New York).</p>
            <div className="space-y-8">
              {loading ? (
                <p className="text-muted text-center py-8">Loading...</p>
              ) : scheduledMatches.length === 0 ? (
                <p className="text-muted text-center py-8">No scheduled matches.</p>
              ) : (
                Object.entries(scheduledByWeek)
                  .sort(([a], [b]) => (parseInt(a, 10) || 999) - (parseInt(b, 10) || 999) || a.localeCompare(b))
                  .map(([week, weekMatches]) => (
                    <div key={week}>
                      <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
                        {week.startsWith("Playoffs") ? week : `Week ${week}`}
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
                                      <OperationTeamLogo team={teams.find((team) => team.id === match.teamAId)} size="sm" />
                                      <span className="text-lg font-semibold text-foreground">{teamAName}</span>
                                      <span className="text-muted">vs</span>
                                      <span className="text-lg font-semibold text-foreground">{teamBName}</span>
                                      <OperationTeamLogo team={teams.find((team) => team.id === match.teamBId)} size="sm" />
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted">
                                      <Badge variant="secondary">{match.type}</Badge>
                                      <span>BO{match.bestOf}</span>
                                      {match.startDate && (
                                        <span>{formatDateTimeEST(match.startDate)}</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${match.teamAready ? "bg-success text-white" : "bg-surface-elevated text-muted"}`}>
                                      {teamAName.charAt(0)}
                                    </div>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${match.teamBready ? "bg-success text-white" : "bg-surface-elevated text-muted"}`}>
                                      {teamBName.charAt(0)}
                                    </div>
                                    <Button size="sm" variant="secondary" onClick={() => openSchedule(match)}>{match.startDate ? "Reschedule" : "Schedule"}</Button>
                                    {canManage && <Button
                                      onClick={() => openDraftTable(match.id)}
                                      size="sm"
                                    >
                                      View Draft
                                    </Button>}
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
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                  <OperationTeamLogo team={teams.find((team) => team.id === match.teamAId)} size="sm" />
                                  <span className="text-lg font-semibold text-foreground">{getTeamName(match.teamAId)}</span>
                                  <span className="font-mono text-xl text-accent">{match.mapWinsTeamA} - {match.mapWinsTeamB}</span>
                                  <span className="text-lg font-semibold text-foreground">{getTeamName(match.teamBId)}</span>
                                  <OperationTeamLogo team={teams.find((team) => team.id === match.teamBId)} size="sm" />
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <Badge variant="primary">Game {(match.gameNumber || 0) + 1}</Badge>
                                  {draft && <Badge variant="secondary">{draft.phase}</Badge>}
                                </div>
                              </div>
                              <Link href={`/draft-table/${match.id}`} target={embedded ? "_top" : undefined}>
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

          <TabsContent value="results">
            <Card variant="bordered"><CardHeader><CardTitle>Match results</CardTitle></CardHeader><CardContent>
              {!finishedMatches.length ? <p className="py-5 text-sm text-muted">No finished matches in this view.</p> : <div className="space-y-3">{finishedMatches.map((match) => <div key={match.id} className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-border p-4"><div><p className="mb-2 text-xs text-muted">{match.divisionName || "Playoffs"} · {match.semanas ? `Week ${match.semanas}` : match.type}</p><div className="flex flex-wrap items-center gap-3"><OperationTeamLogo team={teams.find((team) => team.id === match.teamAId)} size="sm" /><span className="text-sm font-medium">{getTeamName(match.teamAId)}</span><span className="font-mono text-xl text-accent">{match.mapWinsTeamA} – {match.mapWinsTeamB}</span><span className="text-sm font-medium">{getTeamName(match.teamBId)}</span><OperationTeamLogo team={teams.find((team) => team.id === match.teamBId)} size="sm" /></div></div><Button size="sm" variant="outline" onClick={() => openDraftTable(match.id)}>View draft & results</Button></div>)}</div>}
            </CardContent></Card>
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
        <Modal isOpen={scheduleMatch !== null} onClose={() => { if (!scheduleSaving) setScheduleMatch(null); }} title={scheduleMatch?.startDate ? "Reschedule Match" : "Schedule Match"}>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void saveSchedule(); }}>
            {scheduleMatch && <p className="text-sm text-muted">{getTeamName(scheduleMatch.teamAId)} vs {getTeamName(scheduleMatch.teamBId)}{scheduleMatch.divisionName ? ` · ${scheduleMatch.divisionName}` : ""}</p>}
            <p className="text-sm text-muted">Use Eastern Time (New York). Saving sends the match schedule to its division&apos;s Discord scheduling channel.</p>
            {scheduleError && <p role="alert" className="rounded-sm border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{scheduleError}</p>}
            <div className="grid grid-cols-2 gap-4">
              <Input label="Match date" type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} required disabled={scheduleSaving} />
              <Input label="Time (Eastern)" type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} required disabled={scheduleSaving} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={scheduleSaving} onClick={() => setScheduleMatch(null)}>Cancel</Button>
              <Button type="submit" disabled={!scheduleDate || !scheduleTime || scheduleSaving} isLoading={scheduleSaving}>Save & Notify Discord</Button>
            </div>
          </form>
        </Modal>
      </div>
    </main>
  );
}

export default function ManagerDashboardPage() {
  const searchParams = useSearchParams();
  return <ManagerDashboardWorkspace embedded={searchParams.get("embedded") === "1"} />;
}
