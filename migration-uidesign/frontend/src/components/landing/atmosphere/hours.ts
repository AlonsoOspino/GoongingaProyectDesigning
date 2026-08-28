import type { HourConfig } from "./field";

/* Las cinco horas del día de la liga.
 *
 * El orden no es decorativo: la landing recorre un día completo y vuelve a luz
 * artificial al final, que es donde el copy dice que todo ocurre de verdad.
 *
 *   arena   luz artificial, lejana y dura   Hero
 *   dawn    primera luz, rasante            Anuncios
 *   day     mediodía difuso, sin dirección  Overtime GGL
 *   night   sin luz directa                 Game Night
 *   hearth  luz artificial, cercana y cálida Discord
 *
 * `day` y `hearth` son ambas claras a propósito, pero opuestas en temperatura y
 * apertura: fría y abierta vs cálida y cerrada. Es lo que arregla que esas dos
 * secciones tuvieran literalmente el mismo fondo.
 */
export type HourName = "arena" | "dawn" | "day" | "night" | "hearth";

export const HOURS: Record<HourName, HourConfig> = {
  arena: {
    seed: 9021,
    scale: 2.5,
    w1: 3.6,
    w2: 2.4,
    density: 1.0,
    stops: ["#050807", "#0b1512", "#153026", "#34c77b", "#d9fce8"],
    beam: { x: 0.16, y: -0.12, a: 1.02, width: 0.09, spread: 0.55, len: 1.5, i: 1.15 },
    ambient: 0.16,
    grain: 0.05,
  },
  dawn: {
    seed: 3311,
    scale: 2.1,
    w1: 2.8,
    w2: 3.2,
    density: 0.82,
    stops: ["#0a0f0d", "#141d19", "#2b2a20", "#e0a860", "#f4dcb0"],
    beam: { x: -0.08, y: 0.58, a: 0.14, width: 0.17, spread: 0.3, len: 2.6, i: 1.0 },
    ambient: 0.2,
    grain: 0.045,
  },
  day: {
    seed: 6644,
    scale: 1.55,
    w1: 2.2,
    w2: 1.9,
    density: 0.42,
    invert: true,
    stops: ["#b9c7c0", "#cfd9d2", "#e2e8e1", "#f2f4ee", "#fffef8"],
    beam: { x: 0.72, y: -0.35, a: 1.5, width: 0.55, spread: 1.1, len: 3.4, i: 0.5 },
    ambient: 0.62,
    grain: 0.03,
  },
  night: {
    seed: 1207,
    scale: 2.0,
    w1: 3.0,
    w2: 2.6,
    density: 0.7,
    stars: 420,
    stops: ["#05080c", "#080f18", "#0d1a24", "#174a45", "#2a7a6a"],
    beam: { x: 0.5, y: 1.35, a: 1.57, width: 0.9, spread: 0.4, len: 1.0, i: 0.3 },
    ambient: 0.1,
    grain: 0.055,
    // La única deriva del sitio. 240 s por vuelta queda por debajo del umbral en el
    // que se percibe como bucle; más rápido y se lee como salvapantallas.
    driftSeconds: 240,
  },
  hearth: {
    seed: 8080,
    scale: 1.9,
    w1: 2.6,
    w2: 2.2,
    density: 0.6,
    invert: true,
    stops: ["#c4b69c", "#d8cdb8", "#e8dcc6", "#f4ecdc", "#fdf6e8"],
    beam: { x: 0.86, y: 1.16, a: -2.1, width: 0.3, spread: 0.72, len: 2.0, i: 0.85 },
    ambient: 0.55,
    grain: 0.04,
  },
};

/* Registro de slots de arte.
 *
 * Lo que se ve hoy es la aproximación procedural. Cuando exista el arte final,
 * cada lámina se cambia poniendo su ruta en `src` — una línea por sección, sin
 * tocar ni el componente ni el CSS. Mientras `src` sea null se dibuja el canvas. */
export interface ArtSlot {
  id: string;
  hour: HourName;
  /** Ruta del arte final. null = todavía procedural. */
  src: string | null;
  /** Medidas de entrega para el brief. */
  deliver: string;
}

export const ART_SLOTS: Record<HourName, ArtSlot> = {
  arena: { id: "otp-bg-01-arena-haze", hour: "arena", src: null, deliver: "2560x1440" },
  dawn: { id: "otp-bg-02-dawn-spill", hour: "dawn", src: null, deliver: "2560x900" },
  day: { id: "otp-bg-03-day-open", hour: "day", src: null, deliver: "2560x1200" },
  night: { id: "otp-bg-04-night-vault", hour: "night", src: null, deliver: "2560x1400" },
  hearth: { id: "otp-bg-05-hearth-glow", hour: "hearth", src: null, deliver: "2560x1100" },
};
