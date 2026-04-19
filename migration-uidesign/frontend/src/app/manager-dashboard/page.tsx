"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/features/session/SessionProvider";
import { getMembers, type Member } from "@/lib/api/admin";
import {
  uploadMatchStatsScreenshotPreview,
  confirmMatchStatsUpload,
  type MatchStatPreviewResponse,
  type MatchStatPreviewRow,
} from "@/lib/api/playerStat";
import { finishPendingRegisters } from "@/lib/api/match";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { getMatches, getTeams, createDraft, getDraftByMatchId, type Match, type Team, type DraftState } from "@/lib/api";

type TabValue = "scheduled" | "active" | "pending";
type MapType = "CONTROL" | "HYBRID" | "PAYLOAD" | "PUSH" | "FLASHPOINT";
type HeroRole = "TANK" | "DPS" | "SUPPORT";

type PendingUploadFormState = {
  image: File | null;
  mapType: MapType;
  extraRounds: string;
};

type PlayerCandidate = {
  id: number;
  nickname: string;
};

const POLL_INTERVAL = 3000; // 3 seconds for real-time updates

const DEFAULT_PENDING_UPLOAD_FORM: PendingUploadFormState = {
  image: null,
  mapType: "FLASHPOINT",
  extraRounds: "0",
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

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const prevMatchesRef = useRef<Match[]>([]);

  // Redirect non-manager users
  useEffect(() => {
    if (isHydrated && (!isAuthenticated || user?.role !== "MANAGER")) {
      router.push("/login");
    }
  }, [isHydrated, isAuthenticated, user, router]);

  // Request notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission().then((permission) => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.role === "MANAGER") {
      loadData();
    }
  }, [isAuthenticated, user]);

  // Real-time polling
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "MANAGER") return;

    pollRef.current = setInterval(() => {
      loadData(true); // silent refresh
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isAuthenticated, user]);

  const sendNotification = useCallback((title: string, body: string) => {
    if (notificationPermission === "granted" && typeof window !== "undefined" && "Notification" in window) {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: "manager-notification",
      });
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

      // Check for ready status changes
      for (const match of matchesData) {
        const prevMatch = prevMatchesRef.current.find((m) => m.id === match.id);
        if (prevMatch) {
          // Both teams just became ready
          const wasNotBothReady = !(prevMatch.teamAready === 1 && prevMatch.teamBready === 1);
          const isNowBothReady = match.teamAready === 1 && match.teamBready === 1;
          if (wasNotBothReady && isNowBothReady && match.status === "SCHEDULED") {
            const teamAName = teamsData.find((t) => t.id === match.teamAId)?.name || "Team A";
            const teamBName = teamsData.find((t) => t.id === match.teamBId)?.name || "Team B";
            sendNotification(
              "Teams Ready!",
              `${teamAName} vs ${teamBName} - Both teams are ready. You can create the draft table.`
            );
          }
          // Check for individual team ready changes
          if (prevMatch.teamAready !== match.teamAready || prevMatch.teamBready !== match.teamBready) {
            // Trigger UI update by forcing re-render
          }
        }
      }

      prevMatchesRef.current = matchesData;
      setMatches(matchesData);
      setTeams(teamsData);
      setMembers(membersData);

      // Load draft states for active matches
      const activeMatches = matchesData.filter((m) => m.status === "ACTIVE" || m.status === "PENDINGREGISTERS");
      const draftPromises = activeMatches.map(async (match) => {
        try {
          const draft = await getDraftByMatchId(match.id);
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

  async function handleCreateDraft(matchId: number) {
    if (!token) return;
    setCreatingDraft(matchId);
    try {
      await createDraft(token, matchId);
      // Navigate to the draft table using matchId
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

  function openStatForm(matchId: number) {
    setActiveStatMatchId((prev) => (prev === matchId ? null : matchId));
    setUploadForms((prev) => {
      if (prev[matchId]) return prev;
      return { ...prev, [matchId]: { ...DEFAULT_PENDING_UPLOAD_FORM } };
    });
  }

  function updateUploadForm(matchId: number, patch: Partial<PendingUploadFormState>) {
    setUploadForms((prev) => ({
      ...prev,
      [matchId]: {
        ...(prev[matchId] ?? DEFAULT_PENDING_UPLOAD_FORM),
        ...patch,
      },
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
      return {
        ...prev,
        [matchId]: nextPreviews,
      };
    });
  }

  async function handleParseScreenshot(match: Match) {
    if (!token) return;
    const matchPlayers = getPlayersForMatch(match);

    const form = getOrCreateUploadForm(match.id);
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
        extraRounds: Number(form.extraRounds || 0),
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
        return {
          ...row,
          userId: auto.id,
          userFound: true,
          nickname: row.nickname || auto.nickname,
        };
      });

      const paddedRows = [...parsedRows];
      while (paddedRows.length < 10) {
        paddedRows.push({
          nickname: "",
          userId: null,
          role: "DPS",
          kills: 0,
          assists: 0,
          deaths: 0,
          damage: 0,
          healing: 0,
          mitigation: 0,
          userFound: false,
        });
      }

      setMatchPreviews((prev) => {
        const existing = prev[match.id] || [];
        return {
          ...prev,
          [match.id]: [
            ...existing,
            {
              ...response,
              rows: paddedRows.slice(0, 10),
            },
          ],
        };
      });

      setUploadMessages((prev) => ({
        ...prev,
        [match.id]: "Screenshot parsed and added as a game batch. You can add more screenshots and confirm all.",
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to parse screenshot.";
      setUploadMessages((prev) => ({ ...prev, [match.id]: message }));
    } finally {
      setParsingMatchId(null);
    }
  }

  async function handleConfirmBatch(matchId: number) {
    if (!token) return;
    const previews = matchPreviews[matchId] || [];
    if (!previews.length) {
      setUploadMessages((prev) => ({ ...prev, [matchId]: "Parse a screenshot first." }));
      return;
    }

    for (let batchIndex = 0; batchIndex < previews.length; batchIndex += 1) {
      const rows = previews[batchIndex].rows.slice(0, 10);
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (!row.userId) {
          setUploadMessages((prev) => ({
            ...prev,
            [matchId]: `Game ${batchIndex + 1}, Row ${i + 1}: select a player user.`,
          }));
          return;
        }
      }
    }

    setConfirmingMatchId(matchId);
    setUploadMessages((prev) => ({ ...prev, [matchId]: "Saving player stats for all parsed games..." }));

    try {
      let totalSaved = 0;
      for (const preview of previews) {
        const rows = preview.rows.slice(0, 10);
        const result = await confirmMatchStatsUpload(token, {
          matchId,
          mapType: preview.mapType,
          extraRounds: preview.extraRounds,
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
        [matchId]: `Saved ${totalSaved} player stats across ${previews.length} game screenshot(s). You can now mark the match as finished.`,
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

  // Filter matches by status
  const scheduledMatches = matches.filter((m) => m.status === "SCHEDULED");
  const activeMatches = matches.filter((m) => m.status === "ACTIVE");
  const pendingMatches = matches.filter((m) => m.status === "PENDINGREGISTERS");

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "MANAGER") {
    return null;
  }

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

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Scheduled</p>
                  <p className="text-3xl font-bold text-foreground">{scheduledMatches.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center">
                  <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Active</p>
                  <p className="text-3xl font-bold text-accent">{activeMatches.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Pending Results</p>
                  <p className="text-3xl font-bold text-warning">{pendingMatches.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList className="mb-6">
            <TabsTrigger value="scheduled">
              Scheduled ({scheduledMatches.length})
            </TabsTrigger>
            <TabsTrigger value="active">
              Active ({activeMatches.length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending Results ({pendingMatches.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scheduled">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Matches</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted text-center py-8">Loading...</p>
                ) : scheduledMatches.length === 0 ? (
                  <p className="text-muted text-center py-8">No scheduled matches.</p>
                ) : (
                  <div className="space-y-4">
                    {scheduledMatches.map((match) => {
                      const bothReady = match.teamAready === 1 && match.teamBready === 1;
                      const teamAName = getTeamName(match.teamAId);
                      const teamBName = getTeamName(match.teamBId);
                      
                      return (
                        <div
                          key={match.id}
                          className={`border rounded-lg p-4 transition-all ${
                            bothReady 
                              ? "border-success bg-success/5 animate-pulse" 
                              : "border-border bg-surface"
                          }`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            {/* Match Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-lg font-semibold text-foreground">{teamAName}</span>
                                <span className="text-muted">vs</span>
                                <span className="text-lg font-semibold text-foreground">{teamBName}</span>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted">
                                <Badge variant="secondary">{match.type}</Badge>
                                <span>BO{match.bestOf}</span>
                                <span>
                                  {new Date(match.startDate).toLocaleDateString()}{" "}
                                  {new Date(match.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            </div>

                            {/* Ready Status */}
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col items-center">
                                <span className="text-xs text-muted mb-1">{teamAName.slice(0, 8)}</span>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                  match.teamAready ? "bg-success text-success-foreground" : "bg-surface-elevated text-muted"
                                }`}>
                                  {match.teamAready ? (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-xs text-muted mb-1">{teamBName.slice(0, 8)}</span>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                  match.teamBready ? "bg-success text-success-foreground" : "bg-surface-elevated text-muted"
                                }`}>
                                  {match.teamBready ? (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action */}
                            <div className="flex items-center">
                              <Button
                                onClick={() => handleCreateDraft(match.id)}
                                disabled={!bothReady || creatingDraft === match.id}
                                className={bothReady ? "" : "opacity-50"}
                              >
                                {creatingDraft === match.id ? (
                                  "Creating..."
                                ) : bothReady ? (
                                  <>
                                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    </svg>
                                    Create Draft
                                  </>
                                ) : (
                                  "Waiting for Teams"
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle>Active Matches</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted text-center py-8">Loading...</p>
                ) : activeMatches.length === 0 ? (
                  <p className="text-muted text-center py-8">No active matches.</p>
                ) : (
                  <div className="space-y-4">
                    {activeMatches.map((match) => {
                      const draft = drafts[match.id];
                      const teamAName = getTeamName(match.teamAId);
                      const teamBName = getTeamName(match.teamBId);
                      
                      return (
                        <div
                          key={match.id}
                          className="border border-accent/30 rounded-lg p-4 bg-accent/5"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            {/* Match Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-lg font-semibold text-foreground">{teamAName}</span>
                                <span className="font-mono text-xl text-accent">{match.mapWinsTeamA} - {match.mapWinsTeamB}</span>
                                <span className="text-lg font-semibold text-foreground">{teamBName}</span>
                              </div>
                              <div className="flex items-center gap-3 text-sm">
                                <Badge variant="primary">Game {match.gameNumber}</Badge>
                                {draft && (
                                  <Badge variant="secondary">{draft.phase}</Badge>
                                )}
                              </div>
                            </div>

                            {/* Action */}
                            <Link href={`/draft-table/${match.id}`}>
                              <Button variant="secondary">
                                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View Draft
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Pending Results</CardTitle>
              </CardHeader>
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
                      const isOpen = activeStatMatchId === match.id;

                      return (
                        <div key={match.id} className="border border-warning/30 rounded-lg p-4 bg-warning/5">
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-lg font-semibold text-foreground">{teamAName}</span>
                                <span className="font-mono text-lg text-warning">{match.mapWinsTeamA} - {match.mapWinsTeamB}</span>
                                <span className="text-lg font-semibold text-foreground">{teamBName}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted">
                                <Badge variant="secondary">{match.type}</Badge>
                                <span>BO{match.bestOf}</span>
                                <span>Next: register player screenshots</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="secondary" onClick={() => openStatForm(match.id)}>
                                {isOpen ? "Hide Stat Form" : "Register Stats"}
                              </Button>
                              <Link href={`/draft-table/${match.id}`}>
                                <Button size="sm" variant="secondary">View Draft</Button>
                              </Link>
                            </div>
                          </div>

                          {isOpen && (
                            <div className="mt-4 border-t border-border pt-4 space-y-4">
                              <p className="text-sm text-muted">
                                Upload one scoreboard screenshot. The system auto-fills 10 players, and you only confirm names, users, roles and values.
                              </p>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <label className="text-sm">
                                  <span className="text-muted">Map Type</span>
                                  <select
                                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                                    value={form.mapType}
                                    onChange={(e) => updateUploadForm(match.id, { mapType: e.target.value as MapType })}
                                  >
                                    <option value="CONTROL">CONTROL</option>
                                    <option value="HYBRID">HYBRID</option>
                                    <option value="PAYLOAD">PAYLOAD</option>
                                    <option value="PUSH">PUSH</option>
                                    <option value="FLASHPOINT">FLASHPOINT</option>
                                  </select>
                                </label>

                                <label className="text-sm">
                                  <span className="text-muted">Extra Rounds</span>
                                  <input
                                    type="number"
                                    min={0}
                                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                                    value={form.extraRounds}
                                    onChange={(e) => updateUploadForm(match.id, { extraRounds: e.target.value })}
                                  />
                                </label>

                                <label className="text-sm">
                                  <span className="text-muted">Screenshot</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                                    onChange={(e) => updateUploadForm(match.id, { image: e.target.files?.[0] ?? null })}
                                  />
                                </label>
                              </div>

                              <div className="flex items-center gap-3">
                                <Button
                                  onClick={() => void handleParseScreenshot(match)}
                                  disabled={parsingMatchId === match.id}
                                >
                                  {parsingMatchId === match.id ? "Parsing..." : "Parse Screenshot"}
                                </Button>
                                <Button
                                  onClick={() => void handleConfirmBatch(match.id)}
                                  disabled={!previews.length || confirmingMatchId === match.id}
                                >
                                  {confirmingMatchId === match.id ? "Saving..." : "Confirm 10 Players"}
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

                              {previews.map((preview, previewIndex) => (
                                <div key={previewIndex} className="space-y-3 rounded-md border border-border p-3 bg-surface/40">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-foreground">Game Screenshot #{previewIndex + 1}</p>
                                    <p className="text-xs text-muted">{preview.mapType}</p>
                                  </div>

                                  <label className="text-sm block">
                                    <span className="text-muted">Detected Match Duration (seconds)</span>
                                    <input
                                      type="number"
                                      min={0}
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
                                          <th className="px-2 py-2 text-left">#</th>
                                          <th className="px-2 py-2 text-left">Nickname</th>
                                          <th className="px-2 py-2 text-left">User</th>
                                          <th className="px-2 py-2 text-left">Role</th>
                                          <th className="px-2 py-2 text-left">K</th>
                                          <th className="px-2 py-2 text-left">A</th>
                                          <th className="px-2 py-2 text-left">D</th>
                                          <th className="px-2 py-2 text-left">DMG</th>
                                          <th className="px-2 py-2 text-left">HEAL</th>
                                          <th className="px-2 py-2 text-left">MIT</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {preview.rows.slice(0, 10).map((row, rowIndex) => (
                                          <tr key={rowIndex} className="border-t border-border">
                                            <td className="px-2 py-2">{rowIndex + 1}</td>
                                            <td className="px-2 py-2">
                                              <input
                                                className="w-36 rounded border border-border bg-background px-2 py-1"
                                                value={row.nickname}
                                                onChange={(e) => {
                                                  const nickname = e.target.value;
                                                  const selectedPlayers = new Set(
                                                    preview.rows
                                                      .filter((_, i) => i !== rowIndex)
                                                      .map((r) => r.userId)
                                                      .filter((id): id is number => Boolean(id))
                                                  );
                                                  const candidatePlayers = (preview.players?.length
                                                    ? preview.players
                                                    : matchPlayers) as PlayerCandidate[];
                                                  const auto = findBestPlayerMatch(
                                                    nickname,
                                                    candidatePlayers,
                                                    selectedPlayers,
                                                    row.userId
                                                  );

                                                  updatePreviewRow(match.id, previewIndex, rowIndex, {
                                                    nickname,
                                                    ...(auto && (!row.userId || !row.userFound)
                                                      ? { userId: auto.id, userFound: true }
                                                      : {}),
                                                  });
                                                }}
                                              />
                                            </td>
                                            <td className="px-2 py-2">
                                              <select
                                                className="w-44 rounded border border-border bg-background px-2 py-1"
                                                value={row.userId ?? ""}
                                                onChange={(e) => updatePreviewRow(match.id, previewIndex, rowIndex, { userId: e.target.value ? Number(e.target.value) : null })}
                                              >
                                                <option value="">Manual select</option>
                                                {(preview.players?.length ? preview.players : matchPlayers).map((player) => (
                                                  <option key={player.id} value={player.id}>
                                                    {player.nickname}
                                                  </option>
                                                ))}
                                              </select>
                                            </td>
                                            <td className="px-2 py-2">
                                              <select
                                                className="w-24 rounded border border-border bg-background px-2 py-1"
                                                value={row.role}
                                                onChange={(e) => updatePreviewRow(match.id, previewIndex, rowIndex, { role: e.target.value as HeroRole })}
                                              >
                                                <option value="TANK">TANK</option>
                                                <option value="DPS">DPS</option>
                                                <option value="SUPPORT">SUPPORT</option>
                                              </select>
                                            </td>
                                            <td className="px-2 py-2"><input type="number" min={0} className="w-16 rounded border border-border bg-background px-2 py-1" value={row.kills} onChange={(e) => updatePreviewRow(match.id, previewIndex, rowIndex, { kills: Number(e.target.value || 0) })} /></td>
                                            <td className="px-2 py-2"><input type="number" min={0} className="w-16 rounded border border-border bg-background px-2 py-1" value={row.assists} onChange={(e) => updatePreviewRow(match.id, previewIndex, rowIndex, { assists: Number(e.target.value || 0) })} /></td>
                                            <td className="px-2 py-2"><input type="number" min={0} className="w-16 rounded border border-border bg-background px-2 py-1" value={row.deaths} onChange={(e) => updatePreviewRow(match.id, previewIndex, rowIndex, { deaths: Number(e.target.value || 0) })} /></td>
                                            <td className="px-2 py-2"><input type="number" min={0} className="w-24 rounded border border-border bg-background px-2 py-1" value={row.damage} onChange={(e) => updatePreviewRow(match.id, previewIndex, rowIndex, { damage: Number(e.target.value || 0) })} /></td>
                                            <td className="px-2 py-2"><input type="number" min={0} className="w-24 rounded border border-border bg-background px-2 py-1" value={row.healing} onChange={(e) => updatePreviewRow(match.id, previewIndex, rowIndex, { healing: Number(e.target.value || 0) })} /></td>
                                            <td className="px-2 py-2"><input type="number" min={0} className="w-24 rounded border border-border bg-background px-2 py-1" value={row.mitigation} onChange={(e) => updatePreviewRow(match.id, previewIndex, rowIndex, { mitigation: Number(e.target.value || 0) })} /></td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                  {preview.ocrPreview && (
                                    <div className="rounded-md border border-border bg-surface p-3">
                                      <p className="text-xs uppercase tracking-wide text-muted mb-1">OCR Preview</p>
                                      <pre className="text-xs whitespace-pre-wrap text-foreground">{preview.ocrPreview}</pre>
                                    </div>
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
        </Tabs>
      </div>
    </main>
  );
}
