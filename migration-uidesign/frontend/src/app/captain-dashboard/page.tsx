"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/features/session/SessionProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/Modal";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { getMatches, getTeams, updateCaptainMatch, type Match, type Team } from "@/lib/api";

type TabValue = "upcoming" | "active" | "history";

export default function CaptainDashboardPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated } = useSession();
  const [activeTab, setActiveTab] = useState<TabValue>("upcoming");
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [newDate, setNewDate] = useState("");
  const [updatingReady, setUpdatingReady] = useState<number | null>(null);

  // Redirect non-captain users
  useEffect(() => {
    if (isHydrated && (!isAuthenticated || user?.role !== "CAPTAIN")) {
      router.push("/login");
    }
  }, [isHydrated, isAuthenticated, user, router]);

  useEffect(() => {
    if (isAuthenticated && user?.role === "CAPTAIN") {
      loadData();
    }
  }, [isAuthenticated, user]);

  async function loadData() {
    try {
      const [matchesData, teamsData] = await Promise.all([
        getMatches(),
        getTeams(),
      ]);
      setMatches(matchesData);
      setTeams(teamsData);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Get my team
  const myTeam = teams.find((t) => t.id === user?.teamId);
  
  // Filter matches for my team
  const myMatches = matches.filter(
    (m) => m.teamAId === user?.teamId || m.teamBId === user?.teamId
  );
  
  const upcomingMatches = myMatches.filter((m) => m.status === "SCHEDULED");
  const activeMatches = myMatches.filter((m) => m.status === "ACTIVE");
  const historyMatches = myMatches.filter((m) => m.status === "FINISHED" || m.status === "PENDINGREGISTERS");

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
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Captain Dashboard</h1>
          <p className="text-muted mt-1">
            Manage your team&apos;s matches and participate in draft tables
          </p>
        </div>

        {/* Team Info */}
        {myTeam && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-surface flex items-center justify-center">
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
                    <p className="text-muted">Your Team</p>
                  </div>
                </div>
                <div className="flex gap-8">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-foreground">{myTeam.victories}</p>
                    <p className="text-sm text-muted">Wins</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-success">{myTeam.mapWins}</p>
                    <p className="text-sm text-muted">Map Wins</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-danger">{myTeam.mapLoses}</p>
                    <p className="text-sm text-muted">Map Losses</p>
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
            <TabsTrigger value="active">
              Active ({activeMatches.length})
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
                    {upcomingMatches.map((match) => {
                      const opponentId = isTeamA(match) ? match.teamBId : match.teamAId;
                      const myReady = getMyReadyStatus(match);
                      const oppReady = getOpponentReadyStatus(match);

                      return (
                        <div
                          key={match.id}
                          className="p-4 border border-border rounded-lg bg-surface"
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="secondary">{match.type}</Badge>
                                <span className="text-sm text-muted">Week {match.semanas}</span>
                              </div>
                              <h3 className="text-lg font-semibold text-foreground">
                                vs {getTeamName(opponentId)}
                              </h3>
                              <p className="text-sm text-muted">
                                {new Date(match.startDate).toLocaleDateString()} at{" "}
                                {new Date(match.startDate).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                              <p className="text-sm text-muted">Best of {match.bestOf}</p>
                            </div>

                            <div className="flex flex-col gap-2">
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
                                  variant="secondary"
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
                      const opponentId = isTeamA(match) ? match.teamBId : match.teamAId;
                      const myScore = isTeamA(match) ? match.mapWinsTeamA : match.mapWinsTeamB;
                      const oppScore = isTeamA(match) ? match.mapWinsTeamB : match.mapWinsTeamA;

                      return (
                        <div
                          key={match.id}
                          className="p-6 border-2 border-accent rounded-lg bg-surface"
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="warning">LIVE</Badge>
                                <Badge variant="secondary">{match.type}</Badge>
                              </div>
                              <h3 className="text-xl font-bold text-foreground">
                                vs {getTeamName(opponentId)}
                              </h3>
                              <div className="flex items-center gap-4 mt-2">
                                <div className="text-center">
                                  <p className="text-3xl font-bold text-accent">{myScore}</p>
                                  <p className="text-xs text-muted">Your Maps</p>
                                </div>
                                <span className="text-2xl text-muted">-</span>
                                <div className="text-center">
                                  <p className="text-3xl font-bold text-foreground">{oppScore}</p>
                                  <p className="text-xs text-muted">Opponent</p>
                                </div>
                              </div>
                              <p className="text-sm text-muted mt-2">
                                Game {match.gameNumber} | Best of {match.bestOf}
                              </p>
                            </div>

                            <Link href={`/draft-table/${match.id}`}>
                              <Button size="lg">
                                Join Draft Table
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Opponent</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Result</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyMatches.map((match) => {
                          const opponentId = isTeamA(match) ? match.teamBId : match.teamAId;
                          const myScore = isTeamA(match) ? match.mapWinsTeamA : match.mapWinsTeamB;
                          const oppScore = isTeamA(match) ? match.mapWinsTeamB : match.mapWinsTeamA;
                          const won = myScore > oppScore;

                          return (
                            <TableRow key={match.id}>
                              <TableCell className="font-medium">
                                {getTeamName(opponentId)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{match.type}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={won ? "success" : "danger"}>
                                  {won ? "WIN" : "LOSS"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono">
                                {myScore} - {oppScore}
                              </TableCell>
                              <TableCell className="text-muted">
                                {new Date(match.startDate).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
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
