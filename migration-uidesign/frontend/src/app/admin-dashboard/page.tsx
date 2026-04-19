"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "@/features/session/SessionProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/Modal";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import {
  createTournament,
  updateTournament,
  deleteTournament,
  getCurrentTournament,
  adminCreateMatch,
  adminUpdateMatch,
  adminDeleteMatch,
  adminGenerateRoundRobin,
  adminCreateTeam,
  adminUpdateTeam,
  adminDeleteTeam,
  adminRegisterMember,
  adminUpdateMember,
  getMembers,
  type CreateMatchPayload,
  type CreateTeamPayload,
  type Member,
} from "@/lib/api/admin";
import { convertToISODateTime, formatDateEST, formatForDateInput, formatForDateTimeInput } from "@/lib/dateUtils";
import { getMatches, getTeams, type Match, type Team } from "@/lib/api";
import type { Tournament } from "@/lib/api/types";
type ActiveTab = "tournament" | "matches" | "teams" | "users";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated } = useSession();
  const [activeTab, setActiveTab] = useState<ActiveTab>("tournament");

  // Redirect non-admin users
  useEffect(() => {
    if (isHydrated && (!isAuthenticated || user?.role !== "ADMIN")) {
      router.push("/login");
    }
  }, [isHydrated, isAuthenticated, user, router]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "ADMIN") {
    return null;
  }

  return (
    <main className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted mt-1">Manage tournament, matches, teams, and users</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
          <TabsList className="mb-6">
            <TabsTrigger value="tournament">Tournament</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          <TabsContent value="tournament">
            <TournamentSection token={token!} />
          </TabsContent>

          <TabsContent value="matches">
            <MatchesSection token={token!} />
          </TabsContent>

          <TabsContent value="teams">
            <TeamsSection token={token!} />
          </TabsContent>

          <TabsContent value="users">
            <UsersSection token={token!} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

// ==================== TOURNAMENT SECTION ====================
function TournamentSection({ token }: { token: string }) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [formData, setFormData] = useState({ name: "", startDate: "", state: "SCHEDULED" });

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    loadTournament();
  }, []);

  async function loadTournament() {
    try {
      const data = await getCurrentTournament();
      setTournament(data);
    } catch {
      setTournament(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      const isoDate = convertToISODateTime(formData.startDate);
      await createTournament(token, { name: formData.name, startDate: isoDate });
      setShowCreateModal(false);
      setFormData({ name: "", startDate: "", state: "SCHEDULED" });
      showNotification("success", "Tournament created successfully");
      loadTournament();
    } catch (err: any) {
      console.error("Failed to create tournament:", err);
      showNotification("error", err.message || "Failed to create tournament");
    }
  }

  async function handleUpdate() {
    if (!tournament) return;
    try {
      await updateTournament(token, tournament.id, {
        name: formData.name,
        state: formData.state as Tournament["state"],
      });
      setShowEditModal(false);
      showNotification("success", "Tournament updated successfully");
      loadTournament();
    } catch (err: any) {
      console.error("Failed to update tournament:", err);
      showNotification("error", err.message || "Failed to update tournament");
    }
  }

  async function handleDelete() {
    if (!tournament) return;
    if (!confirm("Are you sure you want to delete this tournament?")) return;
    try {
      await deleteTournament(token, tournament.id);
      setTournament(null);
      showNotification("success", "Tournament deleted successfully");
    } catch (err: any) {
      console.error("Failed to delete tournament:", err);
      showNotification("error", err.message || "Failed to delete tournament");
    }
  }

  if (loading) {
    return <Card><CardContent className="p-8 text-center text-muted">Loading tournament...</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`p-4 rounded-lg ${notification.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {notification.message}
        </div>
      )}
      {tournament ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{tournament.name}</CardTitle>
            <div className="flex gap-2">
              <Button onClick={() => {
                setShowEditModal(true);
                setFormData({
                  name: tournament.name,
                  startDate: formatForDateInput(tournament.startDate),
                  state: tournament.state as Tournament["state"],
                });
              }}>
                Edit
              </Button>
              <Button variant="danger" size="sm" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted">Name</p>
                <p className="text-lg font-semibold text-foreground">{tournament.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Start Date (EST)</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatDateEST(tournament.startDate)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">State</p>
                <Badge variant={tournament.state === "FINISHED" ? "success" : "default"}>
                  {tournament.state}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted mb-4">No tournament exists yet.</p>
            <Button onClick={() => setShowCreateModal(true)}>Create Tournament</Button>
          </CardContent>
        </Card>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalHeader>
          <ModalTitle>Create Tournament</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <Input
              label="Tournament Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Season 1"
            />
            <Input
              label="Start Date & Time (EST)"
              type="datetime-local"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create</Button>
        </ModalFooter>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)}>
        <ModalHeader>
          <ModalTitle>Edit Tournament</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <Input
              label="Tournament Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter tournament name"
            />
            <Select
              label="State"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              options={[
                { value: "SCHEDULED", label: "Scheduled" },
                { value: "ROUNDROBIN", label: "Round Robin" },
                { value: "PLAYOFFS", label: "Playoffs" },
                { value: "SEMIFINALS", label: "Semifinals" },
                { value: "FINALS", label: "Finals" },
                { value: "FINISHED", label: "Finished" },
              ]}
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => { setShowEditModal(false); setFormData({ name: "", startDate: "", state: "SCHEDULED" }); }}>Cancel</Button>
          <Button onClick={handleUpdate}>Save Changes</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

// ==================== MATCHES SECTION ====================
function MatchesSection({ token }: { token: string }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRoundRobinModal, setShowRoundRobinModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [formData, setFormData] = useState<Partial<CreateMatchPayload>>({
    type: "ROUNDROBIN",
    bestOf: 5,
    startDate: "",
    teamAId: 0,
    teamBId: 0,
    semanas: 1,
    title: "",
  });
  const [roundRobinData, setRoundRobinData] = useState({ bestOf: 5, confirmationText: "" });

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [matchesData, teamsData, tournamentData] = await Promise.all([
        getMatches(),
        getTeams(),
        getCurrentTournament(),
      ]);
      setMatches(matchesData);
      setTeams(teamsData);
      setTournament(tournamentData);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!tournament) return;
    try {
      const isoDate = formData.startDate ? convertToISODateTime(formData.startDate) : "";
      await adminCreateMatch(token, {
        ...formData,
        startDate: isoDate,
        tournamentId: tournament.id,
      } as CreateMatchPayload);
      setShowCreateModal(false);
      setFormData({ type: "ROUNDROBIN", bestOf: 5, startDate: "", teamAId: 0, teamBId: 0, semanas: 1, title: "" });
      showNotification("success", "Match created successfully");
      loadData();
    } catch (err: any) {
      console.error("Failed to create match:", err);
      showNotification("error", err.message || "Failed to create match");
    }
  }

  async function handleUpdate() {
    if (!selectedMatch) return;
    try {
      const isoDate = formData.startDate ? convertToISODateTime(formData.startDate) : formData.startDate;
      await adminUpdateMatch(token, selectedMatch.id, { ...formData, startDate: isoDate } as Partial<Match>);
      setShowEditModal(false);
      showNotification("success", "Match updated successfully");
      loadData();
    } catch (err: any) {
      console.error("Failed to update match:", err);
      showNotification("error", err.message || "Failed to update match");
    }
  }

  async function handleDelete(matchId: number) {
    if (!confirm("Are you sure you want to delete this match?")) return;
    try {
      await adminDeleteMatch(token, matchId);
      showNotification("success", "Match deleted successfully");
      loadData();
    } catch (err: any) {
      console.error("Failed to delete match:", err);
      showNotification("error", err.message || "Failed to delete match");
    }
  }

  async function handleGenerateRoundRobin() {
    if (!tournament) return;
    try {
      await adminGenerateRoundRobin(token, {
        tournamentId: tournament.id,
        bestOf: roundRobinData.bestOf,
        confirmationText: roundRobinData.confirmationText,
      });
      setShowRoundRobinModal(false);
      showNotification("success", "Round robin schedule generated successfully");
      loadData();
    } catch (err: any) {
      console.error("Failed to generate round robin:", err);
      showNotification("error", err.message || "Failed to generate round robin");
    }
  }

  const getTeamName = (teamId: number) => teams.find((t) => t.id === teamId)?.name || `Team ${teamId}`;

  if (loading) {
    return <Card><CardContent className="p-8 text-center text-muted">Loading matches...</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`p-4 rounded-lg ${notification.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {notification.message}
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Matches ({matches.length})</CardTitle>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowRoundRobinModal(true)} disabled={!tournament}>
              Generate Round Robin
            </Button>
            <Button onClick={() => setShowCreateModal(true)} disabled={!tournament || teams.length < 2}>
              Create Match
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!tournament ? (
            <p className="text-muted text-center py-4">Create a tournament first to manage matches.</p>
          ) : matches.length === 0 ? (
            <p className="text-muted text-center py-4">No matches yet. Create one or generate a round robin schedule.</p>
          ) : (
            <div className="overflow-x-auto">
              {/* Group matches by week (semanas) */}
              {(() => {
                // Group matches by week
                const weekMap = new Map();
                matches.forEach((match) => {
                  const week = match.semanas || 1;
                  if (!weekMap.has(week)) weekMap.set(week, []);
                  weekMap.get(week).push(match);
                });
                const sortedWeeks = Array.from(weekMap.keys()).sort((a, b) => a - b);
                return (
                  <div>
                    {sortedWeeks.map((week) => (
                      <div key={week} className="mb-8">
                        <h3 className="text-lg font-bold mb-2">Week {week}</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Match</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Best Of</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {weekMap.get(week).map((match: Match) => (
                              <TableRow key={match.id}>
                                <TableCell className="font-medium">
                                  {getTeamName(match.teamAId)} vs {getTeamName(match.teamBId)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{match.type}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      match.status === "ACTIVE"
                                        ? "warning"
                                        : match.status === "FINISHED"
                                        ? "success"
                                        : "default"
                                    }
                                  >
                                    {match.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>{match.bestOf}</TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedMatch(match);
                                        setFormData({
                                          type: match.type,
                                          bestOf: match.bestOf,
                                          startDate: match.startDate ? formatForDateTimeInput(match.startDate) : "",
                                          teamAId: match.teamAId,
                                          teamBId: match.teamBId,
                                          semanas: match.semanas,
                                          title: match.title || "",
                                        });
                                        setShowEditModal(true);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                    <Button variant="danger" size="sm" onClick={() => handleDelete(match.id)}>
                                      Delete
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Match Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalHeader>
          <ModalTitle>Create Match</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <Select
              label="Match Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as Match["type"] })}
              options={[
                { value: "ROUNDROBIN", label: "Round Robin" },
                { value: "PLAYINS", label: "Play-ins" },
                { value: "PLAYOFFS", label: "Playoffs" },
                { value: "SEMIFINALS", label: "Semifinals" },
                { value: "FINALS", label: "Finals" },
                { value: "PRACTICE", label: "Practice" },
              ]}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Team A"
                value={formData.teamAId?.toString()}
                onChange={(e) => setFormData({ ...formData, teamAId: parseInt(e.target.value) })}
                options={teams.map((t) => ({ value: t.id.toString(), label: t.name }))}
              />
              <Select
                label="Team B"
                value={formData.teamBId?.toString()}
                onChange={(e) => setFormData({ ...formData, teamBId: parseInt(e.target.value) })}
                options={teams.map((t) => ({ value: t.id.toString(), label: t.name }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Best Of"
                type="number"
                value={formData.bestOf}
                onChange={(e) => setFormData({ ...formData, bestOf: parseInt(e.target.value) })}
                min={1}
                max={9}
              />
              <Input
                label="Week"
                type="number"
                value={formData.semanas}
                onChange={(e) => setFormData({ ...formData, semanas: parseInt(e.target.value) })}
                min={1}
              />
            </div>
            <Input
              label="Start Date"
              type="datetime-local"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
            <Input
              label="Title (optional)"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Week 1 Match"
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => { setShowCreateModal(false); setFormData({ type: "ROUNDROBIN", bestOf: 5, startDate: "", teamAId: 0, teamBId: 0, semanas: 1, title: "" }); }}>Cancel</Button>
          <Button onClick={handleCreate}>Create Match</Button>
        </ModalFooter>
      </Modal>

      {/* Edit Match Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)}>
        <ModalHeader>
          <ModalTitle>Edit Match</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <Select
              label="Match Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as Match["type"] })}
              options={[
                { value: "ROUNDROBIN", label: "Round Robin" },
                { value: "PLAYINS", label: "Play-ins" },
                { value: "PLAYOFFS", label: "Playoffs" },
                { value: "SEMIFINALS", label: "Semifinals" },
                { value: "FINALS", label: "Finals" },
                { value: "PRACTICE", label: "Practice" },
              ]}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Team A"
                value={formData.teamAId?.toString()}
                onChange={(e) => setFormData({ ...formData, teamAId: parseInt(e.target.value) })}
                options={teams.map((t) => ({ value: t.id.toString(), label: t.name }))}
              />
              <Select
                label="Team B"
                value={formData.teamBId?.toString()}
                onChange={(e) => setFormData({ ...formData, teamBId: parseInt(e.target.value) })}
                options={teams.map((t) => ({ value: t.id.toString(), label: t.name }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Best Of"
                type="number"
                value={formData.bestOf}
                onChange={(e) => setFormData({ ...formData, bestOf: parseInt(e.target.value) })}
                min={1}
                max={9}
              />
              <Input
                label="Week"
                type="number"
                value={formData.semanas}
                onChange={(e) => setFormData({ ...formData, semanas: parseInt(e.target.value) })}
                min={1}
              />
            </div>
            <Input
              label="Start Date"
              type="datetime-local"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
            <Input
              label="Title (optional)"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => { setShowEditModal(false); setFormData({ type: "ROUNDROBIN", bestOf: 5, startDate: "", teamAId: 0, teamBId: 0, semanas: 1, title: "" }); setSelectedMatch(null); }}>Cancel</Button>
          <Button onClick={handleUpdate}>Save Changes</Button>
        </ModalFooter>
      </Modal>

      {/* Generate Round Robin Modal */}
      <Modal isOpen={showRoundRobinModal} onClose={() => setShowRoundRobinModal(false)}>
        <ModalHeader>
          <ModalTitle>Generate Round Robin Schedule</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <p className="text-muted text-sm mb-4">
            This will generate all matches for a round robin format where each team plays against every other team.<br />
            <span className="text-warning">Type <b>CONFIRM ROUND ROBIN</b> below to confirm.</span>
          </p>
          <div className="space-y-4">
            <Input
              label="Best Of (per match)"
              type="number"
              value={roundRobinData.bestOf}
              onChange={(e) => setRoundRobinData({ ...roundRobinData, bestOf: parseInt(e.target.value) })}
              min={1}
              max={9}
            />
            <Input
              label="Confirmation"
              placeholder="Type CONFIRM ROUND ROBIN"
              value={roundRobinData.confirmationText}
              onChange={(e) => setRoundRobinData({ ...roundRobinData, confirmationText: e.target.value })}
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowRoundRobinModal(false)}>Cancel</Button>
          <Button onClick={handleGenerateRoundRobin} disabled={roundRobinData.confirmationText !== "CONFIRM ROUND ROBIN"}>Generate Schedule</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

// ==================== TEAMS SECTION ====================
function TeamsSection({ token }: { token: string }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [formData, setFormData] = useState<Partial<CreateTeamPayload>>({
    name: "",
    logo: "",
    roster: "",
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const [rosterUploading, setRosterUploading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const rosterInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [teamsData, tournamentData, membersData] = await Promise.all([
        getTeams(),
        getCurrentTournament(),
        getMembers(),
      ]);
      setTeams(teamsData);
      setTournament(tournamentData);
      setMembers(membersData);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function uploadImage(file: File, type: "logo" | "roster"): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
      
      const result = await response.json();
      return result.url;
    } catch (error: any) {
      showNotification("error", error.message || "Failed to upload image");
      return null;
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLogoUploading(true);
    const url = await uploadImage(file, "logo");
    if (url) {
      setFormData({ ...formData, logo: url });
    }
    setLogoUploading(false);
  }

  async function handleRosterUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setRosterUploading(true);
    const url = await uploadImage(file, "roster");
    if (url) {
      setFormData({ ...formData, roster: url });
    }
    setRosterUploading(false);
  }

  async function handleCreate() {
    if (!tournament) return;
    try {
      await adminCreateTeam(token, {
        ...formData,
        tournamentId: tournament.id,
      } as CreateTeamPayload);
      setShowCreateModal(false);
      setFormData({ name: "", logo: "", roster: "" });
      showNotification("success", "Team created successfully");
      loadData();
    } catch (err: any) {
      console.error("Failed to create team:", err);
      showNotification("error", err.message || "Failed to create team");
    }
  }

  async function handleUpdate() {
    if (!selectedTeam) return;
    try {
      await adminUpdateTeam(token, selectedTeam.id, formData);
      setShowEditModal(false);
      showNotification("success", "Team updated successfully");
      loadData();
    } catch (err: any) {
      console.error("Failed to update team:", err);
      showNotification("error", err.message || "Failed to update team");
    }
  }

  async function handleDelete(teamId: number) {
    if (!confirm("Are you sure you want to delete this team?")) return;
    try {
      await adminDeleteTeam(token, teamId);
      showNotification("success", "Team deleted successfully");
      loadData();
    } catch (err: any) {
      console.error("Failed to delete team:", err);
      showNotification("error", err.message || "Failed to delete team");
    }
  }

  async function handleAddMemberToTeam(memberId: number) {
    if (!selectedTeam) return;
    try {
      await adminUpdateMember(token, memberId, { teamId: selectedTeam.id });
      showNotification("success", "Member added to team");
      loadData();
    } catch (err: any) {
      console.error("Failed to add member:", err);
      showNotification("error", err.message || "Failed to add member");
    }
  }

  async function handleRemoveMemberFromTeam(memberId: number) {
    try {
      await adminUpdateMember(token, memberId, { teamId: null });
      showNotification("success", "Member removed from team");
      loadData();
    } catch (err: any) {
      console.error("Failed to remove member:", err);
      showNotification("error", err.message || "Failed to remove member");
    }
  }

  // Get team members for the selected team
  const teamMembers = selectedTeam 
    ? members.filter(m => m.teamId === selectedTeam.id)
    : [];

  // Get available members (users without a team) and filter by search
  const availableMembers = members
    .filter(m => m.teamId === null)
    .filter(m => 
      memberSearch === "" || 
      m.nickname.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.user.toLowerCase().includes(memberSearch.toLowerCase())
    );

  if (loading) {
    return <Card><CardContent className="p-8 text-center text-muted">Loading teams...</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`p-4 rounded-lg ${notification.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {notification.message}
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Teams ({teams.length})</CardTitle>
          <Button onClick={() => setShowCreateModal(true)} disabled={!tournament}>
            Create Team
          </Button>
        </CardHeader>
        <CardContent>
          {!tournament ? (
            <p className="text-muted text-center py-4">Create a tournament first to manage teams.</p>
          ) : teams.length === 0 ? (
            <p className="text-muted text-center py-4">No teams yet. Create one to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Logo</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Wins</TableHead>
                    <TableHead>Map W</TableHead>
                    <TableHead>Map L</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team) => {
                    const teamMemberCount = members.filter(m => m.teamId === team.id).length;
                    return (
                      <TableRow key={team.id}>
                        <TableCell>
                          {team.logo ? (
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-surface border border-border">
                              <Image 
                                src={team.logo} 
                                alt={team.name} 
                                fill 
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                              <span className="text-sm font-bold text-primary">{team.name.charAt(0)}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{team.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{teamMemberCount} members</Badge>
                        </TableCell>
                        <TableCell>{team.victories}</TableCell>
                        <TableCell className="text-success">{team.mapWins}</TableCell>
                        <TableCell className="text-danger">{team.mapLoses}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setSelectedTeam(team);
                                setMemberSearch("");
                                setShowMembersModal(true);
                              }}
                            >
                              Members
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedTeam(team);
                                setFormData({
                                  name: team.name,
                                  logo: team.logo || "",
                                  roster: team.roster || "",
                                });
                                setShowEditModal(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => handleDelete(team.id)}>
                              Delete
                            </Button>
                          </div>
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

      {/* Create Team Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalHeader>
          <ModalTitle>Create Team</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <Input
              label="Team Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Team Name"
            />
            
            {/* Logo Upload */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Team Logo</label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <div className="flex items-center gap-4">
                {formData.logo ? (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                    <Image src={formData.logo} alt="Logo preview" fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-surface border-2 border-dashed border-border flex items-center justify-center">
                    <span className="text-xs text-muted">No logo</span>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                  >
                    {logoUploading ? "Uploading..." : "Upload Logo"}
                  </Button>
                  {formData.logo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, logo: "" })}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Roster Upload */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Team Roster Image</label>
              <input
                ref={rosterInputRef}
                type="file"
                accept="image/*"
                onChange={handleRosterUpload}
                className="hidden"
              />
              <div className="flex items-center gap-4">
                {formData.roster ? (
                  <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-border">
                    <Image src={formData.roster} alt="Roster preview" fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="w-32 h-20 rounded-lg bg-surface border-2 border-dashed border-border flex items-center justify-center">
                    <span className="text-xs text-muted">No roster</span>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => rosterInputRef.current?.click()}
                    disabled={rosterUploading}
                  >
                    {rosterUploading ? "Uploading..." : "Upload Roster"}
                  </Button>
                  {formData.roster && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, roster: "" })}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => { setShowCreateModal(false); setFormData({ name: "", logo: "", roster: "" }); }}>Cancel</Button>
          <Button onClick={handleCreate}>Create Team</Button>
        </ModalFooter>
      </Modal>

      {/* Edit Team Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)}>
        <ModalHeader>
          <ModalTitle>Edit Team</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <Input
              label="Team Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            
            {/* Logo Upload */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Team Logo</label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <div className="flex items-center gap-4">
                {formData.logo ? (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                    <Image src={formData.logo} alt="Logo preview" fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-surface border-2 border-dashed border-border flex items-center justify-center">
                    <span className="text-xs text-muted">No logo</span>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                  >
                    {logoUploading ? "Uploading..." : "Upload Logo"}
                  </Button>
                  {formData.logo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, logo: "" })}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Roster Upload */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Team Roster Image</label>
              <input
                ref={rosterInputRef}
                type="file"
                accept="image/*"
                onChange={handleRosterUpload}
                className="hidden"
              />
              <div className="flex items-center gap-4">
                {formData.roster ? (
                  <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-border">
                    <Image src={formData.roster} alt="Roster preview" fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="w-32 h-20 rounded-lg bg-surface border-2 border-dashed border-border flex items-center justify-center">
                    <span className="text-xs text-muted">No roster</span>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => rosterInputRef.current?.click()}
                    disabled={rosterUploading}
                  >
                    {rosterUploading ? "Uploading..." : "Upload Roster"}
                  </Button>
                  {formData.roster && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, roster: "" })}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => { setShowEditModal(false); setFormData({ name: "", logo: "", roster: "" }); setSelectedTeam(null); }}>Cancel</Button>
          <Button onClick={handleUpdate}>Save Changes</Button>
        </ModalFooter>
      </Modal>

      {/* Manage Team Members Modal */}
      <Modal isOpen={showMembersModal} onClose={() => setShowMembersModal(false)}>
        <ModalHeader>
          <ModalTitle>Manage Members - {selectedTeam?.name}</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-6">
            {/* Current Team Members */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Current Members ({teamMembers.length})</h4>
              {teamMembers.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center border border-dashed border-border rounded-lg">
                  No members in this team yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {teamMembers.map((member) => (
                    <div 
                      key={member.id} 
                      className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">{member.nickname.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{member.nickname}</p>
                          <p className="text-xs text-muted">@{member.user}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={member.role === "CAPTAIN" ? "success" : "secondary"}>
                          {member.role}
                        </Badge>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRemoveMemberFromTeam(member.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Members */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Add Members</h4>
              <Input
                placeholder="Search by nickname or username..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="mb-3"
              />
              {availableMembers.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center border border-dashed border-border rounded-lg">
                  {memberSearch ? "No matching users found." : "All users are already assigned to teams."}
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableMembers.map((member) => (
                    <div 
                      key={member.id} 
                      className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-muted">{member.nickname.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{member.nickname}</p>
                          <p className="text-xs text-muted">@{member.user}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{member.role}</Badge>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleAddMemberToTeam(member.id)}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowMembersModal(false)}>Close</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

// ==================== USERS SECTION ====================
function UsersSection({ token }: { token: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [formData, setFormData] = useState({
    nickname: "",
    user: "",
    password: "",
    role: "DEFAULT",
    teamId: "",
  });

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [membersData, teamsData] = await Promise.all([
        getMembers(),
        getTeams(),
      ]);
      setMembers(membersData);
      setTeams(teamsData);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      await adminRegisterMember(token, {
        nickname: formData.nickname,
        user: formData.user,
        password: formData.password,
        role: formData.role,
        teamId: formData.teamId ? parseInt(formData.teamId) : undefined,
      });
      setShowCreateModal(false);
      setFormData({ nickname: "", user: "", password: "", role: "DEFAULT", teamId: "" });
      showNotification("success", "User created successfully");
      loadData();
    } catch (err: any) {
      console.error("Failed to create user:", err);
      showNotification("error", err.message || "Failed to create user");
    }
  }

  async function handleUpdate() {
    if (!selectedMember) return;
    try {
      await adminUpdateMember(token, selectedMember.id, {
        nickname: formData.nickname,
        role: formData.role as Member["role"],
        teamId: formData.teamId ? parseInt(formData.teamId) : null,
      });
      setShowEditModal(false);
      showNotification("success", "User updated successfully");
      loadData();
    } catch (err: any) {
      console.error("Failed to update user:", err);
      showNotification("error", err.message || "Failed to update user");
    }
  }

  const getTeamName = (teamId: number | null) => 
    teamId ? teams.find((t) => t.id === teamId)?.name || "Unknown" : "No Team";

  if (loading) {
    return <Card><CardContent className="p-8 text-center text-muted">Loading users...</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`p-4 rounded-lg ${notification.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {notification.message}
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Users ({members.length})</CardTitle>
          <Button onClick={() => setShowCreateModal(true)}>
            Register User
          </Button>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-muted text-center py-4">No users registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nickname</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.nickname}</TableCell>
                      <TableCell className="text-muted">{member.user}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            member.role === "ADMIN"
                              ? "danger"
                              : member.role === "MANAGER"
                              ? "warning"
                              : member.role === "CAPTAIN"
                              ? "success"
                              : "default"
                          }
                        >
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{getTeamName(member.teamId)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedMember(member);
                            setFormData({
                              nickname: member.nickname,
                              user: member.user,
                              password: "",
                              role: member.role,
                              teamId: member.teamId?.toString() || "",
                            });
                            setShowEditModal(true);
                          }}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalHeader>
          <ModalTitle>Register User</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <Input
              label="Nickname"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              placeholder="Display name"
            />
            <Input
              label="Username"
              value={formData.user}
              onChange={(e) => setFormData({ ...formData, user: e.target.value })}
              placeholder="Login username"
            />
            <Input
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Password"
            />
            <Select
              label="Role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              options={[
                { value: "DEFAULT", label: "Default" },
                { value: "CAPTAIN", label: "Captain" },
                { value: "MANAGER", label: "Manager" },
                { value: "EDITOR", label: "Editor" },
                { value: "ADMIN", label: "Admin" },
              ]}
            />
            <Select
              label="Team (optional)"
              value={formData.teamId}
              onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
              options={[
                { value: "", label: "No Team" },
                ...teams.map((t) => ({ value: t.id.toString(), label: t.name })),
              ]}
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => { setShowCreateModal(false); setFormData({ nickname: "", user: "", password: "", role: "DEFAULT", teamId: "" }); }}>Cancel</Button>
          <Button onClick={handleCreate}>Register User</Button>
        </ModalFooter>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)}>
        <ModalHeader>
          <ModalTitle>Edit User</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <Input
              label="Nickname"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
            />
            <Select
              label="Role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              options={[
                { value: "DEFAULT", label: "Default" },
                { value: "CAPTAIN", label: "Captain" },
                { value: "MANAGER", label: "Manager" },
                { value: "EDITOR", label: "Editor" },
                { value: "ADMIN", label: "Admin" },
              ]}
            />
            <Select
              label="Team"
              value={formData.teamId}
              onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
              options={[
                { value: "", label: "No Team" },
                ...teams.map((t) => ({ value: t.id.toString(), label: t.name })),
              ]}
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => { setShowEditModal(false); setFormData({ nickname: "", user: "", password: "", role: "DEFAULT", teamId: "" }); setSelectedMember(null); }}>Cancel</Button>
          <Button onClick={handleUpdate}>Save Changes</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
