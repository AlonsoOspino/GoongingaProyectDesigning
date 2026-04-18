"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "@/features/session/SessionProvider";
import { getTeams, updateCaptainTeam } from "@/lib/api/team";
import { getMatches } from "@/lib/api/match";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { MatchCard } from "@/components/matches/MatchCard";
import type { Team, Match } from "@/lib/api/types";

export default function MyTeamPage() {
  const { user, token, isAuthenticated, isHydrated } = useSession();
  const [team, setTeam] = useState<Team | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", logo: "", roster: "" });

  useEffect(() => {
    async function fetchData() {
      if (!isAuthenticated || !user?.teamId) {
        setLoading(false);
        return;
      }

      try {
        const [teamsData, matchesData] = await Promise.all([
          getTeams(),
          getMatches().catch(() => [] as Match[]),
        ]);

        setTeams(teamsData);

        const myTeam = teamsData.find((t) => t.id === user.teamId);
        if (myTeam) {
          setTeam(myTeam);
          setEditForm({
            name: myTeam.name,
            logo: myTeam.logo || "",
            roster: myTeam.roster || "",
          });
        }

        // Filter matches for my team
        const myMatches = matchesData.filter(
          (m) => m.teamAId === user.teamId || m.teamBId === user.teamId
        );
        setMatches(myMatches);
      } catch (error) {
        console.error("Failed to fetch team data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (isHydrated) {
      fetchData();
    }
  }, [isAuthenticated, user, isHydrated]);

  const handleEditSubmit = async () => {
    if (!token || !team) return;

    setEditLoading(true);
    try {
      const updatedTeam = await updateCaptainTeam(token, team.id, {
        name: editForm.name || undefined,
        logo: editForm.logo || undefined,
        roster: editForm.roster || undefined,
      });
      setTeam(updatedTeam);
      setEditModalOpen(false);
    } catch (error) {
      console.error("Failed to update team:", error);
    } finally {
      setEditLoading(false);
    }
  };

  const teamsById = new Map(teams.map((t) => [t.id, t]));

  const upcomingMatches = matches
    .filter((m) => m.status === "SCHEDULED" || m.status === "ACTIVE")
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5);

  const recentMatches = matches
    .filter((m) => m.status === "FINISHED")
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 5);

  if (!isHydrated || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-64" variant="text" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card variant="bordered">
          <CardContent className="py-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Sign In Required
              </h2>
              <p className="text-muted mb-6">
                You need to sign in to view and manage your team.
              </p>
              <Link href="/login">
                <Button>Sign In</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card variant="bordered">
          <CardContent className="py-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                No Team Assigned
              </h2>
              <p className="text-muted mb-6">
                You are not currently assigned to any team. Contact a league administrator to join a team.
              </p>
              <Link href="/teams">
                <Button variant="outline">Browse Teams</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mapDiff = team.mapWins - team.mapLoses;
  const winRate =
    team.mapWins + team.mapLoses > 0
      ? Math.round((team.mapWins / (team.mapWins + team.mapLoses)) * 100)
      : 0;

  const canEdit = user?.role === "CAPTAIN" || user?.role === "MANAGER" || user?.role === "ADMIN";

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">My Team</h1>
        <p className="text-muted">
          Manage your team and view upcoming matches
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Team Info Card */}
        <Card variant="bordered">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar
                size="xl"
                src={team.logo || undefined}
                fallback={team.name}
                className="w-24 h-24 text-2xl mb-4"
              />
              <h2 className="text-xl font-bold text-foreground mb-1">{team.name}</h2>
              <p className="text-sm text-muted mb-4">Tournament #{team.tournamentId}</p>

              <div className="flex items-center gap-3 mb-6">
                <Badge variant={mapDiff >= 0 ? "success" : "danger"}>
                  {mapDiff > 0 ? "+" : ""}{mapDiff} Map Diff
                </Badge>
                <Badge variant="primary">{winRate}% Win Rate</Badge>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 w-full pt-4 border-t border-border">
                <div className="text-center">
                  <p className="text-2xl font-bold text-success font-mono">{team.victories}</p>
                  <p className="text-xs text-muted">Victories</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary font-mono">{team.mapWins}</p>
                  <p className="text-xs text-muted">Maps Won</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-danger font-mono">{team.mapLoses}</p>
                  <p className="text-xs text-muted">Maps Lost</p>
                </div>
              </div>
            </div>
          </CardContent>
          {canEdit && (
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setEditModalOpen(true)}
              >
                Edit Team
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* Matches */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming */}
          <Card variant="bordered">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Upcoming Matches</CardTitle>
              <Link href="/schedule">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingMatches.length > 0 ? (
                upcomingMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    teamA={teamsById.get(match.teamAId)}
                    teamB={teamsById.get(match.teamBId)}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-muted">
                  <p>No upcoming matches</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent */}
          {recentMatches.length > 0 && (
            <Card variant="bordered">
              <CardHeader>
                <CardTitle>Recent Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    teamA={teamsById.get(match.teamAId)}
                    teamB={teamsById.get(match.teamBId)}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Roster Section */}
      {team.roster && (
        <Card variant="bordered" className="mt-8">
          <CardHeader>
            <CardTitle>Roster</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted whitespace-pre-wrap">{team.roster}</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Team"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleEditSubmit();
          }}
          className="space-y-4"
        >
          <Input
            label="Team Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            placeholder="Enter team name"
          />
          <Input
            label="Logo URL"
            value={editForm.logo}
            onChange={(e) => setEditForm({ ...editForm, logo: e.target.value })}
            placeholder="https://example.com/logo.png"
          />
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Roster
            </label>
            <textarea
              value={editForm.roster}
              onChange={(e) => setEditForm({ ...editForm, roster: e.target.value })}
              placeholder="List your team members..."
              className="w-full px-3 py-2 bg-input border border-input-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[120px] resize-y"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={editLoading}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
