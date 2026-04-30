"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/features/session/SessionProvider";
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
  uploadMatchStatsScreenshotPreview,
  confirmMatchStatsUpload,
  managerTogglePause,
  managerClearPauseRequest,
  type Match,
  type Team,
  type DraftState,
  type Member,
  type MatchStatPreviewResponse,
  type MatchStatPreviewRow,
} from "@/lib/api";
import { formatDateEST, formatDateTimeEST } from "@/lib/dateUtils";
import type { PlayerStat } from "@/lib/api/types";

type TabValue = "scheduled" | "active" | "pending" | "stats";
type MapType = "CONTROL" | "HYBRID" | "PAYLOAD" | "PUSH" | "FLASHPOINT";
type HeroRole = "TANK" | "DPS" | "SUPPORT";

type PendingUploadFormState = {
  image: File | null;
  mapType: MapType;
  matchTitle: string;
};

type PlayerCandidate = {
  id: number;
  nickname: string;
};

const POLL_INTERVAL = 12000;

const DEFAULT_PENDING_UPLOAD_FORM: PendingUploadFormState = {
  image: null,
  mapType: "FLASHPOINT",
  matchTitle: "",
};

const normalizeNicknameForMatch = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/5/g, "S")
    .replace(/8/g, "B")
    .replace(/2/g, "Z");

function levenshteinDistance(a: string, b: string) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function nicknameMatchScore(inputNickname: string, candidateNickname: string) {
  const left = normalizeNicknameForMatch(inputNickname);
  const right = normalizeNicknameForMatch(candidateNickname);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if ((left.includes(right) || right.includes(left)) && Math.min(left.length, right.length) >= 4) return 0.9;
  const maxLen = Math.max(left.length, right.length);
  if (maxLen >= 4) {
    const similarity = 1 - levenshteinDistance(left, right) / maxLen;
    if (similarity >= 0.85) return 0.84;
    if (similarity >= 0.72) return 0.72;
  }
  return 0;
}

function findBestPlayerMatch(
  nickname: string,
  candidates: PlayerCandidate[],
  usedIds: Set<number>,
  keepCurrentId?: number | null
) {
  let best: PlayerCandidate | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    if (candidate.id !== keepCurrentId && usedIds.has(candidate.id)) continue;
    const score = nicknameMatchScore(nickname, candidate.nickname);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return bestScore >= 0.7 ? best : null;
}

