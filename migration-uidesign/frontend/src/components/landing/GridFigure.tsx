"use client";

import { useEffect, useState, type CSSProperties } from "react";
import styles from "./landing.module.css";

export type FigureEdge = "left" | "right" | "top" | "bottom";

interface Cell {
  x: number;
  y: number;
}

interface MaskResult {
  maskUri: string;
  cutCells: Cell[];
  contourCells: Cell[];
}

interface Props {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Physical crop edges where opaque pixels touch the source canvas. */
  edges: FigureEdge[];
  /** More columns produce a finer, quieter edge treatment. */
  cols?: number;
  imgClassName?: string;
  className?: string;
}

const maskCache = new Map<string, Promise<MaskResult>>();

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to analyse image matte: ${src}`));
    image.src = src;
  });
}

function cellFor(edge: FigureEdge, axis: number, depth: number, cols: number, rows: number): Cell {
  if (edge === "left") return { x: depth, y: axis };
  if (edge === "right") return { x: cols - 1 - depth, y: axis };
  if (edge === "top") return { x: axis, y: depth };
  return { x: axis, y: rows - 1 - depth };
}

function makeRuns(values: number[]) {
  const runs: number[][] = [];
  let current: number[] = [];

  values.forEach((value) => {
    if (current.length === 0 || value === current[current.length - 1] + 1) {
      current.push(value);
      return;
    }
    runs.push(current);
    current = [value];
  });

  if (current.length > 0) runs.push(current);
  return runs;
}

function gradientFor(edge: FigureEdge, cols: number, rows: number) {
  if (edge === "left") {
    return {
      definition: '<linearGradient id="fade-left" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#080808"/><stop offset="1" stop-color="#fff"/></linearGradient>',
      rect: `<rect x="0" y="0" width="1.8" height="${rows}" fill="url(#fade-left)"/>`,
    };
  }
  if (edge === "right") {
    return {
      definition: '<linearGradient id="fade-right" x1="1" x2="0" y1="0" y2="0"><stop offset="0" stop-color="#080808"/><stop offset="1" stop-color="#fff"/></linearGradient>',
      rect: `<rect x="${cols - 1.8}" y="0" width="1.8" height="${rows}" fill="url(#fade-right)"/>`,
    };
  }
  if (edge === "top") {
    return {
      definition: '<linearGradient id="fade-top" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#080808"/><stop offset="1" stop-color="#fff"/></linearGradient>',
      rect: `<rect x="0" y="0" width="${cols}" height="1.8" fill="url(#fade-top)"/>`,
    };
  }
  return {
    definition: '<linearGradient id="fade-bottom" x1="0" x2="0" y1="1" y2="0"><stop offset="0" stop-color="#080808"/><stop offset="1" stop-color="#fff"/></linearGradient>',
    rect: `<rect x="0" y="${rows - 1.8}" width="${cols}" height="1.8" fill="url(#fade-bottom)"/>`,
  };
}

async function deriveMask(src: string, width: number, height: number, edges: FigureEdge[], cols: number) {
  const rows = Math.max(6, Math.round((cols * height) / width));
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is unavailable for image matte analysis.");

  context.clearRect(0, 0, cols, rows);
  context.drawImage(image, 0, 0, cols, rows);
  const pixels = context.getImageData(0, 0, cols, rows).data;
  const alphaAt = (x: number, y: number) => pixels[(y * cols + x) * 4 + 3];

  const cut = new Map<string, Cell>();
  const contour = new Map<string, Cell>();

  edges.forEach((edge) => {
    const axisLength = edge === "left" || edge === "right" ? rows : cols;
    const occupied: number[] = [];

    for (let axis = 0; axis < axisLength; axis += 1) {
      const edgeCell = cellFor(edge, axis, 0, cols, rows);
      if (alphaAt(edgeCell.x, edgeCell.y) > 22) occupied.push(axis);
    }

    makeRuns(occupied).forEach((run) => {
      run.forEach((axis, index) => {
        const distanceToRunEnd = Math.min(index, run.length - 1 - index);
        const structuralBeat = index > 1 && index < run.length - 2 && index % 6 === 3;
        const notchDepth = distanceToRunEnd === 0 ? 2 : distanceToRunEnd === 1 ? 1 : structuralBeat ? 1 : 0;

        for (let depth = 0; depth < notchDepth; depth += 1) {
          const cell = cellFor(edge, axis, depth, cols, rows);
          if (alphaAt(cell.x, cell.y) <= 18) continue;
          cut.set(`${cell.x}-${cell.y}`, cell);
        }

        if (notchDepth > 0) {
          const frontier = cellFor(edge, axis, notchDepth, cols, rows);
          if (alphaAt(frontier.x, frontier.y) > 28) {
            contour.set(`${frontier.x}-${frontier.y}`, frontier);
          }
        }
      });
    });
  });

  const cutCells = Array.from(cut.values());
  const contourCells = Array.from(contour.values()).filter((cell) => !cut.has(`${cell.x}-${cell.y}`));
  const gradients = edges.map((edge) => gradientFor(edge, cols, rows));
  const cutRects = cutCells.map((cell) => `<rect x="${cell.x}" y="${cell.y}" width="1" height="1" fill="#000"/>`).join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${rows}" preserveAspectRatio="none">` +
    `<defs>${gradients.map((gradient) => gradient.definition).join("")}` +
    `<mask id="matte" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="luminance">` +
    `<rect width="${cols}" height="${rows}" fill="#fff"/>` +
    gradients.map((gradient) => gradient.rect).join("") +
    cutRects +
    `</mask></defs><rect width="${cols}" height="${rows}" fill="#fff" mask="url(#matte)"/></svg>`;

  return {
    maskUri: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`,
    cutCells,
    contourCells,
  };
}

export default function GridFigure({
  src,
  alt,
  width,
  height,
  edges,
  cols = 36,
  imgClassName,
  className,
}: Props) {
  const rows = Math.max(6, Math.round((cols * height) / width));
  const [matte, setMatte] = useState<MaskResult | null>(null);

  useEffect(() => {
    let active = true;
    const key = `${src}|${width}|${height}|${cols}|${edges.join(",")}`;
    let pending = maskCache.get(key);
    if (!pending) {
      pending = deriveMask(src, width, height, edges, cols);
      maskCache.set(key, pending);
    }

    pending
      .then((result) => {
        if (active) setMatte(result);
      })
      .catch(() => {
        if (active) setMatte(null);
        maskCache.delete(key);
      });

    return () => {
      active = false;
    };
  }, [src, width, height, cols, edges]);

  const maskStyle = matte
    ? ({ WebkitMaskImage: matte.maskUri, maskImage: matte.maskUri } satisfies CSSProperties)
    : undefined;

  return (
    <div
      className={`${styles.gridFigure} ${className ?? ""}`}
      data-figure-motion
      data-matte-ready={matte ? "true" : "false"}
    >
      <div className={styles.figureAura} aria-hidden="true" />
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className={`${styles.figureImg} ${imgClassName ?? ""}`}
        style={maskStyle}
      />

      {matte ? (
        <svg
          className={styles.figureCells}
          viewBox={`0 0 ${cols} ${rows}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {matte.cutCells.map((cell) => (
            <rect
              key={`cut-${cell.x}-${cell.y}`}
              x={cell.x}
              y={cell.y}
              width="1"
              height="1"
              className={styles.figureCutCell}
            />
          ))}
          {matte.contourCells.map((cell) => (
            <rect
              key={`contour-${cell.x}-${cell.y}`}
              x={cell.x}
              y={cell.y}
              width="1"
              height="1"
              className={styles.figureContourCell}
            />
          ))}
        </svg>
      ) : null}
    </div>
  );
}
