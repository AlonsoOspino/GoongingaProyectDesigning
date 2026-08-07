import type { Match } from "@/lib/api/types";

/**
 * Single source of truth for "what format is this match?".
 *
 * Bracket matches are identified by `playoffRound`, never by `type` alone:
 * rounds 1-2 are stored as type "PLAYOFFS" while the Grand Final (round 3) is
 * stored as type "FINALS" so it satisfies the tournament FINALS state rules.
 */
export const GRAND_FINAL_ROUND = 3;

type MatchLike = Pick<Match, "type"> &
  Partial<Pick<Match, "playoffRound" | "bestOf" | "title">>;

export function isBracketMatch(match?: MatchLike | null): boolean {
  if (!match) return false;
  if (typeof match.playoffRound === "number") return true;
  return match.type === "PLAYOFFS" || match.type === "FINALS";
}

export function isGrandFinalMatch(match?: MatchLike | null): boolean {
  if (!match) return false;
  if (match.playoffRound === GRAND_FINAL_ROUND) return true;
  // Older rows were created before the Grand Final moved to type FINALS.
  return match.type === "FINALS" || /grand\s*final/i.test(match.title || "");
}

/** Games needed to win: 4 in the best of 7 Grand Final, 3 in a best of 5. */
export function getRequiredWins(match?: MatchLike | null): number {
  const bestOf = match?.bestOf && match.bestOf > 0 ? match.bestOf : 5;
  return Math.ceil(bestOf / 2);
}

/** Total maps in the series, used to size the wincards grid. */
export function getSeriesLength(match?: MatchLike | null): number {
  if (match?.bestOf && match.bestOf > 0) return match.bestOf;
  return isGrandFinalMatch(match) ? 7 : 5;
}
