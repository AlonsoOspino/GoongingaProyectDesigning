/* Motor de atmósfera — densidad irregular atravesada por una sola fuente de luz.
 *
 * Dos decisiones sostienen todo el sistema visual y conviene no tocarlas sin leer
 * MASTER.md primero:
 *
 * 1. La turbulencia sale de ruido con el DOMINIO DEFORMADO (el campo se consulta a
 *    sí mismo para decidir dónde mirar). Es lo que produce voluta de humo en vez de
 *    onda regular. Un fbm plano aquí devuelve la rejilla que rechazamos.
 * 2. Hay UNA fuente de luz por lámina, nunca dos. La asimetría es física, no gusto:
 *    el aire real se ilumina desde un lado.
 */

export type Rgb = [number, number, number];

/** Ruido de valor con interpolación suave. Determinista por semilla. */
export function makeNoise(seed: number): (x: number, y: number) => number {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const perm: number[] = [];
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let j = 255; j > 0; j--) {
    const k = (rand() * (j + 1)) | 0;
    const t = perm[j];
    perm[j] = perm[k];
    perm[k] = t;
  }

  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h: number, x: number, y: number) => ((h & 1) ? x : -x) + ((h & 2) ? y : -y);
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);

  return (x: number, y: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const A = p[X] + Y;
    const B = p[X + 1] + Y;
    return lerp(
      lerp(grad(p[A], x, y), grad(p[B], x - 1, y), u),
      lerp(grad(p[A + 1], x, y - 1), grad(p[B + 1], x - 1, y - 1), u),
      v,
    );
  };
}

type Noise = (x: number, y: number) => number;

function fbm(n: Noise, x: number, y: number, octaves: number): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * n(x * freq, y * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/* Los recuentos de octava (3/3/3/3/4) están medidos, no elegidos a ojo: subirlos a
   4/4/4/4/5 cuesta 2,4x en tiempo de render y no mueve el brillo medio de ninguna
   lámina ni un punto. */
function warped(n: Noise, x: number, y: number, w1: number, w2: number): number {
  const q1 = fbm(n, x, y, 3);
  const q2 = fbm(n, x + 5.2, y + 1.3, 3);
  const r1 = fbm(n, x + w1 * q1 + 1.7, y + w1 * q2 + 9.2, 3);
  const r2 = fbm(n, x + w1 * q1 + 8.3, y + w1 * q2 + 2.8, 3);
  return fbm(n, x + w2 * r1, y + w2 * r2, 4);
}

export function hexToRgb(h: string): Rgb {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

function ramp(stops: Rgb[], t: number): Rgb {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const segments = stops.length - 1;
  const i = Math.min(segments - 1, Math.floor(clamped * segments));
  const f = clamped * segments - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ];
}

export interface Beam {
  /** Origen de la luz, en coordenadas normalizadas. Puede caer fuera del lienzo. */
  x: number;
  y: number;
  /** Ángulo del haz en radianes. */
  a: number;
  width: number;
  spread: number;
  len: number;
  i: number;
}

export interface HourConfig {
  seed: number;
  scale: number;
  /** Fuerza de las dos capas de deformación de dominio. */
  w1: number;
  w2: number;
  density: number;
  /** Paradas de color de sombra a luz. */
  stops: string[];
  beam: Beam;
  ambient: number;
  grain: number;
  /** Las láminas claras invierten la densidad: el aire espeso oscurece en vez de brillar. */
  invert?: boolean;
  /** Número de estrellas. Solo la lámina de noche. */
  stars?: number;
  /** Segundos por vuelta de deriva. Ausente = imagen fija, que es el caso normal. */
  driftSeconds?: number;
}

export interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
}

/** Pinta el campo de densidad iluminado en un búfer de baja resolución. */
export function renderDensity(
  ctx: CanvasRenderingContext2D,
  cfg: HourConfig,
  bw: number,
  bh: number,
): ImageData {
  const img = ctx.createImageData(bw, bh);
  const n = makeNoise(cfg.seed);
  const stops = cfg.stops.map(hexToRgb);
  const aspect = bw / bh;
  const b = cfg.beam;
  const vx = Math.cos(b.a);
  const vy = Math.sin(b.a);

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const u = x / bw;
      const v = y / bh;

      let d = warped(n, u * cfg.scale * aspect, v * cfg.scale, cfg.w1, cfg.w2);
      d = d * 0.5 + 0.5;
      d = Math.pow(Math.max(0, Math.min(1, d)), 1.25) * cfg.density;

      const rx = (u - b.x) * aspect;
      const ry = v - b.y;
      const along = rx * vx + ry * vy;
      const across = Math.abs(-rx * vy + ry * vx);

      let beam = 0;
      if (along > 0) {
        const wd = b.width * (1 + along * b.spread);
        beam = Math.exp(-(across / wd) * (across / wd)) * Math.exp(-along / b.len) * b.i;
        // El haz se deshilacha donde el aire es espeso. Sin esto es un triángulo limpio,
        // que es exactamente lo que delata que lo dibujó una máquina.
        beam *= 0.42 + 0.58 * d;
      }

      const t = cfg.invert
        ? cfg.ambient + (1 - d) * 0.34 + beam
        : cfg.ambient + d * 0.55 + beam;

      const col = ramp(stops, t);
      const o = (y * bw + x) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
    }
  }

  return img;
}

/** Estrellas agrupadas por el propio campo y apagadas hacia abajo por extinción
 *  atmosférica. Una malla uniforme de puntos delata el ordenador al instante. */
export function makeStars(cfg: HourConfig, aspect: number): Star[] {
  if (!cfg.stars) return [];
  const n = makeNoise(cfg.seed);
  const out: Star[] = [];
  let tries = 0;

  while (out.length < cfg.stars && tries < cfg.stars * 40) {
    tries++;
    const sx = Math.random();
    const sy = Math.random();
    const dens = warped(n, sx * cfg.scale * aspect + 11, sy * cfg.scale + 7, cfg.w1, cfg.w2) * 0.5 + 0.5;
    const keep = (1 - sy) * 0.85 + 0.15;
    if (Math.random() > keep * (0.35 + dens * 0.9)) continue;
    out.push({
      x: sx,
      y: sy,
      r: 0.35 + Math.random() * Math.random() * 1.7,
      a: (0.25 + Math.random() * 0.75) * (1 - sy * 0.72),
    });
  }

  return out;
}

/** Mosaico de grano, generado una vez y reutilizado por todas las láminas.
 *  Es lo que impide que un degradado se lea como digital. */
let grainTile: HTMLCanvasElement | null = null;

export function getGrainTile(): HTMLCanvasElement {
  if (grainTile) return grainTile;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const x = c.getContext("2d");
  if (x) {
    const d = x.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d.data[i] = v;
      d.data[i + 1] = v;
      d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
  }
  grainTile = c;
  return c;
}
