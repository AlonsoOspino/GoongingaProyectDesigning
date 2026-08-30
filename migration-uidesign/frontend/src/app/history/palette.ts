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
 * SOBRE LA SATURACION: la primera version desaturo todo tanto por miedo al
 * arcoiris que el archivo entero acabo pareciendo una flor seca. Estos tonos
 * conservan las mismas familias, pero con la luz suficiente para vivir sobre
 * fondo oscuro. Siguen siendo nueve identidades y no nueve gritos: ninguno es
 * fluorescente, y ninguno se acerca al verde OTP, que sigue significando en
 * exclusiva "sistema, accion o estado en vivo". */

const TEAM_COLORS = [
  "#5D8FE8", // azul
  "#9B7FE8", // violeta
  "#35C2C8", // cian — deliberadamente frio para no rozar el verde de marca
  "#E0708F", // vino
  "#E8BC5A", // oro
  "#5FC0EA", // cielo
  "#C8916A", // bronce
  "#A8C85E", // oliva
  "#D79AC8", // malva
] as const;

/* Por id y no por indice del array: el orden de `teams` cambia segun se ordene
   por nombre, por seed o por victorias, y el color no puede cambiar con el. */
export function teamColor(teamId: number): string {
  return TEAM_COLORS[Math.abs(teamId) % TEAM_COLORS.length];
}

/* Los tres roles de Overwatch. Tank frio, damage calido, support verde: es la
   convencion que ya conoce quien juega, asi que no hay que aprenderse nada. */
const ROLE_COLORS: Record<string, string> = {
  TANK: "#5D8FE8",
  DPS: "#F0705E",
  SUPPORT: "#5FD3A0",
};

export function roleColor(role: string): string {
  return ROLE_COLORS[role] ?? "#9AA6BC";
}

/* Podio. Solo los tres primeros reciben color; del cuarto en adelante el numero
   se apaga, que es lo que hace que el podio se lea sin contarlo. */
const MEDALS = ["#F0C64E", "#C4CDD6", "#C98C55"] as const;

export function medalColor(rank: number): string | null {
  return rank >= 1 && rank <= 3 ? MEDALS[rank - 1] : null;
}
