/* COLOR CON TRABAJO ASIGNADO.
 *
 * El archivo estaba en gris sobre verde de punta a punta: nueve equipos, tres
 * roles y cuarenta y cinco jugadores pintados todos igual. Con esa paleta la
 * unica forma de saber de quien es una fila es leerla.
 *
 * Aqui el color identifica, no decora. Un equipo tiene SU color y lo lleva en la
 * tabla, en su tarjeta y en el bracket: se reconoce de un vistazo sin leer. Por
 * eso la asignacion es estable por id y no por posicion — si el equipo sube o
 * baja en la tabla, su color viaja con el.
 *
 * Todos los tonos estan desaturados y en la misma familia fria-tierra que ya usa
 * la marca. Nada fluorescente, nada naranja puro, y ninguno compite con el verde
 * de OTP, que sigue significando "sistema, accion o estado en vivo". */

const TEAM_COLORS = [
  "#5B7BB4", // azul
  "#8A79BC", // violeta
  "#4FA890", // verde azulado
  "#B36F87", // vino
  "#C6A863", // oro
  "#6FA6C9", // cielo
  "#9B7F63", // bronce
  "#84A86F", // oliva
  "#B98FAE", // malva
] as const;

/* Por id y no por indice del array: el orden de `teams` cambia segun se ordene
   por nombre, por seed o por victorias, y el color no puede cambiar con el. */
export function teamColor(teamId: number): string {
  return TEAM_COLORS[Math.abs(teamId) % TEAM_COLORS.length];
}

/* Los tres roles de Overwatch. Tank frio, damage calido, support verde: es la
   convencion que ya conoce quien juega, asi que no hay que aprenderse nada. */
const ROLE_COLORS: Record<string, string> = {
  TANK: "#5B7BB4",
  DPS: "#B36F87",
  SUPPORT: "#4FA890",
};

export function roleColor(role: string): string {
  return ROLE_COLORS[role] ?? "#8A93A8";
}

/* Podio. Solo los tres primeros reciben color; del cuarto en adelante el numero
   se apaga, que es lo que hace que el podio se lea sin contarlo. */
const MEDALS = ["#C6A863", "#A9B2BA", "#9B7F63"] as const;

export function medalColor(rank: number): string | null {
  return rank >= 1 && rank <= 3 ? MEDALS[rank - 1] : null;
}
