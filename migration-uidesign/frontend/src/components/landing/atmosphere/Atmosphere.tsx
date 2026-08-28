"use client";

import { useEffect, useRef } from "react";
import styles from "./atmosphere.module.css";
import { ART_SLOTS, HOURS, type HourName } from "./hours";
import { getGrainTile, makeStars, renderDensity, type Star } from "./field";

/* Cola global de construcción: una lámina por frame como máximo.
 * Construir dos en el mismo tick encadena el bloqueo y se ve como un tirón al
 * hacer scroll — medido, no supuesto. */
const buildQueue: Array<() => void> = [];
let draining = false;

function drain() {
  if (draining || buildQueue.length === 0) return;
  draining = true;
  requestAnimationFrame(() => {
    const fn = buildQueue.shift();
    draining = false;
    fn?.();
    if (buildQueue.length) drain();
  });
}

function enqueue(fn: () => void) {
  buildQueue.push(fn);
  drain();
}

interface Props {
  hour: HourName;
  /** Clase extra para el contenedor, por si una sección necesita otra altura. */
  className?: string;
}

export default function Atmosphere({ hour, className }: Props) {
  const cfg = HOURS[hour];
  const slot = ART_SLOTS[hour];
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Cuando exista el arte final la lámina es una <img> y no hay nada que dibujar.
    if (slot.src) return;

    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const buf = document.createElement("canvas");
    const bufCtx = buf.getContext("2d");
    if (!bufCtx) return;

    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let built = false;
    let raf: number | null = null;
    let resizeTimer: number | undefined;
    let disposed = false;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const paint = (now: number) => {
      if (!built || disposed) return;

      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      let ox = 0;
      let oy = 0;
      let scale = 1;

      if (cfg.driftSeconds && !reduceMotion.matches) {
        const p = (now / (cfg.driftSeconds * 1000)) * Math.PI * 2;
        ox = Math.cos(p) * width * 0.012;
        oy = Math.sin(p * 0.7) * height * 0.012;
        scale = 1.03;
      }

      const dw = width * scale;
      const dh = height * scale;
      ctx.drawImage(buf, (width - dw) / 2 + ox, (height - dh) / 2 + oy, dw, dh);

      for (const s of stars) {
        ctx.fillStyle = `rgba(223,233,242,${s.a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x * width + ox, s.y * height + oy, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (cfg.grain > 0) {
        const pattern = ctx.createPattern(getGrainTile(), "repeat");
        if (pattern) {
          ctx.save();
          ctx.globalAlpha = cfg.grain;
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
      }
    };

    const loop = (now: number) => {
      paint(now);
      raf = requestAnimationFrame(loop);
    };

    const build = () => {
      if (disposed) return;

      const rect = host.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      if (width < 2 || height < 2) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Densidad a 1/4: la atmósfera es de baja frecuencia, así que escalar la
      // suaviza en vez de degradarla, y el grano a resolución completa tapa el resto.
      const bw = Math.max(2, Math.round(width / 4));
      const bh = Math.max(2, Math.round(height / 4));
      buf.width = bw;
      buf.height = bh;
      bufCtx.putImageData(renderDensity(bufCtx, cfg, bw, bh), 0, 0);

      stars = makeStars(cfg, bw / bh);
      built = true;

      if (cfg.driftSeconds && !reduceMotion.matches) {
        if (raf === null) raf = requestAnimationFrame(loop);
      } else {
        paint(0);
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !built) {
            enqueue(build);
            io.disconnect();
          }
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(host);

    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (built) enqueue(build);
      }, 200);
    };
    window.addEventListener("resize", onResize);

    // Misma red de seguridad que BrandField: IntersectionObserver se apoya en el
    // pipeline de render, suspendido mientras la pestaña no compone frames. Sin
    // esto, una pestaña abierta en segundo plano se queda sin lámina.
    const kick = window.setTimeout(() => {
      if (!built && !disposed) build();
    }, 300);

    return () => {
      disposed = true;
      window.clearTimeout(kick);
      io.disconnect();
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [cfg, slot.src]);

  return (
    <div
      ref={hostRef}
      className={`${styles.plate} ${className ?? ""}`}
      data-hour={hour}
      data-slot={slot.id}
      aria-hidden="true"
    >
      {slot.src ? (
        <img src={slot.src} alt="" className={styles.art} loading="lazy" decoding="async" />
      ) : (
        <canvas ref={canvasRef} className={styles.art} />
      )}
      <div className={styles.scrim} />
    </div>
  );
}
