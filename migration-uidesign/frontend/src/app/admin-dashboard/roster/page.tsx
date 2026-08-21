"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Crown, Trash2, UserPlus, UsersRound } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { readNetworkSessionToken } from "@/features/networkSession/storage";
import { getCurrentNetworkMember } from "@/lib/api/networkMember";
import {
  getSeasonRoster,
  getSeasonRosterTournaments,
  removeSeasonRosterMember,
  updateSeasonRosterMember,
  type SeasonRole,
  type SeasonRoster,
} from "@/lib/api/seasonRoster";
import type { Tournament } from "@/lib/api/types";

const phaseLabels: Record<Tournament["state"], string> = {
  SCHEDULED: "Scheduled",
  ROUNDROBIN: "Round Robin",
  PLAYOFFS: "Play-Ins / Play-Offs",
  SEMIFINALS: "Semifinals",
  FINALS: "Grand Finals",
  FINISHED: "Finished",
};

function memberName(member: { nickname: string | null; username: string }) {
  return member.nickname || member.username;
}

export default function SeasonRosterPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [tournaments, setTournaments] = useState<Array<Pick<Tournament, "id" | "name" | "startDate" | "state">>>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [roster, setRoster] = useState<SeasonRoster | null>(null);
  const [pendingTeams, setPendingTeams] = useState<Record<number, string>>({});
  const [savingMemberId, setSavingMemberId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRoster = useCallback(async (sessionToken: string, tournamentId: number) => {
    const nextRoster = await getSeasonRoster(sessionToken, tournamentId);
    setRoster(nextRoster);
    setPendingTeams((current) => {
      const next = { ...current };
      const defaultTeamId = nextRoster.teams[0]?.id;
      for (const member of nextRoster.unassigned) {
        if (!next[member.id] && defaultTeamId) next[member.id] = String(defaultTeamId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const sessionToken = readNetworkSessionToken();
    if (!sessionToken) {
      router.replace("/login?next=/admin-dashboard/roster");
      return;
    }
    setToken(sessionToken);
    Promise.all([getCurrentNetworkMember(sessionToken), getSeasonRosterTournaments(sessionToken)])
      .then(async ([member, seasons]) => {
        if (!member.roles.includes("ADMIN")) {
          router.replace("/admin-dashboard");
          return;
        }
        setTournaments(seasons);
        const initial = seasons.find((season) => season.state !== "FINISHED") || seasons[0];
        if (initial) {
          setSelectedTournamentId(initial.id);
          await loadRoster(sessionToken, initial.id);
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load the season roster."));
  }, [loadRoster, router]);

  const teamOptions = useMemo(
    () => (roster?.teams || []).map((team) => ({ value: String(team.id), label: team.name })),
    [roster]
  );

  const changeSeason = async (value: string) => {
    const tournamentId = Number(value);
    if (!token || !Number.isInteger(tournamentId)) return;
    setSelectedTournamentId(tournamentId);
    setError(null);
    setNotice(null);
    try {
      await loadRoster(token, tournamentId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load the selected season.");
    }
  };

  const saveMember = async (memberId: number, teamId: number | null, role: SeasonRole) => {
    if (!token || !selectedTournamentId) return;
    setSavingMemberId(memberId);
    setError(null);
    setNotice(null);
    try {
      const result = await updateSeasonRosterMember(token, selectedTournamentId, memberId, { teamId, role });
      if (result.demoted) {
        setNotice(`${result.demoted.username} was changed to Player when the new captain was assigned.`);
      }
      await loadRoster(token, selectedTournamentId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update this player.");
    } finally {
      setSavingMemberId(null);
    }
  };

  const removeMember = async (memberId: number) => {
    if (!token || !selectedTournamentId) return;
    setSavingMemberId(memberId);
    setError(null);
    setNotice(null);
    try {
      await removeSeasonRosterMember(token, selectedTournamentId, memberId);
      await loadRoster(token, selectedTournamentId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to remove this player.");
    } finally {
      setSavingMemberId(null);
    }
  };

  return (
    <main className="ow-section">
      <div className="ow-container">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/admin-dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-text-primary">
              <ArrowLeft size={16} />
              Network Members
            </Link>
            <h1 className="font-display text-6xl uppercase">Season Roster</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Assign the temporary teams and captain permissions used by the active GGL season.
            </p>
          </div>
          <div className="w-full lg:w-80">
            <Select
              label="Season"
              value={selectedTournamentId ? String(selectedTournamentId) : ""}
              options={tournaments.map((season) => ({
                value: String(season.id),
                label: `${season.name} — ${phaseLabels[season.state]}`,
              }))}
              onChange={(event) => void changeSeason(event.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-sm border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-5 rounded-sm border border-brand-bright/30 bg-brand-bright/10 p-3 text-sm text-text-primary">
            {notice}
          </div>
        )}

        {!roster && !error && (
          <div className="rounded-sm border border-border bg-surface-1 p-8 text-sm text-muted">
            Loading season roster…
          </div>
        )}

        {roster && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4">
            {roster.teams.map((team) => {
              const players = roster.assigned.filter((player) => player.teamId === team.id);
              return (
                <section key={team.id} className="rounded-sm border border-border bg-surface-1 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
                    <div>
                      <h2 className="font-display text-2xl uppercase">{team.name}</h2>
                      <p className="text-xs text-muted">{players.length} assigned</p>
                    </div>
                    <UsersRound size={20} className="text-muted" />
                  </div>
                  <div className="space-y-3">
                    {players.map((player) => (
                      <article key={player.id} className="rounded-sm border border-border bg-surface-inset p-3">
                        <div className="mb-3 flex items-center gap-3">
                          <Avatar
                            size="sm"
                            src={player.member.avatarUrl || undefined}
                            fallback={memberName(player.member)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-text-primary">{memberName(player.member)}</p>
                            <p className="flex items-center gap-1 text-xs text-muted">
                              {player.role === "CAPTAIN" && (
                                <Crown size={12} />
                              )}
                              {player.role === "CAPTAIN" ? "Captain" : "Player"}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Select
                            aria-label={`Team for ${memberName(player.member)}`}
                            value={String(player.teamId || "")}
                            options={teamOptions}
                            disabled={savingMemberId === player.memberId}
                            onChange={(event) => void saveMember(player.memberId, Number(event.target.value), player.role)}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={player.role === "CAPTAIN" ? "secondary" : "outline"}
                              className="flex-1"
                              disabled={savingMemberId === player.memberId}
                              onClick={() => void saveMember(player.memberId, player.teamId, player.role === "CAPTAIN" ? "PLAYER" : "CAPTAIN")}
                            >
                              <Crown size={14} />
                              {player.role === "CAPTAIN" ? "Set player" : "Set captain"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Remove ${memberName(player.member)} from season`}
                              disabled={savingMemberId === player.memberId}
                              onClick={() => void removeMember(player.memberId)}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))}
                    {!players.length && (
                      <p className="py-4 text-center text-sm text-muted">No players assigned.</p>
                    )}
                  </div>
                </section>
              );
            })}

            <section className="rounded-sm border border-border bg-surface-1 p-4">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <h2 className="font-display text-2xl uppercase">Unassigned</h2>
                  <p className="text-xs text-muted">{roster.unassigned.length} available</p>
                </div>
                <UserPlus size={20} className="text-muted" />
              </div>
              <div className="space-y-3">
                {roster.unassigned.map((member) => (
                  <article key={member.id} className="rounded-sm border border-border bg-surface-inset p-3">
                    <div className="mb-3 flex items-center gap-3">
                      <Avatar
                        size="sm"
                        src={member.avatarUrl || undefined}
                        fallback={memberName(member)}
                      />
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{memberName(member)}</p>
                    </div>
                    <div className="space-y-2">
                      <Select
                        aria-label={`Team for ${memberName(member)}`}
                        value={pendingTeams[member.id] || ""}
                        options={teamOptions}
                        disabled={!teamOptions.length || savingMemberId === member.id}
                        onChange={(event) => setPendingTeams((current) => ({ ...current, [member.id]: event.target.value }))}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={!pendingTeams[member.id] || savingMemberId === member.id}
                        onClick={() => void saveMember(member.id, Number(pendingTeams[member.id]), "PLAYER")}
                      >
                        <UserPlus size={14} />
                        Assign player
                      </Button>
                    </div>
                  </article>
                ))}
                {!roster.unassigned.length && (
                  <p className="py-4 text-center text-sm text-muted">Every active member is assigned.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
