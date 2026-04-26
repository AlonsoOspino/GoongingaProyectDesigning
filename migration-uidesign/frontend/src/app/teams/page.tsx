"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import { getTeams } from "@/lib/api/team";
import { getMembers, type Member } from "@/lib/api/admin";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Team } from "@/lib/api/types";

// Role colors for badges
const ROLE_COLORS: Record<string, string> = {
  Tank: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DPS: "bg-red-500/20 text-red-400 border-red-500/30",
  Support: "bg-green-500/20 text-green-400 border-green-500/30",
};

// Role icons
const ROLE_ICONS: Record<string, React.ReactNode> = {
  Tank: (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L10 6.477l-3.763 1.105 1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
  ),
  DPS: (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 2a1 1 0 00-.894.553L7.382 6H4a1 1 0 000 2v8a2 2 0 002 2h8a2 2 0 002-2V8a1 1 0 100-2h-3.382l-1.724-3.447A1 1 0 0010 2zm0 4l1 2H9l1-2z" />
    </svg>
  ),
  Support: (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
    </svg>
  ),
};

export default function TeamsPage() {
  const [viewMode, setViewMode] = useState<"grid" | "cascade">("cascade");
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);

  const { data: teams, isLoading: teamsLoading } = useSWR<Team[]>("teams", getTeams);
  const { data: members, isLoading: membersLoading } = useSWR<Member[]>("members", getMembers);

  const isLoading = teamsLoading || membersLoading;

  // Sort teams by victories
  const sortedTeams = useMemo(() => {
    if (!teams) return [];
    return [...teams].sort((a, b) => b.victories - a.victories);
  }, [teams]);

  // Group members by team
  const membersByTeam = useMemo(() => {
    if (!members) return {};
    return members.reduce((acc, member) => {
      if (member.teamId) {
        if (!acc[member.teamId]) acc[member.teamId] = [];
        acc[member.teamId].push(member);
      }
      return acc;
    }, {} as Record<number, Member[]>);
  }, [members]);

  // Get team stats summary
  const getTeamStats = (teamId: number) => {
    const teamMembers = membersByTeam[teamId] || [];
    const roles = teamMembers.reduce((acc, m) => {
      if (m.role) acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { memberCount: teamMembers.length, roles };
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-success/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1 h-8 bg-gradient-to-b from-success to-primary rounded-full" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Season 2024
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-3">
            Team Directory
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Explore all competing teams, their rosters, and player statistics
          </p>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-card/50 border border-border/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-foreground">{sortedTeams.length}</div>
            <div className="text-xs text-muted-foreground">Total Teams</div>
          </div>
          <div className="bg-card/50 border border-border/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-foreground">{members?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Active Players</div>
          </div>
          <div className="bg-card/50 border border-border/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-success">
              {sortedTeams.length > 0 ? sortedTeams[0]?.name.split(" ")[0] : "-"}
            </div>
            <div className="text-xs text-muted-foreground">Top Team</div>
          </div>
          <div className="bg-card/50 border border-border/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-accent">
              {sortedTeams.reduce((sum, t) => sum + t.victories, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Total Matches</div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">View:</span>
            <div className="flex bg-card/50 border border-border/50 rounded-lg p-1">
              <button
                onClick={() => setViewMode("cascade")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === "cascade"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Cascade
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Grid
              </button>
            </div>
          </div>

          <Link href="/stats">
            <Button variant="outline" size="sm">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View All Stats
            </Button>
          </Link>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card/50 border border-border/50 rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Skeleton className="w-16 h-16 rounded-xl" />
                  <div>
                    <Skeleton className="w-40 h-6 mb-2" />
                    <Skeleton className="w-24 h-4" />
                  </div>
                </div>
                <Skeleton className="w-full h-48 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* Cascade View */}
        {!isLoading && viewMode === "cascade" && (
          <div className="space-y-6">
            {sortedTeams.map((team, index) => {
              const teamStats = getTeamStats(team.id);
              const teamMembers = membersByTeam[team.id] || [];
              const isExpanded = selectedTeam === team.id;
              const mapDiff = team.mapWins - team.mapLoses;
              const winRate = team.mapWins + team.mapLoses > 0
                ? Math.round((team.mapWins / (team.mapWins + team.mapLoses)) * 100)
                : 0;

              return (
                <div
                  key={team.id}
                  className="group relative bg-card/50 border border-border/50 rounded-2xl overflow-hidden transition-all duration-300 hover:border-primary/30"
                  style={{ 
                    transform: `translateX(${index % 2 === 0 ? 0 : 20}px)`,
                  }}
                >
                  {/* Team Header */}
                  <div 
                    className="p-6 cursor-pointer"
                    onClick={() => setSelectedTeam(isExpanded ? null : team.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        {/* Rank Badge */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                          index === 0 ? "bg-yellow-500/20 text-yellow-400" :
                          index === 1 ? "bg-gray-400/20 text-gray-300" :
                          index === 2 ? "bg-orange-500/20 text-orange-400" :
                          "bg-muted/50 text-muted-foreground"
                        }`}>
                          #{index + 1}
                        </div>

                        {/* Team Logo */}
                        <div className="relative w-14 h-14 rounded-xl bg-card border border-border/50 overflow-hidden flex items-center justify-center">
                          {team.logo ? (
                            <Image
                              src={team.logo}
                              alt={team.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <span className="text-xl font-bold text-primary">
                              {team.name.charAt(0)}
                            </span>
                          )}
                        </div>

                        <div>
                          <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                            {team.name}
                          </h2>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-muted-foreground">
                              {teamStats.memberCount} players
                            </span>
                            <div className="flex items-center gap-1">
                              {Object.entries(teamStats.roles).map(([role, count]) => (
                                <span
                                  key={role}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${ROLE_COLORS[role] || "bg-muted text-muted-foreground border-border"}`}
                                >
                                  {ROLE_ICONS[role]}
                                  {count}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Quick Stats */}
                        <div className="hidden sm:flex items-center gap-4 text-center">
                          <div>
                            <div className="text-lg font-bold text-success">{team.victories}</div>
                            <div className="text-xs text-muted-foreground">Wins</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-foreground">{team.mapWins}-{team.mapLoses}</div>
                            <div className="text-xs text-muted-foreground">Maps</div>
                          </div>
                          <div>
                            <Badge variant={mapDiff > 0 ? "success" : mapDiff < 0 ? "danger" : "default"}>
                              {mapDiff > 0 ? "+" : ""}{mapDiff}
                            </Badge>
                          </div>
                        </div>

                        <Link 
                          href={`/teams/${team.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
                        >
                          Profile
                        </Link>
                        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                          <svg 
                            className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Roster Image Background */}
                  {team.roster && (
                    <div className="relative h-52 overflow-hidden">
                      <Image
                        src={team.roster}
                        alt={`${team.name} roster`}
                        fill
                        className="object-cover opacity-70 group-hover:opacity-90 transition-opacity duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
                      
                      {/* Player Avatars Overlay */}
                      <div className="absolute bottom-4 left-6 right-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex -space-x-3">
                              {teamMembers.slice(0, 5).map((member, i) => (
                                <Link
                                  key={member.id}
                                  href={`/stats/${member.id}`}
                                  className="relative group/avatar"
                                  style={{ zIndex: 5 - i }}
                                >
                                  <div className="w-12 h-12 rounded-full border-2 border-card bg-card overflow-hidden hover:scale-110 hover:z-10 transition-transform">
                                    {member.profilePic ? (
                                      <Image
                                        src={member.profilePic}
                                        alt={member.nickname}
                                        fill
                                        className="object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                                        <span className="text-sm font-bold text-primary">
                                          {member.nickname.charAt(0)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  {/* Tooltip */}
                                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-card border border-border rounded text-xs text-foreground whitespace-nowrap opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none z-20">
                                    {member.nickname}
                                  </div>
                                </Link>
                              ))}
                            </div>
                            {teamMembers.length > 5 && (
                              <span className="text-sm text-muted-foreground">
                                +{teamMembers.length - 5} more
                              </span>
                            )}
                          </div>

                          {/* Win Rate Circle */}
                          <div className="flex items-center gap-2 px-3 py-2 bg-card/80 backdrop-blur rounded-lg border border-border/50">
                            <div className="relative w-10 h-10">
                              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" className="text-border" strokeWidth="3" />
                                <circle 
                                  cx="18" cy="18" r="15" fill="none" 
                                  stroke="currentColor" 
                                  className="text-success" 
                                  strokeWidth="3"
                                  strokeDasharray={`${winRate} 100`}
                                  strokeLinecap="round"
                                />
                              </svg>
                              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
                                {winRate}%
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">Win Rate</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* No roster fallback */}
                  {!team.roster && (
                    <div className="px-6 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          {teamMembers.slice(0, 5).map((member, i) => (
                            <Link
                              key={member.id}
                              href={`/stats/${member.id}`}
                              className="relative group/avatar"
                              style={{ zIndex: 5 - i }}
                            >
                              <div className="w-10 h-10 rounded-full border-2 border-card bg-card overflow-hidden hover:scale-110 hover:z-10 transition-transform">
                                {member.profilePic ? (
                                  <Image
                                    src={member.profilePic}
                                    alt={member.nickname}
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                                    <span className="text-xs font-bold text-primary">
                                      {member.nickname.charAt(0)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                        {teamMembers.length > 5 && (
                          <span className="text-sm text-muted-foreground">
                            +{teamMembers.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Expanded Player List */}
                  {isExpanded && (
                    <div className="border-t border-border/50 p-6 bg-card/30">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                        Full Roster - Click to view stats
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {teamMembers.map((member) => (
                          <Link
                            key={member.id}
                            href={`/stats/${member.id}`}
                            className="flex items-center gap-3 p-3 bg-card/50 border border-border/50 rounded-xl hover:border-primary/30 hover:bg-card transition-all group/member"
                          >
                            <div className="relative w-12 h-12 rounded-full overflow-hidden bg-card border border-border/50 shrink-0">
                              {member.profilePic ? (
                                <Image
                                  src={member.profilePic}
                                  alt={member.nickname}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                                  <span className="text-lg font-bold text-primary">
                                    {member.nickname.charAt(0)}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-foreground group-hover/member:text-primary transition-colors truncate">
                                {member.nickname}
                              </div>
                              {member.role && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border mt-1 ${ROLE_COLORS[member.role] || "bg-muted text-muted-foreground border-border"}`}>
                                  {ROLE_ICONS[member.role]}
                                  {member.role}
                                </span>
                              )}
                            </div>
                            <svg className="w-5 h-5 text-muted-foreground group-hover/member:text-primary transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        ))}
                        {teamMembers.length === 0 && (
                          <div className="col-span-full text-center py-8 text-muted-foreground">
                            No players assigned to this team yet
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Grid View */}
        {!isLoading && viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedTeams.map((team, index) => {
              const teamStats = getTeamStats(team.id);
              const teamMembers = membersByTeam[team.id] || [];
              const mapDiff = team.mapWins - team.mapLoses;
              const winRate = team.mapWins + team.mapLoses > 0
                ? Math.round((team.mapWins / (team.mapWins + team.mapLoses)) * 100)
                : 0;

              return (
                <div
                  key={team.id}
                  className="group bg-card/50 border border-border/50 rounded-2xl overflow-hidden hover:border-primary/30 transition-all"
                >
                  {/* Roster Image */}
                  <div className="relative h-44 overflow-hidden">
                    {team.roster ? (
                      <>
                        <Image
                          src={team.roster}
                          alt={`${team.name} roster`}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                      </>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10" />
                    )}

                    {/* Rank & Logo Overlay */}
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold backdrop-blur ${
                        index === 0 ? "bg-yellow-500/30 text-yellow-400" :
                        index === 1 ? "bg-gray-400/30 text-gray-300" :
                        index === 2 ? "bg-orange-500/30 text-orange-400" :
                        "bg-card/80 text-muted-foreground"
                      }`}>
                        #{index + 1}
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-card/90 backdrop-blur border border-border/50 overflow-hidden flex items-center justify-center">
                        {team.logo ? (
                          <Image
                            src={team.logo}
                            alt={team.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <span className="text-sm font-bold text-primary">
                            {team.name.charAt(0)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Map Diff Badge */}
                    <div className="absolute top-4 right-4">
                      <Badge variant={mapDiff > 0 ? "success" : mapDiff < 0 ? "danger" : "default"}>
                        {mapDiff > 0 ? "+" : ""}{mapDiff} diff
                      </Badge>
                    </div>
                  </div>

                  {/* Team Info */}
                  <div className="p-5">
                    <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors mb-2">
                      {team.name}
                    </h2>

                    {/* Role Badges */}
                    <div className="flex items-center gap-1 mb-4">
                      {Object.entries(teamStats.roles).map(([role, count]) => (
                        <span
                          key={role}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${ROLE_COLORS[role] || "bg-muted text-muted-foreground border-border"}`}
                        >
                          {ROLE_ICONS[role]}
                          {count}
                        </span>
                      ))}
                      {Object.keys(teamStats.roles).length === 0 && (
                        <span className="text-xs text-muted-foreground">{teamStats.memberCount} players</span>
                      )}
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2 mb-4 py-3 border-t border-b border-border/50">
                      <div className="text-center">
                        <div className="text-lg font-bold text-success">{team.victories}</div>
                        <div className="text-xs text-muted-foreground">Wins</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-foreground">{team.mapWins}-{team.mapLoses}</div>
                        <div className="text-xs text-muted-foreground">Maps</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-accent">{winRate}%</div>
                        <div className="text-xs text-muted-foreground">Rate</div>
                      </div>
                    </div>

                    {/* Player Avatars */}
                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {teamMembers.slice(0, 5).map((member, i) => (
                          <Link
                            key={member.id}
                            href={`/stats/${member.id}`}
                            className="relative group/avatar"
                            style={{ zIndex: 5 - i }}
                          >
                            <div className="w-8 h-8 rounded-full border-2 border-card bg-card overflow-hidden hover:scale-110 hover:z-10 transition-transform">
                              {member.profilePic ? (
                                <Image
                                  src={member.profilePic}
                                  alt={member.nickname}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                                  <span className="text-xs font-bold text-primary">
                                    {member.nickname.charAt(0)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </Link>
                        ))}
                        {teamMembers.length > 5 && (
                          <div className="w-8 h-8 rounded-full border-2 border-card bg-card flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">
                              +{teamMembers.length - 5}
                            </span>
                          </div>
                        )}
                      </div>

                      <Link 
                        href={`/teams/${team.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        View Team
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && sortedTeams.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-card/50 border border-border/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Teams Yet</h3>
            <p className="text-muted-foreground">Teams will appear here once they are registered.</p>
          </div>
        )}
      </div>
    </div>
  );
}
