import type { Match, PlayerStat, Team, TournamentDivision } from "../../lib/api/types";

export interface DivisionTeamGroup {
  id: number | null;
  name: string;
  teams: Team[];
}

/** Keep teams without an assignment visible; never infer a division from their rank. */
export function groupTeamsByDivision(teams: Team[], divisions: TournamentDivision[]): DivisionTeamGroup[] {
  if (!divisions.length) return [{ id: null, name: "All teams", teams }];
  const ordered = [...divisions].sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id);
  const groups: DivisionTeamGroup[] = ordered.map((division) => ({
    id: division.id,
    name: division.name,
    teams: teams.filter((team) => team.divisionId === division.id),
  }));
  const known = new Set(divisions.map((division) => division.id));
  const unassigned = teams.filter((team) => team.divisionId == null || !known.has(team.divisionId));
  if (unassigned.length) groups.push({ id: null, name: "Awaiting division", teams: unassigned });
  return groups;
}

export function regularSeasonDivision(match: Match, teamsById: ReadonlyMap<number, Team>): number | null {
  if (match.type !== "ROUNDROBIN") return null;
  const a = teamsById.get(match.teamAId)?.divisionId;
  const b = teamsById.get(match.teamBId)?.divisionId;
  return a != null && a === b ? a : null;
}

export function filterMatchesByDivision(matches: Match[], teams: Team[], divisionId: number | null): Match[] {
  if (divisionId == null) return matches;
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  return matches.filter((match) => match.type === "ROUNDROBIN"
    ? regularSeasonDivision(match, teamsById) === divisionId
    : teamsById.get(match.teamAId)?.divisionId === divisionId || teamsById.get(match.teamBId)?.divisionId === divisionId);
}

/** Match IDs scope stats to the season, without trusting a player's current team. */
export function regularSeasonStats(stats: PlayerStat[], matches: Match[], teams: Team[], divisionId: number | null): PlayerStat[] {
  const ids = new Set(filterMatchesByDivision(matches, teams, divisionId)
    .filter((match) => match.type === "ROUNDROBIN").map((match) => match.id));
  return stats.filter((stat) => ids.has(stat.matchId));
}
