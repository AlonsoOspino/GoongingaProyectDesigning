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
import { resolveMapImageUrl } from "@/lib/assetUrls";
import {
  createTournament, updateTournament, deleteTournament, getCurrentTournament,
  adminCreateMatch, adminUpdateMatch, adminDeleteMatch, adminGenerateRoundRobin,
  adminCreateTeam, adminCreateTeams, adminUpdateTeam, adminDeleteTeam,
  adminRegisterMember, adminUpdateMember, adminBulkImportUsers, getMembers, getMaps,
  adminDownloadBackupSql, adminRestoreBackupSql, adminWipeDatabase,
  adminUpdateWeekMaps,
  type CreateMatchPayload, type CreateTeamPayload, type Member, type AdminGameMap,
} from "@/lib/api/admin";
import { convertToISODateTime, formatDateEST, formatForDateInput, formatForDateTimeInput } from "@/lib/dateUtils";
import { getMatches, getTeams, type Match, type Team } from "@/lib/api";
import type { Tournament } from "@/lib/api/types";

type ActiveTab = "tournament" | "matches" | "weekMaps" | "teams" | "users";

const ALL_MATCH_TYPES: Match["type"][] = [
  "ROUNDROBIN",
  "PLAYINS",
  "PLAYOFFS",
  "SEMIFINALS",
  "FINALS",
  "PRACTICE",
];

const ALLOWED_MATCH_TYPES_BY_STATE: Record<Tournament["state"], Match["type"][]> = {
  SCHEDULED: ALL_MATCH_TYPES,
  ROUNDROBIN: ["ROUNDROBIN"],
  PLAYOFFS: ["PLAYINS", "PLAYOFFS"],
  SEMIFINALS: ["SEMIFINALS"],
  FINALS: ["FINALS"],
  FINISHED: ["FINALS"],
};

const MATCH_TYPE_LABELS: Record<Match["type"], string> = {
  ROUNDROBIN: "Round Robin",
  PLAYINS: "Play-ins",
  PLAYOFFS: "Playoffs",
  SEMIFINALS: "Semifinals",
  FINALS: "Finals",
  PRACTICE: "Practice",
};

const getAllowedMatchTypesForState = (state?: Tournament["state"] | null) => {
  if (!state) return ALL_MATCH_TYPES;
  return ALLOWED_MATCH_TYPES_BY_STATE[state] || ALL_MATCH_TYPES;
};

const splitDateTime = (value: string) => {
  if (!value) return { date: "", time: "" };
  const [date, time] = value.split("T");
  return { date: date || "", time: (time || "").slice(0, 5) };
};

const mergeDateTime = (date: string, time: string) => {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated } = useSession();
  const [activeTab, setActiveTab] = useState<ActiveTab>("tournament");

  useEffect(() => {
    if (isHydrated && (!isAuthenticated || user?.role !== "ADMIN")) router.push("/login");
  }, [isHydrated, isAuthenticated, user, router]);

  if (!isHydrated) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted">Loading...</div></div>;
  }
  if (!isAuthenticated || user?.role !== "ADMIN") return null;

  return (
    <main className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted mt-1">Manage tournament, matches, teams, and users</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => router.push("/admin-dashboard/overwatch-content")}
          >
            Add Overwatch content
          </Button>
        </div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
          <TabsList className="mb-6">
            <TabsTrigger value="tournament">Tournament</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="weekMaps">Week Maps</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>
          <TabsContent value="tournament"><TournamentSection token={token!} /></TabsContent>
          <TabsContent value="matches"><MatchesSection token={token!} /></TabsContent>
          <TabsContent value="weekMaps"><WeekMapsSection token={token!} /></TabsContent>
          <TabsContent value="teams"><TeamsSection token={token!} /></TabsContent>
          <TabsContent value="users"><UsersSection token={token!} /></TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

// ==================== TOURNAMENT ====================
function TournamentSection({ token }: { token: string }) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [formData, setFormData] = useState({ name: "", startDate: "", state: "SCHEDULED" });
  const { date: tournamentDate, time: tournamentTime } = splitDateTime(formData.startDate);

  const showNotif = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => { loadTournament(); }, []);

  async function loadTournament() {
    try { setTournament(await getCurrentTournament()); }
    catch { setTournament(null); }
    finally { setLoading(false); }
  }

  if (loading) return <Card variant="bordered"><CardContent className="p-8 text-center text-muted">Loading...</CardContent></Card>;

  return (
    <div className="space-y-6">
      {notification && <div className={`p-4 rounded-lg border ${notification.type === "success" ? "bg-success/10 text-success border-success/30" : "bg-danger/10 text-danger border-danger/30"}`}>{notification.message}</div>}
      {tournament ? (
        <Card variant="bordered">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{tournament.name}</CardTitle>
            <div className="flex gap-2">
              <Button onClick={() => { setShowEditModal(true); setFormData({ name: tournament.name, startDate: formatForDateInput(tournament.startDate), state: tournament.state }); }}>Edit</Button>
              <Button variant="danger" size="sm" onClick={async () => {
                if (!confirm("Delete this tournament?")) return;
                try { await deleteTournament(token, tournament.id); setTournament(null); showNotif("success", "Tournament deleted"); }
                catch (err: any) { showNotif("error", err.message); }
              }}>Delete</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div><p className="text-sm text-muted">Name</p><p className="text-lg font-semibold">{tournament.name}</p></div>
              <div><p className="text-sm text-muted">Start Date</p><p className="text-lg font-semibold">{formatDateEST(tournament.startDate)}</p></div>
              <div><p className="text-sm text-muted">State</p><Badge variant={tournament.state === "FINISHED" ? "success" : "default"}>{tournament.state}</Badge></div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card variant="bordered">
          <CardContent className="p-8 text-center">
            <p className="text-muted mb-4">No tournament exists yet.</p>
            <Button onClick={() => setShowCreateModal(true)}>Create Tournament</Button>
          </CardContent>
        </Card>
      )}

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalHeader><ModalTitle>Create Tournament</ModalTitle></ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <Input label="Tournament Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Season 1" />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start Date (EST)"
                type="date"
                value={tournamentDate}
                onChange={(e) => setFormData({ ...formData, startDate: mergeDateTime(e.target.value, tournamentTime) })}
              />
              <Input
                label="Start Time (EST)"
                type="time"
                value={tournamentTime}
                onChange={(e) => setFormData({ ...formData, startDate: mergeDateTime(tournamentDate, e.target.value) })}
              />
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
          <Button onClick={async () => {
            try {
              await createTournament(token, { name: formData.name, startDate: convertToISODateTime(formData.startDate) });
              setShowCreateModal(false);
              showNotif("success", "Tournament created");
              loadTournament();
            } catch (err: any) { showNotif("error", err.message); }
          }}>Create</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)}>
        <ModalHeader><ModalTitle>Edit Tournament</ModalTitle></ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <Input label="Tournament Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            <Select label="State" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              options={[
                { value: "SCHEDULED", label: "Scheduled" }, { value: "ROUNDROBIN", label: "Round Robin" },
                { value: "PLAYOFFS", label: "Playoffs" }, { value: "SEMIFINALS", label: "Semifinals" },
                { value: "FINALS", label: "Finals" }, { value: "FINISHED", label: "Finished" },
              ]}
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
          <Button onClick={async () => {
            if (!tournament) return;
            try {
              await updateTournament(token, tournament.id, { name: formData.name, state: formData.state as Tournament["state"] });
              setShowEditModal(false);
              showNotif("success", "Tournament updated");
              loadTournament();
            } catch (err: any) { showNotif("error", err.message); }
          }}>Save Changes</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

