"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import styles from "./brand-field.module.css";
import { getGrainTile, makeNoise } from "./field";

/* EL TABLERO — el arte de marca de OTP.
 *
 * Negro con matices verdes: una rejilla irregular de cuadrados donde unas pocas
 * celdas están encendidas. Es el mismo gesto que el draft table (una rejilla donde
 * se activan celdas), así que la landing y el producto hablan el mismo idioma.
 *
 * Tres reglas sostienen que esto no se lea como generado por una máquina:
 *
 * 1. La rejilla NO es uniforme. Sale de subdivisión recursiva ajustada a un módulo,
 *    así que las celdas varían de tamaño pero todo queda alineado. Una cuadrícula
 *    regular se delata al instante.
 * 2. Las luces se AGRUPAN por ruido, nunca se reparten parejo. La aleatoriedad
 *    uniforme se ve artificial; la naturaleza y el diseño hacen racimos.
 * 3. Respiran DESINCRONIZADAS, con periodo y fase propios. Un pulso sincronizado
 *    es lo que convierte un tablero vivo en un salvapantallas.
 */

export type BrandVariant = "zone" | "bar" | "footer" | "section";

interface Tuning {
  /** Lado mínimo de celda en px. Manda el grano de la rejilla. */
  minCell: number;
  /** Módulo al que se ajustan todos los cortes. */
  module: number;
  /** Probabilidad de que una celda se subdivida otra vez. */
  splitChance: number;
  /** Proporción de celdas encendidas. */
  litRatio: number;
  /** Proporción de las encendidas que además llevan núcleo brillante. */
  hotRatio: number;
  /** Intensidad del lavado verde ambiental del fondo. */
  ambient: number;
  grain: number;
  /** Tope duro de recursión. Es una red de seguridad, no el mando del grano:
   *  quien decide el tamaño de celda es minCell. */
  maxDepth: number;
  /** Cuánto decae la probabilidad de corte por nivel. Más alto = rejilla más fina. */
  decay: number;
}

const TUNING: Record<BrandVariant, Tuning> = {
  // La zona de marca: hero + anuncios. Celda grande porque es mucha superficie.
  zone: { minCell: 30, module: 8, splitChance: 0.82, litRatio: 0.16, hotRatio: 0.36, ambient: 0.085, grain: 0.045, maxDepth: 14, decay: 0.92 },
  // El header es una banda estrecha: celda pequeña o solo caben dos filas.
  bar: { minCell: 16, module: 4, splitChance: 0.74, litRatio: 0.17, hotRatio: 0.34, ambient: 0.035, grain: 0.05, maxDepth: 14, decay: 0.9 },
  // El footer cierra: más apagado que el hero para no competir con él.
  footer: { minCell: 26, module: 8, splitChance: 0.78, litRatio: 0.095, hotRatio: 0.24, ambient: 0.03, grain: 0.05, maxDepth: 14, decay: 0.91 },
  // Las secciones del cuerpo. Celda mayor que el hero porque cubren mucho alto y
  // el tablero no debe competir con el texto que va encima; el brillo real lo
  // decide `intensity`, no la tabla.
  section: { minCell: 38, module: 8, splitChance: 0.8, litRatio: 0.13, hotRatio: 0.28, ambient: 0.05, grain: 0.042, maxDepth: 14, decay: 0.92 },
};

const SEED: Record<BrandVariant, number> = { zone: 20260823, bar: 4711, footer: 90210, section: 51877 };

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0 = apagada. >0 = intensidad base. */
  level: number;
  hot: boolean;
  period: number;
  phase: number;
}

const GREEN = "52, 199, 123";

interface Props {
  variant?: BrandVariant;
  /* Cuánto pesa el tablero aquí. Multiplica el brillo de la rejilla, no la
     opacidad CSS del elemento: bajando `opacity` se apagaría también el suelo y
     la sección se volvería translúcida sobre lo que tenga detrás. */
  intensity?: number;
  /* El suelo negro. Sólo lo pinta quien es el fondo de su propia caja (hero,
     footer, header). Las secciones del cuerpo comparten el suelo de la página,
     así que pintan la rejilla sobre transparente. */
  ground?: boolean;
  /* Desplaza la semilla para que dos tableros contiguos no salgan calcados. */
  seedOffset?: number;
  className?: string;
}

