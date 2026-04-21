"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "@/features/session/SessionProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/Modal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { getMatches, getTeams, updateCaptainMatch, updateCaptainTeam, getDraftByMatchId, type Match, type Team, type DraftState } from "@/lib/api";
import { clsx } from "clsx";

type TabValue = "upcoming" | "active" | "history";

const POLL_INTERVAL = 5000;

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
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [teamFormData, setTeamFormData] = useState({ name: "", logo: "", roster: "" });
  const [logoUploading, setLogoUploading] = useState(false);
  const [rosterUploading, setRosterUploading] = useState(false);
  const [teamNotification, setTeamNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const rosterInputRef = useRef<HTMLInputElement>(null);
  const prevMatchesRef = useRef<Match[]>([]);
  const prevDraftsRef = useRef<Record<number, DraftState | null>>({});

  useEffect(() => {
    if (isHydrated && (!isAuthenticated || user?.role !== "CAPTAIN")) {
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
    if (isAuthenticated && user?.role === "CAPTAIN") loadData();
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "CAPTAIN") return;
    pollRef.current = setInterval(() => loadData(true), POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isAuthenticated, user]);

  const sendNotification = useCallback((title: string, body: string) => {
    if (notificationPermission === "granted" && typeof window !== "undefined" && "Notification" in window) {
      new Notification(title, { body, icon: "/favicon.ico", tag: "draft-notification" });
    }
  }, [notificationPermission]);

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      const [matchesData, teamsData] = await Promise.all([getMatches(), getTeams()]);

      const myMatches = matchesData.filter(
        (m) => m.teamAId === user?.teamId || m.teamBId === user?.teamId
      );

      for (const match of myMatches) {
        const prevMatch = prevMatchesRef.current.find((m) => m.id === match.id);
        if (prevMatch && prevMatch.status !== "ACTIVE" && match.status === "ACTIVE") {
          const opponentName = teamsData.find(
            (t) => t.id === (match.teamAId === user?.teamId ? match.teamBId : match.teamAId)
          )?.name || "opponent";
          sendNotification("Match is Live!", `Your match vs ${opponentName} is now active. Join the draft table!`);
        }
      }

      prevMatchesRef.current = myMatches;
      setMatches(matchesData);
      setTeams(teamsData);

      const activeMyMatches = myMatches.filter((m) => m.status === "ACTIVE" || m.status === "PENDINGREGISTERS");
      const draftPromises = activeMyMatches.map(async (match) => {
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

        const prevDraft = prevDraftsRef.current[result.matchId];
        if (result.draft && !prevDraft && silent) {
          sendNotification("Draft Table Ready!", "The manager has created the draft table. Join now!");
          // Auto-redirect to draft if this is a new draft
          router.push(`/draft-table/${result.matchId}`);
        }

        if (result.draft && prevDraft && prevDraft.phase !== result.draft.phase) {
          const isMyTurn = result.draft.currentTurnTeamId === user?.teamId;
          if (result.draft.phase === "MAPPICKING" && isMyTurn) {
            sendNotification("Your Turn to Pick!", "It's your turn to pick a map.");
          } else if (result.draft.phase === "BAN" && isMyTurn) {
            sendNotification("Your Turn to Ban!", "It's your turn to ban a hero.");
          }
        }

        if (result.draft && prevDraft &&
          prevDraft.currentTurnTeamId !== user?.teamId &&
          result.draft.currentTurnTeamId === user?.teamId) {
          sendNotification("Your Turn!", `It's your turn in the ${result.draft.phase.toLowerCase()} phase.`);
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

  const myTeam = teams.find((t) => t.id === user?.teamId);
  const myMatches = matches.filter((m) => m.teamAId === user?.teamId || m.teamBId === user?.teamId);
  const upcomingMatches = myMatches.filter((m) => m.status === "SCHEDULED");
  const activeMatches = myMatches.filter((m) => m.status === "ACTIVE" || m.status === "PENDINGREGISTERS");
  const historyMatches = myMatches.filter((m) => m.status === "FINISHED");

  const getTeamName = (teamId: number) => teams.find((t) => t.id === teamId)?.name || `Team ${teamId}`;
  const isTeamA = (match: Match) => match.teamAId === user?.teamId;
  const getMyReadyStatus = (match: Match) => isTeamA(match) ? match.teamAready : match.teamBready;
  const getOpponentReadyStatus = (match: Match) => isTeamA(match) ? match.teamBready : match.teamAready;

  // Group upcoming matches by week, sorted by date
  const upcomingByWeek = upcomingMatches.reduce((acc, m) => {
    const w = m.semanas || 1;
    if (!acc[w]) acc[w] = [];
    acc[w].push(m);
    return acc;
  }, {} as Record<number, Match[]>);

  // Next match (soonest)
  const nextMatch = upcomingMatches
    .filter((m) => m.startDate)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0] || null;

  async function handleToggleReady(match: Match) {
    if (!token) return;
    setUpdatingReady(match.id);
    try {
      const currentReady = getMyReadyStatus(match);
      const newReady = currentReady === 1 ? 0 : 1;
      const payload = isTeamA(match) ? { teamAready: newReady as 0 | 1 } : { teamBready: newReady as 0 | 1 };
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

  const showTeamNotification = (type: "success" | "error", message: string) => {
    setTeamNotification({ type, message });
    setTimeout(() => setTeamNotification(null), 3000);
  };

  async function uploadImage(file: File, type: "logo" | "roster"): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    try {
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
      const result = await response.json();
      return result.url;
    } catch (error: any) {
      showTeamNotification("error", error.message || "Failed to upload image");
      return null;
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const url = await uploadImage(file, "logo");
    if (url) setTeamFormData({ ...teamFormData, logo: url });
    setLogoUploading(false);
  }

  async function handleRosterUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRosterUploading(true);
    const url = await uploadImage(file, "roster");
    if (url) setTeamFormData({ ...teamFormData, roster: url });
    setRosterUploading(false);
  }

  async function handleUpdateTeam() {
    if (!token || !myTeam) return;
    try {
      await updateCaptainTeam(token, myTeam.id, {
        name: teamFormData.name || undefined,
        logo: teamFormData.logo || undefined,
        roster: teamFormData.roster || undefined,
      });
      setShowEditTeamModal(false);
      showTeamNotification("success", "Team updated successfully");
      loadData();
    } catch (err: any) {
      showTeamNotification("error", err.message || "Failed to update team");
    }
  }

  const isMatchSoon = (dateStr: string) => {
    const diffHours = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60);
    return diffHours <= 24 && diffHours >= 0;
  };

  const formatMatchDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const diffDays = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 7) return `In ${diffDays} days`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (!isHydrated) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted">Loading...</div></div>;
  }

  if (!isAuthenticated || user?.role !== "CAPTAIN") return null;

  return (
    <main className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Captain Dashboard</h1>
            <p className="text-muted mt-1">Manage your team&apos;s matches and participate in draft tables</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-muted">Live updates</span>
          </div>
        </div>

        {teamNotification && (
          <div className={`mb-4 p-4 rounded-lg ${teamNotification.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {teamNotification.message}
          </div>
        )}

        {myTeam && (
          <Card className="mb-8 border-primary/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center overflow-hidden">
                    {myTeam.logo ? (
                      <Image src={myTeam.logo} alt={myTeam.name} fill className="object-cover" unoptimized />
                    ) : (
                      <span className="text-2xl font-bold text-primary">{myTeam.name.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{myTeam.name}</h2>
                    <p className="text-sm text-muted">Your Team</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  {[
                    { label: "Wins", value: myTeam.victories, color: "text-foreground" },
                    { label: "Map Wins", value: myTeam.mapWins, color: "text-success" },
                    { label: "Map Losses", value: myTeam.mapLoses, color: "text-danger" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <p className={`text-3xl font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
                    </div>
                  ))}
                  <Button onClick={() => {
                    setTeamFormData({ name: myTeam.name, logo: myTeam.logo || "", roster: myTeam.roster || "" });
                    setShowEditTeamModal(true);
                  }} variant="secondary">
                    Edit Team
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next match highlight */}
        {nextMatch && (
          <div className="mb-6 p-4 rounded-xl border-2 border-primary bg-primary/5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs text-primary uppercase tracking-wide font-semibold mb-1">
                  {isMatchSoon(nextMatch.startDate) ? "⚠️ Match Soon" : "Next Match"}
                </p>
                <p className="text-xl font-bold text-foreground">
                  vs {getTeamName(isTeamA(nextMatch) ? nextMatch.teamBId : nextMatch.teamAId)}
                </p>
                <p className="text-sm text-muted mt-1">
                  Week {nextMatch.semanas} · BO{nextMatch.bestOf} · {formatMatchDate(nextMatch.startDate)}
                  {" at "}{new Date(nextMatch.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={getMyReadyStatus(nextMatch) ? "success" : "warning"}>
                  You: {getMyReadyStatus(nextMatch) ? "Ready" : "Not Ready"}
                </Badge>
                <Badge variant={getOpponentReadyStatus(nextMatch) ? "success" : "default"}>
                  Opponent: {getOpponentReadyStatus(nextMatch) ? "Ready" : "Not Ready"}
                </Badge>
                <Button
                  size="sm"
                  variant={getMyReadyStatus(nextMatch) ? "danger" : "default"}
                  onClick={() => handleToggleReady(nextMatch)}
                  disabled={updatingReady === nextMatch.id}
                >
                  {updatingReady === nextMatch.id ? "Updating..." : getMyReadyStatus(nextMatch) ? "Cancel Ready" : "Mark Ready"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList className="mb-6">
            <TabsTrigger value="upcoming">Upcoming ({upcomingMatches.length})</TabsTrigger>
            <TabsTrigger value="active" className="relative">
              Active ({activeMatches.length})
              {activeMatches.length > 0 && <span className="ml-2 w-2 h-2 rounded-full bg-success animate-pulse inline-block" />}
            </TabsTrigger>
            <TabsTrigger value="history">History ({historyMatches.length})</TabsTrigger>
          </TabsList>

          {/* UPCOMING */}
          <TabsContent value="upcoming">
            {loading ? (
              <p className="text-muted text-center py-8">Loading...</p>
            ) : upcomingMatches.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted">No upcoming matches scheduled.</CardContent></Card>
            ) : (
              <div className="space-y-8">
                {Object.entries(upcomingByWeek)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([week, weekMatches]) => (
                    <div key={week}>
                      <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Week {week}</h3>
                      <div className="space-y-3">
                        {weekMatches
                          .sort((a, b) => (a.startDate && b.startDate ? new Date(a.startDate).getTime() - new Date(b.startDate).getTime() : 0))
                          .map((match) => {
                            const opponentId = isTeamA(match) ? match.teamBId : match.teamAId;
                            const myReady = getMyReadyStatus(match);
                            const oppReady = getOpponentReadyStatus(match);
                            const isSoon = match.startDate ? isMatchSoon(match.startDate) : false;
                            const isNext = match.id === nextMatch?.id;

                            return (
                              <div
                                key={match.id}
                                className={clsx(
                                  "p-4 border rounded-lg bg-surface transition-all",
                                  isNext ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                                    : isSoon ? "border-warning bg-warning/5"
                                    : "border-border"
                                )}
                              >
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      {isNext && <Badge variant="primary" className="text-xs">Next Match</Badge>}
                                      {isSoon && !isNext && <Badge variant="warning" className="animate-pulse text-xs">Soon</Badge>}
                                      <Badge variant="outline">{match.type}</Badge>
                                    </div>
                                    <h3 className="text-lg font-semibold text-foreground">vs {getTeamName(opponentId)}</h3>
                                    <div className="flex items-center gap-3 mt-2 text-sm text-muted flex-wrap">
                                      {match.startDate ? (
                                        <>
                                          <span className={isSoon ? "text-warning font-medium" : ""}>{formatMatchDate(match.startDate)}</span>
                                          <span>·</span>
                                          <span>{new Date(match.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                          <span>·</span>
                                          <span>Best of {match.bestOf}</span>
                                        </>
                                      ) : (
                                        <span className="text-warning font-semibold">No date set yet</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-2 lg:items-end">
                                    <div className="flex gap-2">
                                      <Badge variant={myReady ? "success" : "warning"}>You: {myReady ? "Ready" : "Not Ready"}</Badge>
                                      <Badge variant={oppReady ? "success" : "default"}>Opp: {oppReady ? "Ready" : "Not Ready"}</Badge>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant={myReady ? "danger" : "default"}
                                        onClick={() => handleToggleReady(match)}
                                        disabled={updatingReady === match.id}
                                      >
                                        {updatingReady === match.id ? "Updating..." : myReady ? "Cancel Ready" : "Mark Ready"}
                                      </Button>
                                      <Button
                                        size="sm" variant="ghost"
                                        onClick={() => {
                                          setSelectedMatch(match);
                                          setNewDate(match.startDate ? match.startDate.slice(0, 16) : "");
                                          setShowRescheduleModal(true);
                                        }}
                                      >
                                        {match.startDate ? "Reschedule" : "Schedule"}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>

          {/* ACTIVE */}
          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Active Matches
                  {activeMatches.length > 0 && <span className="w-2 h-2 rounded-full bg-success animate-pulse" />}
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

                      return (
                        <div key={match.id} className="p-6 border-2 border-primary rounded-lg bg-primary/5">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-3">
                                <Badge variant="success" className="animate-pulse">LIVE</Badge>
                                <Badge variant="outline">{match.type}</Badge>
                                {draft && <Badge variant="primary">Phase: {draft.phase}</Badge>}
                              </div>
                              <h3 className="text-xl font-bold text-foreground mb-2">vs {getTeamName(opponentId)}</h3>
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
                                  Game {(match.gameNumber || 0) + 1} | Best of {match.bestOf}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              {draft ? (
                                <Link href={`/draft-table/${match.id}`}>
                                  <Button size="lg" className="w-full animate-pulse">Join Draft Table</Button>
                                </Link>
                              ) : (
                                <div className="text-center p-4 bg-surface rounded-lg border border-border">
                                  <p className="text-sm text-muted">Waiting for manager to create draft table...</p>
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

          {/* HISTORY */}
          <TabsContent value="history">
            <Card>
              <CardHeader><CardTitle>Match History</CardTitle></CardHeader>
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
                              won ? "border-success/30 bg-success/5"
                                : draw ? "border-warning/30 bg-warning/5"
                                : "border-danger/30 bg-danger/5"
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <Badge variant={won ? "success" : draw ? "warning" : "danger"} className="w-14 justify-center">
                                {won ? "WIN" : draw ? "DRAW" : "LOSS"}
                              </Badge>
                              <div>
                                <p className="font-medium text-foreground">vs {getTeamName(opponentId)}</p>
                                <p className="text-xs text-muted">Week {match.semanas} · {new Date(match.startDate).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-lg font-mono font-bold text-foreground">{myScore} - {oppScore}</span>
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
          <ModalHeader><ModalTitle>Reschedule Match</ModalTitle></ModalHeader>
          <ModalContent>
            <Input label="New Date & Time" type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </ModalContent>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowRescheduleModal(false)}>Cancel</Button>
            <Button onClick={handleReschedule}>Update Schedule</Button>
          </ModalFooter>
        </Modal>

        {/* Edit Team Modal */}
        <Modal isOpen={showEditTeamModal} onClose={() => setShowEditTeamModal(false)}>
          <ModalHeader><ModalTitle>Edit Team</ModalTitle></ModalHeader>
          <ModalContent>
            <div className="space-y-4">
              <Input label="Team Name" value={teamFormData.name} onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })} />
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Team Logo</label>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                <div className="flex items-center gap-4">
                  {teamFormData.logo ? (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                      <Image src={teamFormData.logo} alt="Logo" fill className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-surface border-2 border-dashed border-border flex items-center justify-center">
                      <span className="text-xs text-muted">No logo</span>
                    </div>
                  )}
                  <Button type="button" variant="secondary" size="sm" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                    {logoUploading ? "Uploading..." : "Upload Logo"}
                  </Button>
                </div>
              </div>
            </div>
          </ModalContent>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowEditTeamModal(false)}>Cancel</Button>
            <Button onClick={handleUpdateTeam}>Save Changes</Button>
          </ModalFooter>
        </Modal>
      </div>
    </main>
  );
}