// ==================== MATCHES ====================
function MatchesSection({ token }: { token: string }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [maps, setMaps] = useState<AdminGameMap[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRRModal, setShowRRModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [rrData, setRrData] = useState({ bestOf: 5, confirmationText: "" });
  const createInitialMatchFormData = (type: Match["type"]): Partial<CreateMatchPayload> => ({
    type,
    bestOf: 5,
    startDate: "",
    teamAId: 0,
    teamBId: 0,
    semanas: type === "ROUNDROBIN" ? 1 : null,
    title: "",
    mapsAllowedByRound: {},
  });

  const [formData, setFormData] = useState<Partial<CreateMatchPayload>>(
    createInitialMatchFormData("ROUNDROBIN")
  );
  const { date: matchDate, time: matchTime } = splitDateTime(formData.startDate || "");

  // Maps selection per round
  const [showMapConfig, setShowMapConfig] = useState(false);

  const showNotif = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);

  };

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [m, t, tour, mapList] = await Promise.all([
        getMatches().catch(() => []),
        getTeams().catch(() => []),
        getCurrentTournament().catch(() => null),
        getMaps().catch(() => []),
      ]);
      setMatches(m); setTeams(t); setTournament(tour); setMaps(mapList);
    } catch { } finally { setLoading(false); }
  }

  const getTeamName = (id: number) => teams.find((t) => t.id === id)?.name || `Team ${id}`;

  const allowedMatchTypes = getAllowedMatchTypesForState(tournament?.state || null);

  const visibleMatches = matches.filter((m) => allowedMatchTypes.includes(m.type));

  const roundRobinMatchesByWeek = visibleMatches
    .filter((m) => m.type === "ROUNDROBIN")
    .reduce((acc, m) => {
      if (m.semanas === null) return acc;
      const w = m.semanas;
      if (!acc[w]) acc[w] = [];
      acc[w].push(m);
      return acc;
    }, {} as Record<number, Match[]>);

  const bracketMatchesByType = visibleMatches
    .filter((m) => m.type !== "ROUNDROBIN")
    .reduce((acc, m) => {
      if (!acc[m.type]) acc[m.type] = [];
      acc[m.type].push(m);
      return acc;
    }, {} as Record<string, Match[]>);

  const bracketTypeOrder: Match["type"][] = [
    "PLAYINS",
    "PLAYOFFS",
    "SEMIFINALS",
    "FINALS",
    "PRACTICE",
  ];

  const handleMatchTypeChange = (nextType: Match["type"]) => {
    setFormData((prev) => ({
      ...prev,
      type: nextType,
      semanas: nextType === "ROUNDROBIN" ? Number(prev.semanas || 1) : null,
    }));
  };

  const buildMatchPayload = (data: Partial<CreateMatchPayload>) => {
    const normalizedType = (data.type || "ROUNDROBIN") as Match["type"];
    const normalizedStartDate = data.startDate ? convertToISODateTime(data.startDate) : undefined;
    const normalizedSemanas = normalizedType === "ROUNDROBIN" ? Number(data.semanas || 1) : null;

    return {
      ...data,
      type: normalizedType,
      startDate: normalizedStartDate,
      semanas: normalizedSemanas,
    };
  };

  const isRoundRobinForm = formData.type === "ROUNDROBIN";

  // Maps grouped by type for round assignment
  const mapsByType: Record<string, AdminGameMap[]> = {};
  for (const map of maps) {
    if (!mapsByType[map.type]) mapsByType[map.type] = [];
    mapsByType[map.type].push(map);
  }

  // Round map types guide: 1=CONTROL, 2=HYBRID, 3=PAYLOAD, 4=PUSH + FLASHPOINT, 5=CONTROL again
  const roundMapTypes: Record<string, string[]> = {
    "1": ["CONTROL"], "2": ["HYBRID"], "3": ["PAYLOAD"], "4": ["PUSH", "FLASHPOINT"], "5": ["CONTROL"],
  };

  function toggleMapForRound(round: string, mapId: number) {
    const current = formData.mapsAllowedByRound?.[round] || [];
    const next = current.includes(mapId) ? current.filter((id) => id !== mapId) : [...current, mapId];
    setFormData({ ...formData, mapsAllowedByRound: { ...formData.mapsAllowedByRound, [round]: next } });
  }

  if (loading) return <Card variant="bordered"><CardContent className="p-8 text-center text-muted">Loading...</CardContent></Card>;

  return (
    <div className="space-y-6">
      {notification && <div className={`p-4 rounded-lg border ${notification.type === "success" ? "bg-success/10 text-success border-success/30" : "bg-danger/10 text-danger border-danger/30"}`}>{notification.message}</div>}

      <Card variant="bordered">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Matches ({visibleMatches.length})</CardTitle>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowRRModal(true)} disabled={!tournament || maps.length === 0}>Generate Round Robin</Button>
            <Button
              onClick={() => {
                const defaultType = allowedMatchTypes[0] || "ROUNDROBIN";
                setFormData(createInitialMatchFormData(defaultType));
                setShowCreateModal(true);
              }}
              disabled={!tournament || teams.length < 2 || maps.length === 0}
            >
              Create Match
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {maps.length === 0 && (
            <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              No maps found in database. Run backend command: npm run db:seed:maps
            </div>
          )}
          {!tournament ? (
            <p className="text-muted text-center py-4">Create a tournament first.</p>
          ) : visibleMatches.length === 0 ? (
            <p className="text-muted text-center py-4">No matches yet.</p>
          ) : (
            <div className="space-y-8">
              {roundRobinMatchesByWeek && Object.keys(roundRobinMatchesByWeek).length > 0 && (
                <div className="space-y-8">
                  {Object.entries(roundRobinMatchesByWeek)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([week, weekMatches]) => (
                      <div key={`rr-${week}`}>
                        <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Week {week}</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Match</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>BO</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {weekMatches.map((match) => (
                              <TableRow key={match.id}>
                                <TableCell className="font-medium">{getTeamName(match.teamAId)} vs {getTeamName(match.teamBId)}</TableCell>
                                <TableCell><Badge variant="secondary">{match.type}</Badge></TableCell>
                                <TableCell>
                                  <Badge variant={match.status === "ACTIVE" ? "warning" : match.status === "FINISHED" ? "success" : "default"}>
                                    {match.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>{match.bestOf}</TableCell>
                                <TableCell className="text-sm text-muted">
                                  {match.startDate ? new Date(match.startDate).toLocaleDateString() : "—"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => {
                                      setSelectedMatch(match);
                                      setFormData({
                                        type: match.type, bestOf: match.bestOf,
                                        startDate: match.startDate ? formatForDateTimeInput(match.startDate) : "",
                                        teamAId: match.teamAId, teamBId: match.teamBId,
                                        semanas: match.semanas,
                                        title: match.title || "",
                                        mapsAllowedByRound: (match.mapsAllowedByRound as any) || {},
                                      });
                                      setShowEditModal(true);
                                    }}>Edit</Button>
                                    <Button variant="danger" size="sm" onClick={async () => {
                                      if (!confirm("Delete this match?")) return;
                                      try { await adminDeleteMatch(token, match.id); showNotif("success", "Match deleted"); loadData(); }
                                      catch (err: any) { showNotif("error", err.message); }
                                    }}>Delete</Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                </div>
              )}

              {bracketTypeOrder.map((type) => {
                const typeMatches = bracketMatchesByType[type] || [];
                if (typeMatches.length === 0) return null;
                return (
                  <div key={type}>
                    <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">{MATCH_TYPE_LABELS[type]}</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Match</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>BO</TableHead>
                          <TableHead>Week</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {typeMatches.map((match) => (
                          <TableRow key={match.id}>
                            <TableCell className="font-medium">{getTeamName(match.teamAId)} vs {getTeamName(match.teamBId)}</TableCell>
                            <TableCell>
                              <Badge variant={match.status === "ACTIVE" ? "warning" : match.status === "FINISHED" ? "success" : "default"}>
                                {match.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{match.bestOf}</TableCell>
                            <TableCell className="text-sm text-muted">—</TableCell>
                            <TableCell className="text-sm text-muted">
                              {match.startDate ? new Date(match.startDate).toLocaleDateString() : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => {
                                  setSelectedMatch(match);
                                  setFormData({
                                    type: match.type,
                                    bestOf: match.bestOf,
                                    startDate: match.startDate ? formatForDateTimeInput(match.startDate) : "",
                                    teamAId: match.teamAId,
                                    teamBId: match.teamBId,
                                    semanas: match.semanas,
                                    title: match.title || "",
                                    mapsAllowedByRound: (match.mapsAllowedByRound as any) || {},
                                  });
                                  setShowEditModal(true);
                                }}>Edit</Button>
                                <Button variant="danger" size="sm" onClick={async () => {
                                  if (!confirm("Delete this match?")) return;
                                  try { await adminDeleteMatch(token, match.id); showNotif("success", "Match deleted"); loadData(); }
                                  catch (err: any) { showNotif("error", err.message); }
                                }}>Delete</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Match Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalHeader><ModalTitle>Create Match</ModalTitle></ModalHeader>
        <ModalContent>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
            <Select label="Match Type" value={formData.type} onChange={(e) => handleMatchTypeChange(e.target.value as Match["type"])}
              options={allowedMatchTypes.map((v) => ({ value: v, label: MATCH_TYPE_LABELS[v] }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Team A" value={formData.teamAId?.toString()} onChange={(e) => setFormData({ ...formData, teamAId: parseInt(e.target.value) })}
                options={teams.map((t) => ({ value: t.id.toString(), label: t.name }))}
              />
              <Select label="Team B" value={formData.teamBId?.toString()} onChange={(e) => setFormData({ ...formData, teamBId: parseInt(e.target.value) })}
                options={teams.map((t) => ({ value: t.id.toString(), label: t.name }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Best Of" type="number" value={formData.bestOf} onChange={(e) => setFormData({ ...formData, bestOf: parseInt(e.target.value) })} min={1} max={9} />
              {isRoundRobinForm ? (
                <Input
                  label="Week"
                  type="number"
                  value={formData.semanas ?? 1}
                  onChange={(e) => setFormData({ ...formData, semanas: parseInt(e.target.value) })}
                  min={1}
                />
              ) : (
                <Input label="Week" value="No week for this stage" disabled />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                value={matchDate}
                onChange={(e) => setFormData({ ...formData, startDate: mergeDateTime(e.target.value, matchTime) })}
              />
              <Input
                label="Start Time"
                type="time"
                value={matchTime}
                onChange={(e) => setFormData({ ...formData, startDate: mergeDateTime(matchDate, e.target.value) })}
              />
            </div>
            <Input label="Title (optional)" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Week 1 Match" />

            {/* Map selection per game */}
            <div>
              <button type="button" className="text-sm text-primary font-medium flex items-center gap-1" onClick={() => setShowMapConfig(!showMapConfig)}>
                {showMapConfig ? "▼" : "▶"} Configure maps per game round (optional)
              </button>
              {showMapConfig && (
                <div className="mt-3 space-y-4 border border-border rounded-lg p-4 bg-surface/50 max-h-80 overflow-y-auto pr-2">
                  <p className="text-xs text-muted">Select which maps are available for each game. If empty, all maps of that type are allowed.</p>
                  {maps.length === 0 && (
                    <p className="text-xs text-danger">Map catalog is empty. Seed maps first with npm run db:seed:maps.</p>
                  )}
                  {Object.entries(roundMapTypes).map(([round, types]) => (
                    <div key={round}>
                      <p className="text-sm font-medium text-foreground mb-2">
                        Game {round} — {types.join(" / ")}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {maps.filter((m) => types.includes(m.type)).map((map) => {
                          const selected = (formData.mapsAllowedByRound?.[round] || []).includes(map.id);
                          return (
                            <button
                              key={map.id}
                              type="button"
                              onClick={() => toggleMapForRound(round, map.id)}
                              className={`text-left p-2 rounded border text-xs transition-all ${selected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:border-primary/50"}`}
                            >
                              <p className="font-medium">{map.description}</p>
                              <p className="opacity-60">{map.type}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
          <Button onClick={async () => {
            if (!tournament) return;
            try {
              const mapsConfig = formData.mapsAllowedByRound && Object.keys(formData.mapsAllowedByRound).some((k) => (formData.mapsAllowedByRound![k] || []).length > 0)
                ? formData.mapsAllowedByRound : undefined;
              await adminCreateMatch(token, {
                ...buildMatchPayload(formData),
                tournamentId: tournament.id,
                mapsAllowedByRound: mapsConfig,
              } as CreateMatchPayload);
              setShowCreateModal(false);
              showNotif("success", "Match created");
              loadData();
            } catch (err: any) { showNotif("error", err.message); }
          }}>Create Match</Button>
        </ModalFooter>
      </Modal>

      {/* Edit Match Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)}>
        <ModalHeader><ModalTitle>Edit Match</ModalTitle></ModalHeader>
        <ModalContent>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
            <Select label="Match Type" value={formData.type} onChange={(e) => handleMatchTypeChange(e.target.value as Match["type"])}
              options={allowedMatchTypes.map((v) => ({ value: v, label: MATCH_TYPE_LABELS[v] }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Best Of" type="number" value={formData.bestOf} onChange={(e) => setFormData({ ...formData, bestOf: parseInt(e.target.value) })} min={1} max={9} />
              {isRoundRobinForm ? (
                <Input
                  label="Week"
                  type="number"
                  value={formData.semanas ?? 1}
                  onChange={(e) => setFormData({ ...formData, semanas: parseInt(e.target.value) })}
                  min={1}
                />
              ) : (
                <Input label="Week" value="No week for this stage" disabled />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                value={matchDate}
                onChange={(e) => setFormData({ ...formData, startDate: mergeDateTime(e.target.value, matchTime) })}
              />
              <Input
                label="Start Time"
                type="time"
                value={matchTime}
                onChange={(e) => setFormData({ ...formData, startDate: mergeDateTime(matchDate, e.target.value) })}
              />
            </div>
            <Input label="Title (optional)" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />

            <div>
              <button type="button" className="text-sm text-primary font-medium flex items-center gap-1" onClick={() => setShowMapConfig(!showMapConfig)}>
                {showMapConfig ? "▼" : "▶"} Configure maps per game round
              </button>
              {showMapConfig && (
                <div className="mt-3 space-y-4 border border-border rounded-lg p-4 bg-surface/50 max-h-80 overflow-y-auto pr-2">
                  {maps.length === 0 && (
                    <p className="text-xs text-danger">Map catalog is empty. Seed maps first with npm run db:seed:maps.</p>
                  )}
                  {Object.entries(roundMapTypes).map(([round, types]) => (
                    <div key={round}>
                      <p className="text-sm font-medium text-foreground mb-2">Game {round} — {types.join(" / ")}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {maps.filter((m) => types.includes(m.type)).map((map) => {
                          const selected = (formData.mapsAllowedByRound?.[round] || []).includes(map.id);
                          return (
                            <button key={map.id} type="button" onClick={() => toggleMapForRound(round, map.id)}
                              className={`text-left p-2 rounded border text-xs transition-all ${selected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:border-primary/50"}`}>
                              <p className="font-medium">{map.description}</p>
                              <p className="opacity-60">{map.type}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => { setShowEditModal(false); setSelectedMatch(null); }}>Cancel</Button>
          <Button onClick={async () => {
            if (!selectedMatch) return;
            try {
              const mapsConfig = formData.mapsAllowedByRound && Object.keys(formData.mapsAllowedByRound).some((k) => (formData.mapsAllowedByRound![k] || []).length > 0)
                ? formData.mapsAllowedByRound : undefined;
              await adminUpdateMatch(token, selectedMatch.id, {
                ...buildMatchPayload(formData),
                mapsAllowedByRound: mapsConfig,
              } as Partial<Match>);
              setShowEditModal(false);
              showNotif("success", "Match updated");
              loadData();
            } catch (err: any) { showNotif("error", err.message); }
          }}>Save Changes</Button>
        </ModalFooter>
      </Modal>

      {/* Round Robin Modal */}
      <Modal isOpen={showRRModal} onClose={() => setShowRRModal(false)}>
        <ModalHeader><ModalTitle>Generate Round Robin Schedule</ModalTitle></ModalHeader>
        <ModalContent>
          <p className="text-muted text-sm mb-4">
            Generates all matches using the circle method — no team plays twice in the same week.
            Type <strong>CONFIRM ROUND ROBIN</strong> to confirm.
          </p>
          <div className="space-y-4">
            <Input label="Best Of (per match)" type="number" value={rrData.bestOf} onChange={(e) => setRrData({ ...rrData, bestOf: parseInt(e.target.value) })} min={1} max={9} />
            <Input label="Confirmation" placeholder="Type CONFIRM ROUND ROBIN" value={rrData.confirmationText} onChange={(e) => setRrData({ ...rrData, confirmationText: e.target.value })} />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowRRModal(false)}>Cancel</Button>
          <Button disabled={rrData.confirmationText !== "CONFIRM ROUND ROBIN"} onClick={async () => {
            if (!tournament) return;
            try {
              await adminGenerateRoundRobin(token, { tournamentId: tournament.id, bestOf: rrData.bestOf, confirmationText: rrData.confirmationText });
              setShowRRModal(false);
              showNotif("success", "Round robin schedule generated");
              loadData();
            } catch (err: any) { showNotif("error", err.message); }
          }}>Generate Schedule</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

// ==================== WEEK MAPS ====================
function WeekMapsSection({ token }: { token: string }) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [maps, setMaps] = useState<AdminGameMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [weekMapsConfig, setWeekMapsConfig] = useState<Record<string, number[]>>({});
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const roundMapTypes: Record<string, string[]> = {
    "1": ["CONTROL"], "2": ["HYBRID"], "3": ["PAYLOAD"], "4": ["PUSH", "FLASHPOINT"], "5": ["CONTROL"],
  };

  const showNotif = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [tour, m, mapList] = await Promise.all([
        getCurrentTournament().catch(() => null),
        getMatches().catch(() => []),
        getMaps().catch(() => []),
      ]);
      setTournament(tour);
      setMatches(m);
      setMaps(mapList);
    } catch { } finally { setLoading(false); }
  }

  // Get unique weeks from matches
  const weeks = [...new Set(
    matches
      .filter((m) => m.type === "ROUNDROBIN" && m.semanas !== null)
      .map((m) => m.semanas as number)
  )].sort((a, b) => a - b);

  function toggleMapForRound(round: string, mapId: number) {
    const current = weekMapsConfig[round] || [];
    const next = current.includes(mapId) ? current.filter((id) => id !== mapId) : [...current, mapId];
    setWeekMapsConfig({ ...weekMapsConfig, [round]: next });
  }

  async function handleSaveWeekMaps() {
    if (!tournament || selectedWeek === null) return;
    setSaving(true);
    try {
      await adminUpdateWeekMaps(token, {
        tournamentId: tournament.id,
        semanas: selectedWeek,
        mapsAllowedByRound: weekMapsConfig,
      });
      showNotif("success", `Maps updated for Week ${selectedWeek}`);
    } catch (err: any) {
      showNotif("error", err.message);
    } finally {
      setSaving(false);
    }
  }

  const hasSelectedMaps = Object.values(weekMapsConfig).some((arr) => arr.length > 0);

  if (loading) return <Card variant="bordered"><CardContent className="p-8 text-center text-muted">Loading...</CardContent></Card>;

  return (
    <div className="space-y-6">
      {notification && <div className={`p-4 rounded-lg border ${notification.type === "success" ? "bg-success/10 text-success border-success/30" : "bg-danger/10 text-danger border-danger/30"}`}>{notification.message}</div>}
      
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Week Map Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          {!tournament ? (
            <p className="text-muted text-center py-4">Create a tournament first.</p>
          ) : weeks.length === 0 ? (
            <p className="text-muted text-center py-4">No round robin matches with weeks found. Generate a round robin schedule first.</p>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted mb-3">Select a week to configure the available maps for all matches in that week:</p>
                <div className="flex flex-wrap gap-2">
                  {weeks.map((week) => (
                    <Button
                      key={week}
                      variant={selectedWeek === week ? "default" : "outline"}
                      onClick={() => {
                        setSelectedWeek(week);
                        // Load existing config for this week from first match
                        const weekMatch = matches.find((m) => m.type === "ROUNDROBIN" && m.semanas === week);
                        setWeekMapsConfig((weekMatch?.mapsAllowedByRound as Record<string, number[]>) || {});
                      }}
                      className="min-w-[80px]"
                    >
                      Week {week}
                    </Button>
                  ))}
                </div>
              </div>

              {selectedWeek !== null && (
                <div className="space-y-4 border-t border-border pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">Week {selectedWeek} Maps</h3>
                    <Button onClick={handleSaveWeekMaps} disabled={saving || !hasSelectedMaps}>
                      {saving ? "Saving..." : "Save Week Maps"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted">Select which maps are available for each game round. These settings will apply to all matches in Week {selectedWeek}.</p>
                  
                  {maps.length === 0 ? (
                    <p className="text-xs text-danger">Map catalog is empty. Add maps first in Overwatch Content.</p>
                  ) : (
                    <div className="space-y-6">
                      {Object.entries(roundMapTypes).map(([round, types]) => {
                        const roundMaps = maps.filter((m) => types.includes(m.type));
                        return (
                          <div key={round} className="bg-surface-elevated/50 rounded-lg p-4">
                            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                              <Badge variant="primary">Game {round}</Badge>
                              <span className="text-muted font-normal">{types.join(" / ")}</span>
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                              {roundMaps.map((map) => {
                                const selected = (weekMapsConfig[round] || []).includes(map.id);
                                return (
                                  <button
                                    key={map.id}
                                    type="button"
                                    onClick={() => toggleMapForRound(round, map.id)}
                                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                                      selected 
                                        ? "border-primary bg-primary/10 ring-2 ring-primary/30" 
                                        : "border-border hover:border-primary/50"
                                    }`}
                                  >
                                    {map.imgPath && (
                                      <div className="aspect-video bg-surface">
                                        <img 
                                          src={resolveMapImageUrl(map.imgPath)}
                                          alt={map.description}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    )}
                                    <div className="p-2 bg-background">
                                      <p className="text-xs font-medium text-foreground truncate">{map.description}</p>
                                      <p className="text-[10px] text-muted">{map.type}</p>
                                    </div>
                                    {selected && (
                                      <div className="absolute top-1 right-1">
                                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                          <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                        </div>
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== TEAMS ====================
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
  const [formData, setFormData] = useState<Partial<CreateTeamPayload>>({ name: "", logo: "", roster: "" });
  const [logoUploading, setLogoUploading] = useState(false);
  const [bulkCount, setBulkCount] = useState<number>(4);
  const [bulkPrefix, setBulkPrefix] = useState<string>("Team");
  const [memberSearch, setMemberSearch] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const showNotif = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [t, tour, m] = await Promise.all([getTeams(), getCurrentTournament().catch(() => null), getMembers()]);
      setTeams(t); setTournament(tour); setMembers(m);
    } catch { } finally { setLoading(false); }
  }

  async function uploadImage(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file); fd.append("type", "logo");
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
      return (await res.json()).url;
    } catch (err: any) { showNotif("error", err.message); return null; }
  }

  const teamMembers = selectedTeam ? members.filter((m) => m.teamId === selectedTeam.id) : [];
  const availableMembers = members.filter((m) => !m.teamId || m.teamId === null)
    .filter((m) => !memberSearch || m.nickname.toLowerCase().includes(memberSearch.toLowerCase()) || m.user.toLowerCase().includes(memberSearch.toLowerCase()));

  if (loading) return <Card variant="bordered"><CardContent className="p-8 text-center text-muted">Loading...</CardContent></Card>;

  return (
    <div className="space-y-6">
      {notification && <div className={`p-4 rounded-lg border ${notification.type === "success" ? "bg-success/10 text-success border-success/30" : "bg-danger/10 text-danger border-danger/30"}`}>{notification.message}</div>}
      <Card variant="bordered">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Teams ({teams.length})</CardTitle>
          <div className="flex items-center gap-2">
            <input type="number" min={1} className="w-20 rounded-md border border-border px-2 py-1 text-sm" value={bulkCount} onChange={(e) => setBulkCount(Number(e.target.value))} />
            <input type="text" className="w-28 rounded-md border border-border px-2 py-1 text-sm" value={bulkPrefix} onChange={(e) => setBulkPrefix(e.target.value)} />
            <Button
              onClick={async () => {
                if (!tournament) return;
                try {
                  const res = await adminCreateTeams(token!, { count: Number(bulkCount), tournamentId: tournament.id, namePrefix: bulkPrefix });
                  showNotif("success", `Created ${res.created} teams`);
                  loadData();
                } catch (err: any) {
                  showNotif("error", err.message || "Failed to create teams");
                }
              }}
              disabled={!tournament || !bulkCount || bulkCount <= 0}
            >
              Create {bulkCount} Teams
            </Button>
            <Button onClick={() => setShowCreateModal(true)} disabled={!tournament}>Create Team</Button>
          </div>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? <p className="text-muted text-center py-4">No teams yet.</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Logo</TableHead><TableHead>Name</TableHead>
                  <TableHead>Members</TableHead><TableHead>Wins</TableHead>
                  <TableHead>Map W</TableHead><TableHead>Map L</TableHead><TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell>
                      {team.logo ? (
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-border">
                          <Image src={team.logo} alt={team.name} fill className="object-cover" unoptimized />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{team.name.charAt(0)}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell><Badge variant="secondary">{members.filter((m) => m.teamId === team.id).length}</Badge></TableCell>
                    <TableCell>{team.victories}</TableCell>
                    <TableCell className="text-success">{team.mapWins}</TableCell>
                    <TableCell className="text-danger">{team.mapLoses}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => { setSelectedTeam(team); setMemberSearch(""); setShowMembersModal(true); }}>Members</Button>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedTeam(team); setFormData({ name: team.name, logo: team.logo || "", roster: team.roster || "", discordRoleId: (team as any).discordRoleId || "" }); setShowEditModal(true); }}>Edit</Button>
                        <Button variant="danger" size="sm" onClick={async () => {
                          if (!confirm("Delete team?")) return;
                          try { await adminDeleteTeam(token, team.id); showNotif("success", "Team deleted"); loadData(); }
                          catch (err: any) { showNotif("error", err.message); }
                        }}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalHeader><ModalTitle>Create Team</ModalTitle></ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <Input label="Team Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Team Logo</label>
              <input ref={logoInputRef} type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                setLogoUploading(true);
                const url = await uploadImage(file);
                if (url) setFormData({ ...formData, logo: url });
                setLogoUploading(false);
              }} className="hidden" />
              <div className="flex items-center gap-4">
                {formData.logo ? (
                  <div className="relative w-16 h-16 rounded overflow-hidden border border-border">
                    <Image src={formData.logo} alt="Logo" fill className="object-cover" unoptimized />
                  </div>
                ) : <div className="w-16 h-16 rounded border-2 border-dashed border-border flex items-center justify-center text-xs text-muted">No logo</div>}
                <Button type="button" variant="secondary" size="sm" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                  {logoUploading ? "Uploading..." : "Upload Logo"}
                </Button>
              </div>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
          <Button onClick={async () => {
            if (!tournament) return;
            try { await adminCreateTeam(token, { ...formData, tournamentId: tournament.id } as CreateTeamPayload); setShowCreateModal(false); showNotif("success", "Team created"); loadData(); }
            catch (err: any) { showNotif("error", err.message); }
          }}>Create Team</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)}>
        <ModalHeader><ModalTitle>Edit Team</ModalTitle></ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <Input label="Team Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            <Input label="Discord Role ID" placeholder="e.g., 1234567890 or <@&1234567890>" value={(formData as any).discordRoleId || ""} onChange={(e) => setFormData({ ...formData, discordRoleId: e.target.value || undefined })} />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => { setShowEditModal(false); setSelectedTeam(null); }}>Cancel</Button>
          <Button onClick={async () => {
            if (!selectedTeam) return;
            try {
              const payload: any = {
                name: formData.name,
                logo: formData.logo,
                roster: formData.roster,
                discordRoleId: (formData as any).discordRoleId === "" ? null : (formData as any).discordRoleId,
              };
              await adminUpdateTeam(token, selectedTeam.id, payload);
              setShowEditModal(false);
              showNotif("success", "Team updated");
              loadData();
            }
            catch (err: any) { showNotif("error", err.message); }
          }}>Save</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={showMembersModal} onClose={() => setShowMembersModal(false)}>
        <ModalHeader><ModalTitle>Members — {selectedTeam?.name}</ModalTitle></ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Current Members ({teamMembers.length})</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {teamMembers.length === 0 ? <p className="text-sm text-muted text-center py-2">No members yet.</p> : teamMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-2 bg-surface rounded border border-border">
                    <div>
                      <p className="font-medium text-sm">{m.nickname}</p>
                      <p className="text-xs text-muted">@{m.user}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{m.role}</Badge>
                      <Button variant="danger" size="sm" onClick={async () => {
                        try { await adminUpdateMember(token, m.id, { teamId: null }); showNotif("success", "Removed"); loadData(); }
                        catch (err: any) { showNotif("error", err.message); }
                      }}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Add Members</h4>
              <Input placeholder="Search..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
              <div className="space-y-2 max-h-40 overflow-y-auto mt-2">
                {availableMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-2 bg-surface rounded border border-border">
                    <div>
                      <p className="font-medium text-sm">{m.nickname}</p>
                      <p className="text-xs text-muted">@{m.user}</p>
                    </div>
                    <Button size="sm" onClick={async () => {
                      if (!selectedTeam) return;
                      try { await adminUpdateMember(token, m.id, { teamId: selectedTeam.id }); showNotif("success", "Added"); loadData(); }
                      catch (err: any) { showNotif("error", err.message); }
                    }}>Add</Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ModalContent>
        <ModalFooter><Button variant="ghost" onClick={() => setShowMembersModal(false)}>Close</Button></ModalFooter>
      </Modal>
    </div>
  );
}

// ==================== USERS ====================
function UsersSection({ token }: { token: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [showDeleteDbModal, setShowDeleteDbModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [bulkScript, setBulkScript] = useState("");
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [wipeLoading, setWipeLoading] = useState(false);
  const [rollbackScript, setRollbackScript] = useState("");
  const [rollbackConfirmationText, setRollbackConfirmationText] = useState("");
  const [wipeConfirmationText, setWipeConfirmationText] = useState("");
  const [formData, setFormData] = useState({ nickname: "", user: "", password: "", role: "DEFAULT", teamId: "" });

  const showNotif = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try { const [m, t] = await Promise.all([getMembers(), getTeams()]); setMembers(m); setTeams(t); }
    catch { } finally { setLoading(false); }
  }

  async function handleBulkImport() {
    if (!bulkScript.trim()) return;
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const result = await adminBulkImportUsers(token, bulkScript);
      setBulkResult(`✅ Created ${result.created} users.${result.errors > 0 ? `\n⚠️ ${result.errors} errors:\n${result.errorDetails.join("\n")}` : ""}`);
      loadData();
    } catch (err: any) {
      setBulkResult(`❌ ${err.message}`);
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleDownloadBackupSql() {
    setBackupLoading(true);
    try {
      const sql = await adminDownloadBackupSql(token);
      const now = new Date();
      const fileName = `db-backup-${now.toISOString().replace(/[:.]/g, "-")}.txt`;
      const blob = new Blob([sql], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotif("success", `Backup exported as ${fileName}`);
    } catch (err: any) {
      showNotif("error", err.message || "Failed to export backup SQL.");
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRollbackRestore() {
    if (!rollbackScript.trim()) {
      showNotif("error", "Paste a backup SQL script first.");
      return;
    }
    setRollbackLoading(true);
    try {
      const result = await adminRestoreBackupSql(token, {
        confirmationText: rollbackConfirmationText,
        script: rollbackScript,
      });
      showNotif("success", `${result.message} (${result.executedStatements} statements)`);
      setShowRollbackModal(false);
      setRollbackScript("");
      setRollbackConfirmationText("");
      loadData();
    } catch (err: any) {
      showNotif("error", err.message || "Failed to restore backup SQL.");
    } finally {
      setRollbackLoading(false);
    }
  }

  async function handleDeleteDatabase() {
    setWipeLoading(true);
    try {
      const result = await adminWipeDatabase(token, {
        confirmationText: wipeConfirmationText,
      });
      showNotif("success", result.message);
      setShowDeleteDbModal(false);
      setWipeConfirmationText("");
      loadData();
    } catch (err: any) {
      showNotif("error", err.message || "Failed to delete database.");
    } finally {
      setWipeLoading(false);
    }
  }

  const getTeamName = (teamId: number | null) => teamId ? teams.find((t) => t.id === teamId)?.name || "Unknown" : "No Team";

  if (loading) return <Card variant="bordered"><CardContent className="p-8 text-center text-muted">Loading...</CardContent></Card>;

  // Sort members: those with no team first, then grouped by team name, then by nickname
  const sortedMembers = [...members].sort((a, b) => {
    const aNoTeam = a.teamId === null || a.teamId === undefined;
    const bNoTeam = b.teamId === null || b.teamId === undefined;
    if (aNoTeam !== bNoTeam) return aNoTeam ? -1 : 1;
    if (a.teamId === b.teamId) return a.nickname.localeCompare(b.nickname);
    const aTeamName = teams.find((t) => t.id === a.teamId)?.name || "";
    const bTeamName = teams.find((t) => t.id === b.teamId)?.name || "";
    return aTeamName.localeCompare(bTeamName);
  });

  return (
    <div className="space-y-6">
      {notification && <div className={`p-4 rounded-lg border ${notification.type === "success" ? "bg-success/10 text-success border-success/30" : "bg-danger/10 text-danger border-danger/30"}`}>{notification.message}</div>}
      <Card variant="bordered">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Users ({members.length})</CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleDownloadBackupSql} disabled={backupLoading}>
              {backupLoading ? "Exporting..." : "Download Rollback SQL"}
            </Button>
            <Button variant="danger" onClick={() => setShowRollbackModal(true)}>
              Restore From SQL
            </Button>
            <Button variant="danger" onClick={() => setShowDeleteDbModal(true)}>
              Delete Database
            </Button>
            <Button variant="secondary" onClick={() => { setBulkScript(""); setBulkResult(null); setShowBulkModal(true); }}>Run Script (Bulk Import)</Button>
            <Button onClick={() => setShowCreateModal(true)}>Register User</Button>
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? <p className="text-muted text-center py-4">No users yet.</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nickname</TableHead><TableHead>Username</TableHead>
                  <TableHead>Role</TableHead><TableHead>Team</TableHead><TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMembers.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nickname}</TableCell>
                    <TableCell className="text-muted">{m.user}</TableCell>
                    <TableCell>
                      <Badge variant={m.role === "ADMIN" ? "danger" : m.role === "MANAGER" ? "warning" : m.role === "CAPTAIN" ? "success" : "default"}>
                        {m.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{getTeamName(m.teamId)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setSelectedMember(m);
                        setFormData({ nickname: m.nickname, user: m.user, password: "", role: m.role, teamId: m.teamId?.toString() || "" });
                        setShowEditModal(true);
                      }}>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Bulk Import Modal */}
      <Modal isOpen={showBulkModal} onClose={() => setShowBulkModal(false)}>
        <ModalHeader><ModalTitle>Run Script — Bulk User Import</ModalTitle></ModalHeader>
        <ModalContent>
          <p className="text-sm text-muted mb-3">
            Enter one user per line in this format:<br />
            <code className="font-mono bg-surface px-2 py-1 rounded text-xs">NICKNAME USUARIO CONTRASEÑA TEAMID</code>
          </p>
          <textarea
            className="w-full h-48 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm resize-none"
            placeholder={"PLAYER1 user1 pass123 1\nPLAYER2 user2 pass456 2"}
            value={bulkScript}
            onChange={(e) => setBulkScript(e.target.value)}
          />
          {bulkResult && (
            <pre className="mt-3 p-3 rounded bg-surface border border-border text-xs whitespace-pre-wrap text-foreground">{bulkResult}</pre>
          )}
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowBulkModal(false)}>Close</Button>
          <Button onClick={handleBulkImport} disabled={bulkLoading || !bulkScript.trim()}>
            {bulkLoading ? "Importing..." : "Run Import"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Rollback Restore Modal */}
      <Modal isOpen={showRollbackModal} onClose={() => setShowRollbackModal(false)}>
        <ModalHeader><ModalTitle>Restore Database From Backup SQL</ModalTitle></ModalHeader>
        <ModalContent>
          <p className="text-sm text-muted mb-3">
            Paste the full SQL backup text that you downloaded before. This will overwrite current database data.
          </p>
          <textarea
            className="w-full h-56 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs resize-none"
            placeholder="Paste backup SQL content here..."
            value={rollbackScript}
            onChange={(e) => setRollbackScript(e.target.value)}
          />
          <Input
            label="Confirmation"
            placeholder="Type RESTORE DATABASE"
            value={rollbackConfirmationText}
            onChange={(e) => setRollbackConfirmationText(e.target.value)}
          />
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowRollbackModal(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={handleRollbackRestore}
            disabled={rollbackLoading || !rollbackScript.trim() || rollbackConfirmationText !== "RESTORE DATABASE"}
          >
            {rollbackLoading ? "Restoring..." : "Restore Database"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={showDeleteDbModal} onClose={() => setShowDeleteDbModal(false)}>
        <ModalHeader><ModalTitle>Delete Database</ModalTitle></ModalHeader>
        <ModalContent>
          <p className="text-sm text-muted mb-3">
            This will permanently delete tournament/runtime data and reset IDs. Maps and heroes are preserved. Type DELETE DATABASE to confirm.
          </p>
          <Input
            label="Confirmation"
            placeholder="Type DELETE DATABASE"
            value={wipeConfirmationText}
            onChange={(e) => setWipeConfirmationText(e.target.value)}
          />
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowDeleteDbModal(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={handleDeleteDatabase}
            disabled={wipeLoading || wipeConfirmationText !== "DELETE DATABASE"}
          >
            {wipeLoading ? "Deleting..." : "Delete Database"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalHeader><ModalTitle>Register User</ModalTitle></ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <Input label="Nickname" value={formData.nickname} onChange={(e) => setFormData({ ...formData, nickname: e.target.value })} />
            <Input label="Username" value={formData.user} onChange={(e) => setFormData({ ...formData, user: e.target.value })} />
            <Input label="Password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
            <Select label="Role" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              options={["DEFAULT", "CAPTAIN", "MANAGER", "EDITOR", "ADMIN"].map((v) => ({ value: v, label: v }))}
            />
            <Select label="Team (optional)" value={formData.teamId} onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
              options={[{ value: "", label: "No Team" }, ...teams.map((t) => ({ value: t.id.toString(), label: t.name }))]}
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
          <Button onClick={async () => {
            try {
              await adminRegisterMember(token, { nickname: formData.nickname, user: formData.user, password: formData.password, role: formData.role, teamId: formData.teamId ? parseInt(formData.teamId) : undefined });
              setShowCreateModal(false);
              showNotif("success", "User created");
              loadData();
            } catch (err: any) { showNotif("error", err.message); }
          }}>Register</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)}>
        <ModalHeader><ModalTitle>Edit User</ModalTitle></ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <Input label="Nickname" value={formData.nickname} onChange={(e) => setFormData({ ...formData, nickname: e.target.value })} />
            <Select label="Role" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              options={["DEFAULT", "CAPTAIN", "MANAGER", "EDITOR", "ADMIN"].map((v) => ({ value: v, label: v }))}
            />
            <Select label="Team" value={formData.teamId} onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
              options={[{ value: "", label: "No Team" }, ...teams.map((t) => ({ value: t.id.toString(), label: t.name }))]}
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => { setShowEditModal(false); setSelectedMember(null); }}>Cancel</Button>
          <Button onClick={async () => {
            if (!selectedMember) return;
            try {
              await adminUpdateMember(token, selectedMember.id, { nickname: formData.nickname, role: formData.role as Member["role"], teamId: formData.teamId ? parseInt(formData.teamId) : null });
              setShowEditModal(false);
              showNotif("success", "User updated");
              loadData();
            } catch (err: any) { showNotif("error", err.message); }
          }}>Save</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
