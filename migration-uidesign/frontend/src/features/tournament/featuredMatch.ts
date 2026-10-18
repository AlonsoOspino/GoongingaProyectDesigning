import type { Match, Tournament } from "../../lib/api/types";

export type TournamentPhase =
  | { kind: "coming-soon" }
  | { kind: "preparation"; at: string | null }
  | { kind: "complete" }
  | { kind: "next-match"; match: Match; at: string }
  | { kind: "live"; match: Match }
  | { kind: "latest-result"; match: Match }
  | { kind: "preview"; match: Match };

function timestamp(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/** Feature a real public fixture, including fixtures created before opening night. */
export function pickTournamentPhase(
  tournament: Tournament | null,
  matches: Match[],
  now = Date.now(),
): TournamentPhase {
  if (!tournament) return { kind: "coming-soon" };
  const fixtures = matches.filter((match) => match.tournamentId === tournament.id && match.type !== "PRACTICE");

  if (tournament.state !== "FINISHED") {
    const live = fixtures.find((match) => match.status === "ACTIVE");
    if (live) return { kind: "live", match: live };

    const dated = fixtures.filter((match) => match.status === "SCHEDULED" && timestamp(match.startDate) !== null);
    const upcoming = dated.filter((match) => (timestamp(match.startDate) as number) >= now)
      .sort((left, right) => (timestamp(left.startDate) as number) - (timestamp(right.startDate) as number) || left.id - right.id)[0];
    if (upcoming) return { kind: "next-match", match: upcoming, at: upcoming.startDate };

    // A delayed match stays visible, with an "Awaiting start" label instead of a zero clock.
    const delayed = dated.sort((left, right) => (timestamp(right.startDate) as number) - (timestamp(left.startDate) as number) || right.id - left.id)[0];
    if (delayed) return { kind: "next-match", match: delayed, at: delayed.startDate };
  }

  const latest = fixtures.filter((match) => match.status === "FINISHED")
    .sort((left, right) => (timestamp(right.startDate) ?? 0) - (timestamp(left.startDate) ?? 0)
      || (right.semanas ?? 0) - (left.semanas ?? 0) || right.id - left.id)[0];
  if (latest) return { kind: "latest-result", match: latest };
  if (tournament.state === "FINISHED") return { kind: "complete" };

  const preview = fixtures.filter((match) => match.status === "SCHEDULED")
    .sort((left, right) => (left.semanas ?? Infinity) - (right.semanas ?? Infinity) || left.id - right.id)[0];
  if (preview) return { kind: "preview", match: preview };

  const at = timestamp(tournament.startDate);
  return { kind: "preparation", at: at !== null && at > now ? tournament.startDate : null };
}
