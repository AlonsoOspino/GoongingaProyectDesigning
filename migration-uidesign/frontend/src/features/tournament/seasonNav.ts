/* Modelo de navegación de la temporada.
 *
 * "Season 9" se comporta de dos maneras según haya torneo en marcha o no:
 *
 *   en marcha  -> desplegable con las cinco vistas
 *   parado     -> enlace directo a Information
 *
 * La razón es que Schedule, Teams, Player Stats y Leaderboard no tienen nada que
 * enseñar fuera de temporada: un menú lleno de páginas vacías es peor que no
 * tener menú. Information sí sirve siempre, porque explica cómo funciona la liga.
 */

export interface SeasonNavItem {
  href: string;
  label: string;
}

/** Information va primera a propósito: es el destino cuando no hay menú. */
export const SEASON_NAV_ITEMS: readonly SeasonNavItem[] = [
  { href: "/season-9", label: "Information" },
  { href: "/schedule", label: "Schedule" },
  { href: "/teams", label: "Teams" },
  { href: "/stats", label: "Player Stats" },
  { href: "/standings", label: "Leaderboard" },
];

export const SEASON_INFORMATION_HREF = SEASON_NAV_ITEMS[0].href;

/* Estados en los que el torneo está realmente jugándose.
 *
 * Quedan fuera a propósito:
 *   SCHEDULED  la temporada existe pero no se ha jugado nada, así que no hay
 *              tabla, ni estadísticas, ni resultados que mirar.
 *   FINISHED   ya terminó; lo que quede se consulta desde GGL History.
 *   undefined  no hay torneo, o la API no respondió. Degradar al enlace directo
 *              es lo correcto: nunca se abre un menú hacia páginas vacías. */
const LIVE_STATES = new Set(["ROUNDROBIN", "PLAYOFFS", "SEMIFINALS", "FINALS"]);

export function isTournamentLive(state: unknown): boolean {
  return typeof state === "string" && LIVE_STATES.has(state);
}
