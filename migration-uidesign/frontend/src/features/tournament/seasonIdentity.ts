export type SeasonIdentity = { name?: unknown } | null | undefined;

export function resolveSeasonLabel(tournament: SeasonIdentity): string {
  return typeof tournament?.name === "string" && tournament.name.trim()
    ? tournament.name.trim()
    : "Season";
}
