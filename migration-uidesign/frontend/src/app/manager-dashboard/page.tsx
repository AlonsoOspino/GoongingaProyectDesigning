"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/features/session/SessionProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { getMatches, getTeams, createDraft, getDraftByMatchId, type Match, type Team } from "@/lib/api";

type TabValue = "scheduled" | "active" | "pending";

export default function ManagerDashboardPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated } = useSession();
  const [activeTab, setActiveTab] = useState<TabValue>("scheduled");
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingDraft, setCreatingDraft] = useState<number | null>(null);

  // Redirect non-manager users
  useEffect(() => {
    if (isHydrated && (!isAuthenticated || user?.role !== "MANAGER")) {
      router.push("/login");
    }
  }, [isHydrated, isAuthenticated, user, router]);

  useEffect(() => {
    if (isAuthenticated && user?.role === "MANAGER") {
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Manager Dashboard</h1>
          <p className="text-muted mt-1">Manage matches, create draft tables, and upload results</p>
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Match</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Best Of</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Ready Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scheduledMatches.map((match) => {
                          const bothReady = match.teamAready === 1 && match.teamBready === 1;
                          return (
                            <TableRow key={match.id}>
                              <TableCell className="font-medium">
                                {getTeamName(match.teamAId)} vs {getTeamName(match.teamBId)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{match.type}</Badge>
                              </TableCell>
                              <TableCell>BO{match.bestOf}</TableCell>
                              <TableCell>
                                {new Date(match.startDate).toLocaleDateString()}{" "}
                                {new Date(match.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Badge variant={match.teamAready ? "success" : "default"}>
                                    {getTeamName(match.teamAId).slice(0, 10)}: {match.teamAready ? "Ready" : "Not Ready"}
                                  </Badge>
                                  <Badge variant={match.teamBready ? "success" : "default"}>
                                    {getTeamName(match.teamBId).slice(0, 10)}: {match.teamBready ? "Ready" : "Not Ready"}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  onClick={() => handleCreateDraft(match.id)}
                                  disabled={!bothReady || creatingDraft === match.id}
                                >
                                  {creatingDraft === match.id ? "Creating..." : "Create Draft Table"}
                                </Button>
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Match</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Game</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeMatches.map((match) => (
                          <TableRow key={match.id}>
                            <TableCell className="font-medium">
                              {getTeamName(match.teamAId)} vs {getTeamName(match.teamBId)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{match.type}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono">
                                {match.mapWinsTeamA} - {match.mapWinsTeamB}
                              </span>
                            </TableCell>
                            <TableCell>Game {match.gameNumber}</TableCell>
                            <TableCell>
                              <Link href={`/draft-table/${match.id}`}>
                                <Button size="sm" variant="secondary">
                                  Join Draft Table
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
                              <Button size="sm" variant="secondary" disabled>
                                Upload Screenshots (Coming Soon)
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {pendingMatches.length > 0 && (
                  <p className="text-sm text-muted mt-4">
                    Screenshot upload functionality will be connected to Google Vision AI.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
