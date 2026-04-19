"use client";

import { useState, useEffect } from "react";
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
  getTournaments,
  getCurrentTournament,
  createTournament,
  updateTournament,
  deleteTournament,
  adminCreateMatch,
  adminUpdateMatch,
  adminDeleteMatch,
  adminGenerateRoundRobin,
  adminCreateTeam,
  adminUpdateTeam,
  adminDeleteTeam,
  getMembers,
  adminRegisterMember,
  adminUpdateMember,
  type Tournament,
  type Member,
  type CreateMatchPayload,
  type CreateTeamPayload,
} from "@/lib/api/admin";
import { getMatches, getTeams, type Match, type Team } from "@/lib/api";

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
  const [formData, setFormData] = useState({ name: "", startDate: "", state: "SCHEDULED" });

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
      await createTournament(token, { name: formData.name, startDate: formData.startDate });
      setShowCreateModal(false);
      loadTournament();
    } catch (err) {
      console.error("Failed to create tournament:", err);
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
      loadTournament();
    } catch (err) {
      console.error("Failed to update tournament:", err);
    }
  }

  async function handleDelete() {
    if (!tournament) return;
    if (!confirm("Are you sure you want to delete this tournament?")) return;
    try {
      await deleteTournament(token, tournament.id);
      setTournament(null);
    } catch (err) {
      console.error("Failed to delete tournament:", err);
    }
  }

  if (loading) {
    return <Card><CardContent className="p-8 text-center text-muted">Loading tournament...</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {tournament ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Current Tournament</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFormData({
                    name: tournament.name,
                    startDate: tournament.startDate.split("T")[0],
                    state: tournament.state,
                  });
                  setShowEditModal(true);
                }}
              >
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
                <p className="text-sm text-muted">Start Date</p>
                <p className="text-lg font-semibold text-foreground">
                  {new Date(tournament.startDate).toLocaleDateString()}
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
              label="Start Date"
              type="date"
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
          <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
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
      await adminCreateMatch(token, {
        ...formData,
        tournamentId: tournament.id,
      } as CreateMatchPayload);
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      console.error("Failed to create match:", err);
    }
  }

  async function handleUpdate() {
    if (!selectedMatch) return;
    try {
      await adminUpdateMatch(token, selectedMatch.id, formData as Partial<Match>);
      setShowEditModal(false);
      loadData();
    } catch (err) {
      console.error("Failed to update match:", err);
    }
  }

  async function handleDelete(matchId: number) {
    if (!confirm("Are you sure you want to delete this match?")) return;
    try {
      await adminDeleteMatch(token, matchId);
      loadData();
    } catch (err) {
      console.error("Failed to delete match:", err);
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
      loadData();
    } catch (err) {
      console.error("Failed to generate round robin:", err);
    }
  }

  const getTeamName = (teamId: number) => teams.find((t) => t.id === teamId)?.name || `Team ${teamId}`;

  if (loading) {
    return <Card><CardContent className="p-8 text-center text-muted">Loading matches...</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
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
                            {weekMap.get(week).map((match) => (
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
                                          startDate: match.startDate ? match.startDate.split("T")[0] : "",
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
          <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
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
          <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
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
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState<Partial<CreateTeamPayload>>({
    name: "",
    logo: "",
    roster: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [teamsData, tournamentData] = await Promise.all([
        getTeams(),
        getCurrentTournament(),
      ]);
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
      await adminCreateTeam(token, {
        ...formData,
        tournamentId: tournament.id,
      } as CreateTeamPayload);
      setShowCreateModal(false);
      setFormData({ name: "", logo: "", roster: "" });
      loadData();
    } catch (err) {
      console.error("Failed to create team:", err);
    }
  }

  async function handleUpdate() {
    if (!selectedTeam) return;
    try {
      await adminUpdateTeam(token, selectedTeam.id, formData);
      setShowEditModal(false);
      loadData();
    } catch (err) {
      console.error("Failed to update team:", err);
    }
  }

  async function handleDelete(teamId: number) {
    if (!confirm("Are you sure you want to delete this team?")) return;
    try {
      await adminDeleteTeam(token, teamId);
      loadData();
    } catch (err) {
      console.error("Failed to delete team:", err);
    }
  }

  if (loading) {
    return <Card><CardContent className="p-8 text-center text-muted">Loading teams...</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
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
                    <TableHead>Name</TableHead>
                    <TableHead>Wins</TableHead>
                    <TableHead>Map W</TableHead>
                    <TableHead>Map L</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>{team.victories}</TableCell>
                      <TableCell className="text-success">{team.mapWins}</TableCell>
                      <TableCell className="text-danger">{team.mapLoses}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
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
                  ))}
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
            <Input
              label="Logo URL (optional)"
              value={formData.logo}
              onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
              placeholder="https://..."
            />
            <Input
              label="Roster (optional)"
              value={formData.roster}
              onChange={(e) => setFormData({ ...formData, roster: e.target.value })}
              placeholder="Comma-separated player names"
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
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
            <Input
              label="Logo URL (optional)"
              value={formData.logo}
              onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
            />
            <Input
              label="Roster (optional)"
              value={formData.roster}
              onChange={(e) => setFormData({ ...formData, roster: e.target.value })}
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
          <Button onClick={handleUpdate}>Save Changes</Button>
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
  const [formData, setFormData] = useState({
    nickname: "",
    user: "",
    password: "",
    role: "DEFAULT",
    teamId: "",
  });

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
      loadData();
    } catch (err) {
      console.error("Failed to create user:", err);
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
      loadData();
    } catch (err) {
      console.error("Failed to update user:", err);
    }
  }

  const getTeamName = (teamId: number | null) => 
    teamId ? teams.find((t) => t.id === teamId)?.name || "Unknown" : "No Team";

  if (loading) {
    return <Card><CardContent className="p-8 text-center text-muted">Loading users...</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
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
          <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
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
          <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
          <Button onClick={handleUpdate}>Save Changes</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