export default function ManagerDashboardPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated } = useSession();
  const [activeTab, setActiveTab] = useState<TabValue>("scheduled");
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [drafts, setDrafts] = useState<Record<number, DraftState | null>>({});
  const [loading, setLoading] = useState(true);
  const [creatingDraft, setCreatingDraft] = useState<number | null>(null);
  const [activeStatMatchId, setActiveStatMatchId] = useState<number | null>(null);
  const [uploadForms, setUploadForms] = useState<Record<number, PendingUploadFormState>>({});
  const [matchPreviews, setMatchPreviews] = useState<Record<number, MatchStatPreviewResponse[]>>({});
  const [parsingMatchId, setParsingMatchId] = useState<number | null>(null);
  const [confirmingMatchId, setConfirmingMatchId] = useState<number | null>(null);
  const [uploadMessages, setUploadMessages] = useState<Record<number, string>>({});
  const [finishingMatchId, setFinishingMatchId] = useState<number | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  // Stats tab state
  const [allStats, setAllStats] = useState<PlayerStat[]>([]);
  const [statsSearch, setStatsSearch] = useState("");
  const [statsTopFilter, setStatsTopFilter] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const prevMatchesRef = useRef<Match[]>([]);

  useEffect(() => {
    if (isHydrated && (!isAuthenticated || user?.role !== "MANAGER")) {
      router.push("/login");
    }
  }, [isHydrated, isAuthenticated, user, router]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission().then(setNotificationPermission);
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.role === "MANAGER") {
      loadData();
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "MANAGER") return;
    pollRef.current = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadData(true);
    }, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isAuthenticated, user]);

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
    } catch (err) {
      console.error("Failed to load stats:", err);
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
      console.error("Failed to create draft:", err);
      alert("Failed to create draft table. Make sure both teams are ready.");
    } finally {
      setCreatingDraft(null);
    }
  }

  function getPlayersForMatch(match: Match) {
    return members.filter((member) => member.teamId === match.teamAId || member.teamId === match.teamBId);
  }

  function getOrCreateUploadForm(matchId: number) {
    return uploadForms[matchId] ?? DEFAULT_PENDING_UPLOAD_FORM;
  }

  function openStatForm(match: Match) {
    const matchId = match.id;
    setActiveStatMatchId((prev) => (prev === matchId ? null : matchId));
    setUploadForms((prev) => {
      if (prev[matchId]) return prev;
      return {
        ...prev,
        [matchId]: {
          ...DEFAULT_PENDING_UPLOAD_FORM,
          matchTitle: String(match.title || ""),
        },
      };
    });
  }

  function updateUploadForm(matchId: number, patch: Partial<PendingUploadFormState>) {
    setUploadForms((prev) => ({
      ...prev,
      [matchId]: { ...(prev[matchId] ?? DEFAULT_PENDING_UPLOAD_FORM), ...patch },
    }));
  }

  function updatePreviewRow(matchId: number, previewIndex: number, rowIndex: number, patch: Partial<MatchStatPreviewRow>) {
    setMatchPreviews((prev) => {
      const previews = prev[matchId] || [];
      const target = previews[previewIndex];
      if (!target) return prev;
      const rows = [...target.rows];
      rows[rowIndex] = { ...rows[rowIndex], ...patch };
      const nextPreviews = [...previews];
      nextPreviews[previewIndex] = { ...target, rows };
      return { ...prev, [matchId]: nextPreviews };
    });
  }

  async function handleParseScreenshot(match: Match) {
    if (!token) return;
    const matchPlayers = getPlayersForMatch(match);
    const form = getOrCreateUploadForm(match.id);
    const expectedGames = Math.max(1, (match.mapWinsTeamA || 0) + (match.mapWinsTeamB || 0));
    const existingPreviews = matchPreviews[match.id] || [];
    if (existingPreviews.length >= expectedGames) {
      setUploadMessages((prev) => ({
        ...prev,
        [match.id]: `All ${expectedGames} game screenshot(s) are already uploaded.`,
      }));
      return;
    }
    if (!form.image) {
      setUploadMessages((prev) => ({ ...prev, [match.id]: "Please select a screenshot image first." }));
      return;
    }

    setParsingMatchId(match.id);
    setUploadMessages((prev) => ({ ...prev, [match.id]: "Reading screenshot and auto-filling 10 players..." }));

    try {
      const response = await uploadMatchStatsScreenshotPreview(token, {
        image: form.image,
        matchId: match.id,
        mapType: form.mapType,
      });

      const candidatePlayers = (response.players?.length ? response.players : matchPlayers) as PlayerCandidate[];
      const usedIds = new Set<number>();
      const parsedRows = response.rows.map((row) => {
        if (row.userId) {
          usedIds.add(row.userId);
          return row;
        }
        const auto = findBestPlayerMatch(row.nickname, candidatePlayers, usedIds, row.userId);
        if (!auto) return row;
        usedIds.add(auto.id);
        return { ...row, userId: auto.id, userFound: true, nickname: row.nickname || auto.nickname };
      });

      const paddedRows = [...parsedRows];
      while (paddedRows.length < 10) {
        paddedRows.push({ nickname: "", userId: null, role: "DPS", kills: 0, assists: 0, deaths: 0, damage: 0, healing: 0, mitigation: 0, userFound: false });
      }

      setMatchPreviews((prev) => {
        const existing = prev[match.id] || [];
        return { ...prev, [match.id]: [...existing, { ...response, rows: paddedRows.slice(0, 10) }] };
      });
      setUploadMessages((prev) => ({ ...prev, [match.id]: "Screenshot parsed. Verify players, then confirm." }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to parse screenshot.";
      setUploadMessages((prev) => ({ ...prev, [match.id]: message }));
    } finally {
      setParsingMatchId(null);
    }
  }

  async function handleConfirmBatch(matchId: number) {
    if (!token) return;
    const form = getOrCreateUploadForm(matchId);
    const title = form.matchTitle.trim();
    if (!title) {
      setUploadMessages((prev) => ({
        ...prev,
        [matchId]: "Please set a match title first (example: MATCH OF NEPAL).",
      }));
      return;
    }

    const previews = matchPreviews[matchId] || [];
    const expectedGames = Math.max(1, (matches.find((m) => m.id === matchId)?.mapWinsTeamA || 0) + (matches.find((m) => m.id === matchId)?.mapWinsTeamB || 0));
    if (previews.length < expectedGames) {
      setUploadMessages((prev) => ({
        ...prev,
        [matchId]: `Upload ${expectedGames} screenshot(s) before confirming (${previews.length}/${expectedGames} ready).`,
      }));
      return;
    }
    const previewsToSave = previews.slice(0, expectedGames);
    if (!previews.length) {
      setUploadMessages((prev) => ({ ...prev, [matchId]: "Parse a screenshot first." }));
      return;
    }

    for (let batchIndex = 0; batchIndex < previewsToSave.length; batchIndex += 1) {
      const rows = previewsToSave[batchIndex].rows.slice(0, 10);
      for (let i = 0; i < rows.length; i += 1) {
        if (!rows[i].userId) {
          setUploadMessages((prev) => ({ ...prev, [matchId]: `Game ${batchIndex + 1}, Row ${i + 1}: select a player user.` }));
          return;
        }
      }
    }

    setConfirmingMatchId(matchId);
    setUploadMessages((prev) => ({ ...prev, [matchId]: "Saving player stats..." }));

    try {
      await updateManagerMatch(token, matchId, { title });

      let totalSaved = 0;
      for (let batchIndex = 0; batchIndex < previewsToSave.length; batchIndex += 1) {
        const preview = previewsToSave[batchIndex];
        const rows = preview.rows.slice(0, 10);
        const result = await confirmMatchStatsUpload(token, {
          matchId,
          mapType: preview.mapType,
          gameNumber: batchIndex + 1,
          gameDuration: preview.gameDuration,
          rows: rows.map((row) => ({
            userId: Number(row.userId),
            role: row.role,
            kills: Number(row.kills),
            assists: Number(row.assists),
            deaths: Number(row.deaths),
            damage: Number(row.damage),
            healing: Number(row.healing),
            mitigation: Number(row.mitigation),
          })),
        });
        totalSaved += result.count;
      }
      setUploadMessages((prev) => ({
        ...prev,
        [matchId]: `Saved ${totalSaved} player stats across ${previewsToSave.length} game(s) for ${title}. Mark as finished when done.`,
      }));
      setMatchPreviews((prev) => ({ ...prev, [matchId]: [] }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save match stats.";
      setUploadMessages((prev) => ({ ...prev, [matchId]: message }));
    } finally {
      setConfirmingMatchId(null);
    }
  }

  async function handleFinishMatch(matchId: number) {
    if (!token) return;
    setFinishingMatchId(matchId);
    try {
      await finishPendingRegisters(token, matchId);
      setUploadMessages((prev) => ({ ...prev, [matchId]: "Match moved to FINISHED." }));
      await loadData(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to mark match as finished.";
      setUploadMessages((prev) => ({ ...prev, [matchId]: message }));
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

  if (!isHydrated) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted">Loading...</div></div>;
  }

  if (!isAuthenticated || user?.role !== "MANAGER") return null;

  return (
    <main className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Manager Dashboard</h1>
            <p className="text-muted mt-1">Manage matches, create draft tables, and upload results</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-muted">Live updates</span>
          </div>
        </div>

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
                  Week {nextMatch.semanas} · BO{nextMatch.bestOf} ·{" "}
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
                      const form = getOrCreateUploadForm(match.id);
                      const previews = matchPreviews[match.id] || [];
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
                                Upload one scoreboard screenshot per game. The system auto-fills 10 players using OCR.
                                Verify the names, assign users and roles, then confirm.
                              </p>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <label className="text-sm md:col-span-3">
                                  <span className="text-muted block mb-1">Match Title</span>
                                  <input
                                    type="text"
                                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                                    placeholder="MATCH OF NEPAL"
                                    value={form.matchTitle}
                                    onChange={(e) => updateUploadForm(match.id, { matchTitle: e.target.value })}
                                  />
                                </label>

                                <label className="text-sm">
                                  <span className="text-muted block mb-1">Map Type</span>
                                  <select
                                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                                    value={form.mapType}
                                    onChange={(e) => updateUploadForm(match.id, { mapType: e.target.value as MapType })}
                                  >
                                    {["CONTROL", "HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"].map((t) => (
                                      <option key={t} value={t}>{t}</option>
                                    ))}
                                  </select>
                                </label>

                                <label className="text-sm">
                                  <span className="text-muted block mb-1">Screenshot</span>
                                  <input
                                    type="file" accept="image/*"
                                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                                    onChange={(e) => updateUploadForm(match.id, { image: e.target.files?.[0] ?? null })}
                                  />
                                </label>
                              </div>

                              <div className="flex flex-wrap items-center gap-3">
                                <Button onClick={() => void handleParseScreenshot(match)} disabled={parsingMatchId === match.id}>
                                  {parsingMatchId === match.id ? "Parsing..." : "Parse Screenshot (OCR)"}
                                </Button>
                                <Button
                                  onClick={() => void handleConfirmBatch(match.id)}
                                  disabled={!previews.length || confirmingMatchId === match.id}
                                >
                                  {confirmingMatchId === match.id ? "Saving..." : `Confirm ${previews.length} Game(s)`}
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => void handleFinishMatch(match.id)}
                                  disabled={finishingMatchId === match.id}
                                >
                                  {finishingMatchId === match.id ? "Finishing..." : "Mark Match Finished"}
                                </Button>
                                {uploadMessages[match.id] && (
                                  <span className="text-sm text-muted">{uploadMessages[match.id]}</span>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {Array.from({ length: expectedGames }).map((_, slotIndex) => {
                                  const preview = previews[slotIndex];
                                  return (
                                    <div
                                      key={slotIndex}
                                      className={`rounded-md border p-3 ${preview ? "border-success/40 bg-success/5" : "border-border bg-surface/40"}`}
                                    >
                                      <p className="text-sm font-semibold text-foreground">Game {slotIndex + 1}</p>
                                      <p className="text-xs text-muted">
                                        {preview ? "Screenshot loaded" : "Pending screenshot"}
                                      </p>
                                      {preview && (
                                        <p className="text-xs text-muted mt-1">
                                          {preview.mapType} · {preview.gameDuration ? `${preview.gameDuration}s` : "Duration TBD"}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {previews.map((preview, previewIndex) => (
                                <div key={previewIndex} className="space-y-3 rounded-md border border-border p-3 bg-surface/40">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-foreground">Game Screenshot #{previewIndex + 1}</p>
                                    <p className="text-xs text-muted">{preview.mapType}</p>
                                  </div>

                                  <label className="text-sm block">
                                    <span className="text-muted">Match Duration (seconds)</span>
                                    <input
                                      type="number" min={0}
                                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                                      value={preview.gameDuration}
                                      onChange={(e) =>
                                        setMatchPreviews((prev) => {
                                          const list = [...(prev[match.id] || [])];
                                          list[previewIndex] = { ...preview, gameDuration: Number(e.target.value || 0) };
                                          return { ...prev, [match.id]: list };
                                        })
                                      }
                                    />
                                  </label>

                                  <div className="overflow-x-auto rounded-md border border-border">
                                    <table className="w-full text-sm">
                                      <thead className="bg-surface">
                                        <tr>
                                          {["#", "OCR Nick", "User", "Role", "K", "A", "D", "DMG", "HEAL", "MIT"].map((h) => (
                                            <th key={h} className="px-2 py-2 text-left text-xs">{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {preview.rows.slice(0, 10).map((row, rowIndex) => (
                                          <tr key={rowIndex} className={`border-t border-border ${row.userFound ? "" : "bg-warning/5"}`}>
                                            <td className="px-2 py-1 text-xs text-muted">{rowIndex + 1}</td>
                                            <td className="px-2 py-1">
                                              <input
                                                className="w-28 rounded border border-border bg-background px-2 py-1 text-xs"
                                                value={row.nickname}
                                                onChange={(e) => {
                                                  const nickname = e.target.value;
                                                  const selectedPlayers = new Set(
                                                    preview.rows.filter((_, i) => i !== rowIndex).map((r) => r.userId).filter((id): id is number => Boolean(id))
                                                  );
                                                  const candidatePlayers = (preview.players?.length ? preview.players : matchPlayers) as PlayerCandidate[];
                                                  const auto = findBestPlayerMatch(nickname, candidatePlayers, selectedPlayers, row.userId);
                                                  updatePreviewRow(match.id, previewIndex, rowIndex, {
                                                    nickname,
                                                    ...(auto && (!row.userId || !row.userFound) ? { userId: auto.id, userFound: true } : {}),
                                                  });
                                                }}
                                              />
                                            </td>
                                            <td className="px-2 py-1">
                                              <select
                                                className="w-36 rounded border border-border bg-background px-2 py-1 text-xs"
                                                value={row.userId ?? ""}
                                                onChange={(e) => updatePreviewRow(match.id, previewIndex, rowIndex, { userId: e.target.value ? Number(e.target.value) : null })}
                                              >
                                                <option value="">— select —</option>
                                                {(preview.players?.length ? preview.players : matchPlayers).map((player) => (
                                                  <option key={player.id} value={player.id}>{player.nickname}</option>
                                                ))}
                                              </select>
                                            </td>
                                            <td className="px-2 py-1">
                                              <select
                                                className="w-20 rounded border border-border bg-background px-2 py-1 text-xs"
                                                value={row.role}
                                                onChange={(e) => updatePreviewRow(match.id, previewIndex, rowIndex, { role: e.target.value as HeroRole })}
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
                                                  onChange={(e) => updatePreviewRow(match.id, previewIndex, rowIndex, { [field]: Number(e.target.value || 0) })}
                                                />
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                  {preview.ocrPreview && (
                                    <details className="text-xs">
                                      <summary className="cursor-pointer text-muted">OCR raw text (debug)</summary>
                                      <pre className="mt-2 p-2 bg-surface rounded text-foreground whitespace-pre-wrap">{preview.ocrPreview}</pre>
                                    </details>
                                  )}
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
