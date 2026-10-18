"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentTournament } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { getCurrentNetworkMember } from "@/lib/api/networkMember";
import { getLeaderboard } from "@/lib/api/team";
import { getMatchesByTournament } from "@/lib/api/match";
import { getSeasonRoster, type SeasonRoster } from "@/lib/api/seasonRoster";
import type { Match, Team, Tournament } from "@/lib/api/types";
import { readNetworkSessionToken } from "@/features/networkSession/storage";

export function useSeasonOperations(path: string, withRoster = false) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [roster, setRoster] = useState<SeasonRoster | null>(null);

  const refresh = useCallback(async (sessionToken: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const current = await getCurrentTournament({ cache: "no-store" }).catch((reason: unknown) => {
        if (reason instanceof ApiError && reason.status === 404) return null;
        throw reason;
      });
      if (!current) {
        setTournament(null); setTeams([]); setMatches([]); setRoster(null); setError(null);
        return;
      }
      const [nextTeams, nextMatches, nextRoster] = await Promise.all([
        getLeaderboard(current.id), getMatchesByTournament(current.id),
        withRoster ? getSeasonRoster(sessionToken, current.id) : Promise.resolve(null),
      ]);
      setTournament(current); setTeams(nextTeams); setMatches(nextMatches); setRoster(nextRoster); setError(null);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unable to load season operations.";
      setError(message);
      throw reason;
    } finally {
      setLoading(false);
    }
  }, [withRoster]);

  useEffect(() => {
    const sessionToken = readNetworkSessionToken();
    if (!sessionToken) { router.replace(`/login?next=${encodeURIComponent(path)}`); return; }
    getCurrentNetworkMember(sessionToken).then(async (member) => {
      if (!member.roles.includes("ADMIN")) { router.replace("/admin-dashboard"); return; }
      setToken(sessionToken); setReady(true);
      await refresh(sessionToken);
    }).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Unable to verify admin access.");
      setLoading(false);
    });
  }, [path, refresh, router]);

  return { token, ready, loading, error, setError, tournament, teams, matches, roster, refresh };
}
