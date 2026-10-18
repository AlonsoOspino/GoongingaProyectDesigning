import type { Match, Team, TournamentDivision } from "../../lib/api/types";

export type ScheduleStatus = "ALL" | "UPCOMING" | "ACTIVE" | "FINISHED";

export interface FixtureWeek {
  week: number | null;
  matches: Match[];
}

export interface DivisionSchedule {
  key: string;
  name: string;
  weeks: FixtureWeek[];
}

function fixtureTime(match: Match): number {
  const date = match.startDate ? Date.parse(match.startDate) : NaN;
  return Number.isFinite(date) ? date : Infinity;
}

/** Division schedules share week numbers; playoff crossovers appear only once. */
export function groupSeasonSchedule(
  matches: Match[], teams: Team[], divisions: TournamentDivision[],
  options: { divisionId?: number | null; week?: number | null; status?: ScheduleStatus } = {},
): DivisionSchedule[] {
  const index = new Map(teams.map((team) => [team.id, team]));
  const ordered = [...divisions].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const sections = new Map<string, { name: string; weeks: Map<number | null, Match[]> }>();
  for (const division of ordered) {
    if (options.divisionId == null || options.divisionId === division.id) {
      sections.set(`division-${division.id}`, { name: division.name, weeks: new Map() });
    }
  }
  for (const match of matches) {
    if (match.type === "PRACTICE") continue;
    const regular = match.type === "ROUNDROBIN";
    const a = index.get(match.teamAId)?.divisionId;
    const b = index.get(match.teamBId)?.divisionId;
    const divisionId = regular && a != null && a === b ? a : null;
    if (options.divisionId != null && (regular
      ? divisionId !== options.divisionId
      : index.get(match.teamAId)?.divisionId !== options.divisionId && index.get(match.teamBId)?.divisionId !== options.divisionId)) continue;
    if (options.week != null && (!regular || match.semanas !== options.week)) continue;
    if (options.status === "UPCOMING" && match.status !== "SCHEDULED") continue;
    if (options.status && options.status !== "ALL" && options.status !== "UPCOMING" && match.status !== options.status) continue;
    const knownDivision = ordered.find((division) => division.id === divisionId);
    const key = regular ? knownDivision ? `division-${divisionId}` : "regular" : "playoffs";
    const name = regular ? knownDivision?.name ?? (divisions.length ? "Awaiting division" : "Regular season") : "Playoffs";
    const section = sections.get(key) ?? { name, weeks: new Map<number | null, Match[]>() };
    const week = regular ? match.semanas : null;
    section.weeks.set(week, [...(section.weeks.get(week) ?? []), match]);
    sections.set(key, section);
  }
  return [...sections].filter(([, section]) => section.weeks.size > 0).map(([key, section]) => ({
    key, name: section.name,
    weeks: [...section.weeks].sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity)).map(([week, fixtures]) => ({
      week, matches: [...fixtures].sort((a, b) => {
        const timeA = fixtureTime(a), timeB = fixtureTime(b);
        return (timeA === timeB ? 0 : timeA < timeB ? -1 : 1) || a.id - b.id;
      }),
    })),
  }));
}
