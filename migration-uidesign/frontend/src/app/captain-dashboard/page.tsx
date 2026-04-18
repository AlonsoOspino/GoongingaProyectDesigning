"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/features/session/SessionProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/Modal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { getMatches, getTeams, updateCaptainMatch, getDraftByMatchId, type Match, type Team, type DraftState } from "@/lib/api";
import { clsx } from "clsx";

type TabValue = "upcoming" | "active" | "history";

const POLL_INTERVAL = 5000; // 5 seconds for real-time updates

export default function CaptainDashboardPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated } = useSession();
  const [activeTab, setActiveTab] = useState<TabValue>("upcoming");
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [drafts, setDrafts] = useState<Record<number, DraftState | null>>({});
  const [loading, setLoading] = useState(true);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [newDate, setNewDate] = useState("");
  const [updatingReady, setUpdatingReady] = useState<number | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const prevMatchesRef = useRef<Match[]>([]);

  // Redirect non-captain users
  useEffect(() => {
    if (isHydrated && (!isAuthenticated || user?.role !== "CAPTAIN")) {
      router.push("/login");
    }
  }, [isHydrated, isAuthenticated, user, router]);

  // Request notification permission on mount
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

  // Load data initially
  useEffect(() => {
    if (isAuthenticated && user?.role === "CAPTAIN") {
      loadData();
    }
  }, [isAuthenticated, user]);

  // Poll for updates
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "CAPTAIN") return;
    
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
        tag: "draft-notification",
      });
    }
  }, [notificationPermission]);

  const prevDraftsRef = useRef<Record<number, DraftState | null>>({});

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      
      const [matchesData, teamsData] = await Promise.all([
        getMatches(),
        getTeams(),
      ]);

      // Check for state changes and send notifications
      const myMatches = matchesData.filter(
        (m) => m.teamAId === user?.teamId || m.teamBId === user?.teamId
      );

      // Detect matches that became ACTIVE
      for (const match of myMatches) {
        const prevMatch = prevMatchesRef.current.find((m) => m.id === match.id);
        if (prevMatch && prevMatch.status !== "ACTIVE" && match.status === "ACTIVE") {
          const opponentName = teamsData.find(
            (t) => t.id === (match.teamAId === user?.teamId ? match.teamBId : match.teamAId)
          )?.name || "opponent";
          sendNotification(
            "Match is Live!",
            `Your match vs ${opponentName} is now active. Join the draft table!`
          );
        }
      }

      prevMatchesRef.current = myMatches;
      setMatches(matchesData);
      setTeams(teamsData);

      // Load draft states for active matches (and pending)
      const activeMatches = myMatches.filter((m) => m.status === "ACTIVE" || m.status === "PENDINGREGISTERS");
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
        
        // Check if draft was just created (exists now but didn't before)
        const prevDraft = prevDraftsRef.current[result.matchId];
        if (result.draft && !prevDraft && silent) {
          sendNotification(
            "Draft Table Ready!",
            "The manager has created the draft table. Join now!"
          );
        }
        
        // Check if phase changed to something captain needs to act on
        if (result.draft && prevDraft && prevDraft.phase !== result.draft.phase) {
          const isMyTurn = result.draft.currentTurnTeamId === user?.teamId;
          if (result.draft.phase === "MAPPICKING" && isMyTurn) {
            sendNotification(
              "Your Turn to Pick!",
              "It's your turn to pick a map."
            );
          } else if (result.draft.phase === "BAN" && isMyTurn) {
            sendNotification(
              "Your Turn to Ban!",
              "It's your turn to ban a hero."
            );
          } else if (result.draft.phase === "STARTING") {
            sendNotification(
              "Next Map Starting",
              "Get ready for the next map!"
            );
          }
        }
        
        // Check if turn changed to us
        if (result.draft && prevDraft && 
            prevDraft.currentTurnTeamId !== user?.teamId && 
            result.draft.currentTurnTeamId === user?.teamId) {
          sendNotification(
            "Your Turn!",
            `It's your turn in the ${result.draft.phase.toLowerCase()} phase.`
          );
        }
      }
      
      prevDraftsRef.current = newDrafts;
      setDrafts(newDrafts);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Get my team
  const myTeam = teams.find((t) => t.id === user?.teamId);
  
  // Filter matches for my team
  const myMatches = matches.filter(
    (m) => m.teamAId === user?.teamId || m.teamBId === user?.teamId
  );
  
  const upcomingMatches = myMatches.filter((m) => m.status === "SCHEDULED");
  const activeMatches = myMatches.filter((m) => m.status === "ACTIVE" || m.status === "PENDINGREGISTERS");
  const historyMatches = myMatches.filter((m) => m.status === "FINISHED");

  const getTeamName = (teamId: number) =>
    teams.find((t) => t.id === teamId)?.name || `Team ${teamId}`;

  const isTeamA = (match: Match) => match.teamAId === user?.teamId;
  const getMyReadyStatus = (match: Match) => isTeamA(match) ? match.teamAready : match.teamBready;
  const getOpponentReadyStatus = (match: Match) => isTeamA(match) ? match.teamBready : match.teamAready;

  async function handleToggleReady(match: Match) {
    if (!token) return;
    setUpdatingReady(match.id);
    try {
      const currentReady = getMyReadyStatus(match);
      const newReady = currentReady === 1 ? 0 : 1;
      
      const payload = isTeamA(match) 
        ? { teamAready: newReady as 0 | 1 }
        : { teamBready: newReady as 0 | 1 };
      
      await updateCaptainMatch(token, match.id, payload);
      loadData();
    } catch (err) {
      console.error("Failed to update ready status:", err);
    } finally {
      setUpdatingReady(null);
    }
  }

  async function handleReschedule() {
    if (!token || !selectedMatch || !newDate) return;
    try {
      await updateCaptainMatch(token, selectedMatch.id, { startDate: newDate });
      setShowRescheduleModal(false);
      setSelectedMatch(null);
      setNewDate("");
      loadData();
    } catch (err) {
      console.error("Failed to reschedule match:", err);
    }
  }

  const formatMatchDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 7) return `In ${diffDays} days`;
    
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const isMatchSoon = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffHours <= 24 && diffHours >= 0;
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "CAPTAIN") {
    return null;
  }

  return (
    <main className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Captain Dashboard</h1>
            <p className="text-muted mt-1">
              Manage your team&apos;s matches and participate in draft tables
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-muted">Live updates</span>
            </div>
            {notificationPermission === "default" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  Notification.requestPermission().then((permission) => {
                    setNotificationPermission(permission);
                  });
                }}
              >
                Enable Notifications
              </Button>
            )}
            {notificationPermission === "denied" && (
              <Badge variant="warning" className="text-xs">
                Notifications blocked
              </Badge>
            )}
          </div>
        </div>

        {/* Team Info Card */}
        {myTeam && (
          <Card className="mb-8 border-primary/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                    {myTeam.logo ? (
                      <img src={myTeam.logo} alt={myTeam.name} className="w-12 h-12 object-contain" />
                    ) : (
                      <span className="text-2xl font-bold text-primary">
                        {myTeam.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{myTeam.name}</h2>
                    <p className="text-sm text-muted">Your Team</p>
                  </div>
                </div>
                <div className="flex gap-8">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-foreground">{myTeam.victories}</p>
                    <p className="text-xs text-muted uppercase tracking-wide">Wins</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-success">{myTeam.mapWins}</p>
                    <p className="text-xs text-muted uppercase tracking-wide">Map Wins</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-danger">{myTeam.mapLoses}</p>
                    <p className="text-xs text-muted uppercase tracking-wide">Map Losses</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList className="mb-6">
            <TabsTrigger value="upcoming">
              Upcoming ({upcomingMatches.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="relative">
              Active ({activeMatches.length})
              {activeMatches.length > 0 && (
                <span className="ml-2 w-2 h-2 rounded-full bg-success animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger value="history">
              History ({historyMatches.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Matches</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted text-center py-8">Loading...</p>
                ) : upcomingMatches.length === 0 ? (
                  <p className="text-muted text-center py-8">No upcoming matches scheduled.</p>
                ) : (
                  <div className="space-y-4">
                    {upcomingMatches
                      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                      .map((match) => {
                        const opponentId = isTeamA(match) ? match.teamBId : match.teamAId;
                        const myReady = getMyReadyStatus(match);
                        const oppReady = getOpponentReadyStatus(match);
                        const isSoon = isMatchSoon(match.startDate);

                        return (
                          <div
                            key={match.id}
                            className={clsx(
                              "p-4 border rounded-lg bg-surface transition-all",
                              isSoon 
                                ? "border-primary ring-2 ring-primary/20 bg-primary/5" 
                                : "border-border"
                            )}
                          >
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  {isSoon && (
                                    <Badge variant="warning" className="animate-pulse">
                                      SOON
                                    </Badge>
                                  )}
                                  <Badge variant="outline">{match.type}</Badge>
                                  <span className="text-sm text-muted">Week {match.semanas}</span>
                                </div>
                                <h3 className="text-lg font-semibold text-foreground">
                                  vs {getTeamName(opponentId)}
                                </h3>
                                <div className="flex items-center gap-4 mt-2">
                                  <div className={clsx(
                                    "text-sm font-medium",
                                    isSoon ? "text-primary" : "text-muted"
                                  )}>
                                    {formatMatchDate(match.startDate)}
                                  </div>
                                  <span className="text-muted">|</span>
                                  <span className="text-sm text-muted">
                                    {new Date(match.startDate).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                  <span className="text-muted">|</span>
                                  <span className="text-sm text-muted">Best of {match.bestOf}</span>
                                </div>
                              </div>

                              <div className="flex flex-col gap-3 lg:items-end">
                                <div className="flex gap-2">
                                  <Badge variant={myReady ? "success" : "warning"}>
                                    You: {myReady ? "Ready" : "Not Ready"}
                                  </Badge>
                                  <Badge variant={oppReady ? "success" : "default"}>
                                    Opponent: {oppReady ? "Ready" : "Not Ready"}
                                  </Badge>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant={myReady ? "danger" : "default"}
                                    onClick={() => handleToggleReady(match)}
                                    disabled={updatingReady === match.id}
                                  >
                                    {updatingReady === match.id
                                      ? "Updating..."
                                      : myReady
                                      ? "Cancel Ready"
                                      : "Mark Ready"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setSelectedMatch(match);
                                      setNewDate(match.startDate.slice(0, 16));
                                      setShowRescheduleModal(true);
                                    }}
                                  >
                                    Reschedule
                                  </Button>
                                </div>
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
                <CardTitle className="flex items-center gap-2">
                  Active Matches
                  {activeMatches.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted text-center py-8">Loading...</p>
                ) : activeMatches.length === 0 ? (
                  <p className="text-muted text-center py-8">No active matches.</p>
                ) : (
                  <div className="space-y-4">
                    {activeMatches.map((match) => {
                      const opponentId = isTeamA(match) ? match.teamBId : match.teamAId;
                      const myScore = isTeamA(match) ? match.mapWinsTeamA : match.mapWinsTeamB;
                      const oppScore = isTeamA(match) ? match.mapWinsTeamB : match.mapWinsTeamA;
                      const draft = drafts[match.id];
                      const hasDraft = !!draft;

                      return (
                        <div
                          key={match.id}
                          className="p-6 border-2 border-primary rounded-lg bg-primary/5 animate-turn-glow"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-3">
                                <Badge variant="success" className="animate-pulse">
                                  LIVE
                                </Badge>
                                <Badge variant="outline">{match.type}</Badge>
                                {draft && (
                                  <Badge variant="primary">
                                    Phase: {draft.phase}
                                  </Badge>
                                )}
                              </div>
                              <h3 className="text-xl font-bold text-foreground mb-2">
                                vs {getTeamName(opponentId)}
                              </h3>
                              <div className="flex items-center gap-6">
                                <div className="flex items-center gap-4">
                                  <div className="text-center">
                                    <p className="text-3xl font-bold text-primary">{myScore}</p>
                                    <p className="text-xs text-muted">Your Maps</p>
                                  </div>
                                  <span className="text-2xl text-muted">-</span>
                                  <div className="text-center">
                                    <p className="text-3xl font-bold text-foreground">{oppScore}</p>
                                    <p className="text-xs text-muted">Opponent</p>
                                  </div>
                                </div>
                                <div className="text-sm text-muted">
                                  Game {match.gameNumber} | Best of {match.bestOf}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              {hasDraft ? (
                                <Link href={`/draft-table/${match.id}`}>
                                  <Button size="lg" className="w-full animate-pulse">
                                    Join Draft Table
                                  </Button>
                                </Link>
                              ) : (
                                <div className="text-center p-4 bg-surface rounded-lg border border-border">
                                  <p className="text-sm text-muted">
                                    Waiting for manager to create draft table...
                                  </p>
                                </div>
                              )}
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

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Match History</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted text-center py-8">Loading...</p>
                ) : historyMatches.length === 0 ? (
                  <p className="text-muted text-center py-8">No match history yet.</p>
                ) : (
                  <div className="space-y-3">
                    {historyMatches
                      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                      .map((match) => {
                        const opponentId = isTeamA(match) ? match.teamBId : match.teamAId;
                        const myScore = isTeamA(match) ? match.mapWinsTeamA : match.mapWinsTeamB;
                        const oppScore = isTeamA(match) ? match.mapWinsTeamB : match.mapWinsTeamA;
                        const won = myScore > oppScore;
                        const draw = myScore === oppScore;

                        return (
                          <div
                            key={match.id}
                            className={clsx(
                              "p-4 border rounded-lg flex items-center justify-between",
                              won ? "border-success/30 bg-success/5" : 
                              draw ? "border-warning/30 bg-warning/5" :
                              "border-danger/30 bg-danger/5"
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <Badge 
                                variant={won ? "success" : draw ? "warning" : "danger"}
                                className="w-14 justify-center"
                              >
                                {won ? "WIN" : draw ? "DRAW" : "LOSS"}
                              </Badge>
                              <div>
                                <p className="font-medium text-foreground">
                                  vs {getTeamName(opponentId)}
                                </p>
                                <p className="text-xs text-muted">
                                  {new Date(match.startDate).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-lg font-mono font-bold text-foreground">
                                {myScore} - {oppScore}
                              </span>
                              <Badge variant="outline">{match.type}</Badge>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Reschedule Modal */}
        <Modal isOpen={showRescheduleModal} onClose={() => setShowRescheduleModal(false)}>
          <ModalHeader>
            <ModalTitle>Reschedule Match</ModalTitle>
          </ModalHeader>
          <ModalContent>
            <p className="text-muted text-sm mb-4">
              Propose a new date and time for this match. The opponent captain may also reschedule.
            </p>
            <Input
              label="New Date & Time"
              type="datetime-local"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </ModalContent>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowRescheduleModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleReschedule}>
              Update Schedule
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </main>
  );
}
