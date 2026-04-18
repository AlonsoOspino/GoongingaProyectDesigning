"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/features/session/SessionProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { getMatches, getTeams, createDraft, getDraftByMatchId, type Match, type Team, type DraftState } from "@/lib/api";

type TabValue = "scheduled" | "active" | "pending";

const POLL_INTERVAL = 3000; // 3 seconds for real-time updates

export default function ManagerDashboardPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated } = useSession();
  const [activeTab, setActiveTab] = useState<TabValue>("scheduled");
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [drafts, setDrafts] = useState<Record<number, DraftState | null>>({});
  const [loading, setLoading] = useState(true);
  const [creatingDraft, setCreatingDraft] = useState<number | null>(null);
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
      
      const [matchesData, teamsData] = await Promise.all([
        getMatches(),
        getTeams(),
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Match</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Final Score</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingMatches.map((match) => (
                          <TableRow key={match.id}>
                            <TableCell className="font-medium">
                              {getTeamName(match.teamAId)} vs {getTeamName(match.teamBId)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{match.type}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-lg">
                                {match.mapWinsTeamA} - {match.mapWinsTeamB}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Link href={`/draft-table/${match.id}`}>
                                <Button size="sm" variant="secondary">
                                  View Draft
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