export default function BrandField({
  variant = "zone",
  intensity = 1,
  ground = true,
  seedOffset = 0,
  className,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sweepDelay = -(((SEED[variant] + seedOffset) % 11000) / 1000);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tune = TUNING[variant];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let cells: Cell[] = [];
    let width = 0;
    let height = 0;
    let ready = false;
    let visible = false;
    let raf: number | null = null;
    let resizeTimer: number | undefined;
    let disposed = false;
    // Estos dos no cambian entre frames, solo al reconstruir. Recrearlos 60 veces
    // por segundo era gasto puro: un degradado a pantalla completa y un patrón.
    let ambientGrad: CanvasGradient | null = null;
    let grainPattern: CanvasPattern | null = null;

    /* --- construcción de la rejilla --- */

    const buildCells = () => {
      let s = (SEED[variant] + seedOffset) >>> 0;
      const rnd = () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
      const noise = makeNoise((SEED[variant] + seedOffset) ^ 0x5f3d);
      const snap = (v: number) => Math.round(v / tune.module) * tune.module;
      const out: Cell[] = [];

      const split = (x: number, y: number, w: number, h: number, depth: number) => {
        // Se mide contra el LADO LARGO, no contra los dos. Exigir que ambos lados
        // superasen el umbral dejaba sin partir cualquier celda alargada por muy
        // grande que fuese, y la rejilla se quedaba en cuatro rectángulos enormes.
        const long = Math.max(w, h);
        const canSplit = long > tune.minCell * 2;
        // Por encima de este tamaño el corte no se sortea: se hace. Así ninguna
        // celda se queda gigante y el azar solo decide en la franja intermedia,
        // que es de donde sale la variedad sin perder el grano del tablero.
        const mustSplit = long > tune.minCell * 3.4;
        if (canSplit && depth < tune.maxDepth && (mustSplit || rnd() < tune.splitChance * Math.pow(tune.decay, depth))) {
          // Siempre por el lado largo: así las celdas tienden a cuadrado.
          const horizontal = w >= h;
          const span = horizontal ? w : h;
          // Corte cerca del centro pero desviado, y ajustado al módulo.
          const ratio = 0.34 + rnd() * 0.32;
          const cut = Math.max(tune.minCell, Math.min(span - tune.minCell, snap(span * ratio)));
          if (horizontal) {
            split(x, y, cut, h, depth + 1);
            split(x + cut, y, w - cut, h, depth + 1);
          } else {
            split(x, y, w, cut, depth + 1);
            split(x, y + cut, w, h - cut, depth + 1);
          }
          return;
        }
        out.push({ x, y, w, h, level: 0, hot: false, period: 0, phase: 0 });
      };

      split(0, 0, snap(width), snap(height), 0);

      // Encendido agrupado: el ruido decide dónde hay racimos, y solo dentro de
      // ellos se sortea. Sortear plano sobre todas las celdas reparte las luces
      // de forma uniforme, que es justo lo que hay que evitar.
      for (const c of out) {
        const u = (c.x + c.w / 2) / Math.max(1, width);
        const v = (c.y + c.h / 2) / Math.max(1, height);
        const cluster = noise(u * 2.6, v * 2.6) * 0.5 + 0.5;
        const chance = tune.litRatio * (0.2 + cluster * 2.4);
        if (rnd() < chance) {
          c.level = 0.35 + rnd() * 0.65;
          c.hot = rnd() < tune.hotRatio;
          c.period = 4000 + rnd() * 7000;
          c.phase = rnd() * Math.PI * 2;
        }
      }

      cells = out;
    };

    /* --- pintado --- */

    const paint = (now: number) => {
      if (!ready || disposed) return;
      const still = reduceMotion.matches;

      ctx.clearRect(0, 0, width, height);

      // Suelo y lavado verde ambiental, deliberadamente descentrado.
      if (ground) {
        ctx.fillStyle = "#050806";
        ctx.fillRect(0, 0, width, height);
      }

      if (ambientGrad) {
        ctx.fillStyle = ambientGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // Líneas de pelo. El medio píxel hace que caigan nítidas en vez de grises.
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${GREEN}, ${(0.055 * intensity).toFixed(4)})`;
      ctx.beginPath();
      for (const c of cells) {
        ctx.rect(Math.round(c.x) + 0.5, Math.round(c.y) + 0.5, Math.round(c.w), Math.round(c.h));
      }
      ctx.stroke();

      for (const c of cells) {
        if (c.level <= 0) continue;
        const breath = still ? 0.72 : 0.5 + 0.5 * Math.sin((now / c.period) * Math.PI * 2 + c.phase);
        const a = c.level * (0.42 + breath * 0.58) * intensity;

        ctx.fillStyle = `rgba(${GREEN}, ${(a * 0.14).toFixed(4)})`;
        ctx.fillRect(c.x, c.y, c.w, c.h);

        ctx.strokeStyle = `rgba(${GREEN}, ${(a * 0.3).toFixed(4)})`;
        ctx.strokeRect(Math.round(c.x) + 0.5, Math.round(c.y) + 0.5, Math.round(c.w), Math.round(c.h));

        if (c.hot) {
          // Miniluz: un cuadrado diminuto en la esquina, con su halo. Es el detalle
          // que hace que el tablero se lea como encendido y no como tramado.
          const s = Math.max(3, Math.min(6, c.w * 0.12));
          const inset = Math.min(9, c.w * 0.22, c.h * 0.22);
          const px = c.x + inset;
          const py = c.y + inset;

          const halo = ctx.createRadialGradient(px + s / 2, py + s / 2, 0, px + s / 2, py + s / 2, s * 5);
          halo.addColorStop(0, `rgba(${GREEN}, ${(a * 0.5).toFixed(4)})`);
          halo.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = halo;
          ctx.fillRect(px - s * 5, py - s * 5, s * 11, s * 11);

          ctx.fillStyle = `rgba(190, 255, 220, ${((0.35 + a * 0.6) * intensity).toFixed(4)})`;
          ctx.fillRect(px, py, s, s);
        }
      }

      if (tune.grain > 0 && grainPattern) {
        ctx.save();
        ctx.globalAlpha = tune.grain * intensity;
        ctx.fillStyle = grainPattern;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    };

    const loop = (now: number) => {
      paint(now);
      raf = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (raf !== null || disposed) return;
      if (reduceMotion.matches) {
        paint(0);
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const stopLoop = () => {
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    };

    const build = () => {
      if (disposed) return;
      const rect = host.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      if (width < 4 || height < 4) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Lavado verde ambiental, deliberadamente descentrado. Se construye aquí
      // porque solo depende del tamaño.
      const gx = width * 0.28;
      const gy = height * 0.34;
      ambientGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(width, height) * 0.72);
      ambientGrad.addColorStop(0, `rgba(${GREEN}, ${tune.ambient * intensity})`);
      ambientGrad.addColorStop(0.55, `rgba(${GREEN}, ${tune.ambient * 0.35 * intensity})`);
      ambientGrad.addColorStop(1, "rgba(0,0,0,0)");
      grainPattern = tune.grain > 0 ? ctx.createPattern(getGrainTile(), "repeat") : null;

      buildCells();
      ready = true;
      paint(performance.now());
      if (visible) startLoop();
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visible = e.isIntersecting;
          if (!ready && visible) build();
          else if (visible) startLoop();
          else stopLoop();
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(host);

    // El tamaño de la zona de marca depende del contenido (los anuncios llegan
    // por red y cambian la altura), así que hay que reconstruir cuando crece.
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!disposed) build();
      }, 160);
    });
    ro.observe(host);

    // Red de seguridad. IntersectionObserver y ResizeObserver se apoyan en el
    // pipeline de render, que el navegador suspende mientras la pestaña no
    // compone frames: un tab abierto en segundo plano se quedaría con el lienzo
    // sin dibujar hasta que alguien lo mirase. Los temporizadores sí corren, así
    // que este disparo garantiza un primer pintado. Es barato: rectángulos, no
    // ruido por píxel.
    const kick = window.setTimeout(() => {
      if (!ready && !disposed) build();
    }, 250);

    return () => {
      disposed = true;
      window.clearTimeout(kick);
      io.disconnect();
      ro.disconnect();
      window.clearTimeout(resizeTimer);
      stopLoop();
    };
  }, [variant, intensity, ground, seedOffset]);

  return (
    <div
      ref={hostRef}
      className={`${styles.field} ${className ?? ""}`}
      data-variant={variant}
      style={{ "--sweep-delay": `${sweepDelay}s` } as CSSProperties}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.sweep} />
      <div className={styles.veil} />
    </div>
  );
}
