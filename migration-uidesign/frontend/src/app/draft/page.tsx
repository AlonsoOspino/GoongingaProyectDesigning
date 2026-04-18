"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "@/features/session/SessionProvider";
import { useDraftPolling } from "@/hooks/useDraftPolling";
import { getMatches } from "@/lib/api/match";
import { getTeams } from "@/lib/api/team";
import { pickMap, banHero } from "@/lib/api/draft";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { DraftTimer } from "@/components/draft/DraftTimer";
import { DraftBoard } from "@/components/draft/DraftBoard";
import { MapPicker } from "@/components/draft/MapPicker";
import { HeroBanner } from "@/components/draft/HeroBanner";
import type { Match, Team } from "@/lib/api/types";

interface ActiveDraft {
  matchId: number;
  draftId: number;
}

export default function DraftPage() {
  const { user, token, isHydrated } = useSession();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeDraft, setActiveDraft] = useState<ActiveDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const { draftState, timeRemaining, refetch } = useDraftPolling({
    draftId: activeDraft?.draftId ?? null,
    pollInterval: 3000,
    enabled: !!activeDraft,
  });

  // Fetch matches and teams
  useEffect(() => {
    async function fetchData() {
      try {
        const [matchesData, teamsData] = await Promise.all([
          getMatches(),
          getTeams(),
        ]);
        setMatches(matchesData);
        setTeams(teamsData);

        // Find active match for drafting
        const activeMatch = matchesData.find(
          (m) => m.status === "ACTIVE" || m.status === "PENDINGREGISTERS"
        );
        if (activeMatch) {
          // In a real app, you'd get the draft ID from the match or a separate endpoint
          setActiveDraft({ matchId: activeMatch.id, draftId: activeMatch.id });
        }
      } catch (error) {
        console.error("Failed to fetch draft data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (isHydrated) {
      fetchData();
    }
  }, [isHydrated]);

  const teamsById = new Map(teams.map((t) => [t.id, t]));

  const handlePickMap = async (mapId: number) => {
    if (!token || !activeDraft || !draftState) return;

    setActionLoading(true);
    try {
      await pickMap(token, activeDraft.draftId, {
        mapId,
        teamId: user?.teamId ?? undefined,
      });
      await refetch();
    } catch (error) {
      console.error("Failed to pick map:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBanHero = async (heroId: number | null) => {
    if (!token || !activeDraft || !draftState) return;

    setActionLoading(true);
    try {
      await banHero(token, activeDraft.draftId, {
        heroId,
        teamId: user?.teamId ?? undefined,
      });
      await refetch();
    } catch (error) {
      console.error("Failed to ban hero:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const isMyTurn =
    draftState &&
    user?.teamId &&
    draftState.currentTurnTeamId === user.teamId;

  const currentTeamName =
    draftState?.currentTurnTeamId
      ? teamsById.get(draftState.currentTurnTeamId)?.name
      : undefined;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-64" variant="text" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Draft Room</h1>
        <p className="text-muted">
          Pick maps and ban heroes for your upcoming matches
        </p>
      </div>

      {draftState && activeDraft ? (
        <div className="space-y-6">
          {/* Match Info & Timer */}
          <Card variant="bordered">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                {/* Team A */}
                <div className="flex items-center gap-4">
                  <Avatar
                    size="lg"
                    src={teamsById.get(draftState.match.teamAId)?.logo || undefined}
                    fallback={teamsById.get(draftState.match.teamAId)?.name || "A"}
                  />
                  <div>
                    <p className="font-semibold text-foreground">
                      {teamsById.get(draftState.match.teamAId)?.name || `Team ${draftState.match.teamAId}`}
                    </p>
                    {draftState.match.teamAready ? (
                      <Badge variant="success">Ready</Badge>
                    ) : (
                      <Badge variant="default">Not Ready</Badge>
                    )}
                  </div>
                </div>

                {/* Timer */}
                <DraftTimer
                  timeRemaining={timeRemaining}
                  phase={draftState.phase}
                  currentTeam={currentTeamName}
                />

                {/* Team B */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-foreground">
                      {teamsById.get(draftState.match.teamBId)?.name || `Team ${draftState.match.teamBId}`}
                    </p>
                    {draftState.match.teamBready ? (
                      <Badge variant="success">Ready</Badge>
                    ) : (
                      <Badge variant="default">Not Ready</Badge>
                    )}
                  </div>
                  <Avatar
                    size="lg"
                    src={teamsById.get(draftState.match.teamBId)?.logo || undefined}
                    fallback={teamsById.get(draftState.match.teamBId)?.name || "B"}
                  />
                </div>
              </div>

              {/* Turn Indicator */}
              {isMyTurn && (
                <div className="mt-4 p-3 bg-primary/10 border border-primary/30 rounded-lg text-center">
                  <p className="text-primary font-medium">
                    It&apos;s your turn to {draftState.phase.includes("BAN") ? "ban" : "pick"}!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Draft Content */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Map Picker / Hero Banner */}
            <div className="lg:col-span-2">
              {draftState.phase.includes("MAP") && draftState.availableMaps ? (
                <MapPicker
                  availableMaps={draftState.availableMaps}
                  pickedMapIds={draftState.pickedMaps}
                  allowedTypes={draftState.allowedMapTypes}
                  onSelectMap={handlePickMap}
                  disabled={actionLoading || !isMyTurn}
                  isMyTurn={isMyTurn ?? false}
                />
              ) : draftState.phase.includes("BAN") && draftState.heroes ? (
                <HeroBanner
                  heroes={draftState.heroes}
                  bannedHeroIds={draftState.bannedHeroes}
                  onSelectHero={(heroId) => handleBanHero(heroId)}
                  onSkip={() => handleBanHero(null)}
                  disabled={actionLoading || !isMyTurn}
                  isMyTurn={isMyTurn ?? false}
                />
              ) : (
                <Card variant="bordered" className="h-full">
                  <CardContent className="flex items-center justify-center h-64">
                    <p className="text-muted">
                      {draftState.phase === "IDLE"
                        ? "Draft has not started yet"
                        : draftState.phase === "FINISHED"
                        ? "Draft is complete"
                        : "Waiting for phase..."}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Draft Board */}
            <DraftBoard
              actions={draftState.actions}
              teamA={teamsById.get(draftState.match.teamAId)}
              teamB={teamsById.get(draftState.match.teamBId)}
              heroes={draftState.heroes}
              maps={draftState.allMaps}
            />
          </div>
        </div>
      ) : (
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                No Active Draft
              </h2>
              <p className="text-muted mb-6">
                There are no active drafts at the moment. Check back when a match is starting.
              </p>
              <Link href="/schedule">
                <Button>View Schedule</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Matches with Drafts */}
      {matches.filter((m) => m.status === "SCHEDULED").length > 0 && (
        <Card variant="bordered" className="mt-8">
          <CardHeader>
            <CardTitle>Upcoming Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {matches
                .filter((m) => m.status === "SCHEDULED")
                .slice(0, 6)
                .map((match) => (
                  <div
                    key={match.id}
                    className="p-4 rounded-lg border border-border hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="default">{match.type}</Badge>
                      <span className="text-xs text-muted">BO{match.bestOf}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar
                          size="sm"
                          fallback={teamsById.get(match.teamAId)?.name || "A"}
                        />
                        <span className="text-sm font-medium text-foreground truncate max-w-[80px]">
                          {teamsById.get(match.teamAId)?.name || `Team ${match.teamAId}`}
                        </span>
                      </div>
                      <span className="text-muted text-sm">vs</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate max-w-[80px]">
                          {teamsById.get(match.teamBId)?.name || `Team ${match.teamBId}`}
                        </span>
                        <Avatar
                          size="sm"
                          fallback={teamsById.get(match.teamBId)?.name || "B"}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted mt-3">
                      {new Date(match.startDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
