"use client";

import { useId, type Ref } from "react";
import styles from "./draft-stage.module.css";

export const BRUSH_REVEAL_LENGTH = 100;

/*
 * Cross-drag scale for the whole mark. This is the one dial for how thick the X
 * reads: it narrows how far the hairs splay from the centreline and how fat the
 * spine is. The bristle character (each hair's own width, span and start) and
 * the turbulence relief are untouched, so the texture and the frayed edge stay
 * exactly as they were — the mark just gets slimmer. 1 = the original width.
 */
const WIDTH_SCALE = 0.6;

type BrushStrikeProps = {
  className?: string;
  animated?: boolean;
  firstRevealRef?: Ref<SVGPathElement>;
  secondRevealRef?: Ref<SVGPathElement>;
};

/*
 * A painted X.
 *
 * What was missing was the bristles. A stroke with a roughened outline reads as
 * a chewed marker, because the thing that makes a brush look like a brush is
 * not its silhouette — it is the streaking along the drag, and the way the hairs
 * splay apart at the ends where the pressure goes.
 *
 * So the mark is built the way the tool works:
 *
 *   SPINE    one narrow pass down the centre, so the middle of the drag can
 *            never go transparent. Nothing else is solid.
 *
 *   HAIRS    twenty strokes packed across the width, each offset sideways from
 *            the centreline and each biting and running dry at its own point
 *            along the path. Their overlap is what builds the body; the ones
 *            near the rim run out sooner, which draws the streaks along the
 *            drag and opens the ends into a splay.
 *
 *   EDGE     turbulence displacement over the finished mark, which frays the
 *            outline without touching the structure underneath.
 *
 * The filter deliberately wraps the masks rather than sitting inside them: when
 * it was inside, every frame of the reveal recomputed the displacement and the
 * ends of the strokes visibly jittered.
 */

/** Rough unit normals for the two diagonals, used to offset each hair sideways. */
const STROKES = [
  {
    d: "M 9 11 C 33 33, 63 61, 91 89",
    normal: [-0.707, 0.707] as const,
  },
  {
    d: "M 91 10 C 67 32, 37 62, 10 90",
    normal: [0.707, 0.707] as const,
  },
];

/*
 * One narrow spine so the centre of the drag can never go transparent, and
 * nothing more: the width of the mark comes from the hairs below.
 */
const BODY_PASSES = [{ width: 9, span: 86, opacity: 1 }];

/*
 * The ferrule, hair by hair. Packed edge to edge so the overlap builds an
 * opaque core, thinning and running out earlier towards the rim — which is
 * what draws the streaks along the drag and opens the ends into a splay.
 *
 * offset  distance sideways from the centreline, in viewBox units
 * span    how much of the path this hair covers before its paint runs out
 * start   where along the path it first bites
 */
const HAIRS = [
  { offset: -11.92, span: 37.3, start: 37.1, width: 1.28, opacity: 0.65 },
  { offset: -11, span: 48.4, start: 6.4, width: 1.4, opacity: 0.68 },
  { offset: -10.37, span: 37.4, start: 38.8, width: 1.77, opacity: 0.67 },
  { offset: -9.63, span: 71.3, start: 4.2, width: 1.25, opacity: 0.59 },
  { offset: -8.83, span: 68.1, start: 5.3, width: 1.49, opacity: 0.81 },
  { offset: -7.7, span: 51.1, start: 7.4, width: 1.34, opacity: 0.81 },
  { offset: -6.69, span: 53.6, start: 36.3, width: 1.47, opacity: 0.75 },
  { offset: -5.86, span: 86.8, start: 6.1, width: 1.89, opacity: 0.77 },
  { offset: -5.08, span: 80.4, start: 0.5, width: 1.42, opacity: 0.89 },
  { offset: -4.57, span: 85.6, start: 1.3, width: 2.39, opacity: 0.84 },
  { offset: -3.44, span: 46.7, start: 32.7, width: 2.52, opacity: 0.91 },
  { offset: -2.89, span: 90.9, start: 0.4, width: 2.4, opacity: 0.84 },
  { offset: -1.97, span: 88.3, start: 1.2, width: 2.41, opacity: 0.95 },
  { offset: -1.06, span: 96.1, start: 0.8, width: 2.51, opacity: 0.94 },
  { offset: -0.04, span: 97.5, start: 0.1, width: 1.84, opacity: 0.93 },
  { offset: 0.52, span: 92.3, start: 0, width: 2.68, opacity: 0.87 },
  { offset: 1.67, span: 96.5, start: 1, width: 2.72, opacity: 0.89 },
  { offset: 2.28, span: 56.8, start: 6.9, width: 2.67, opacity: 0.88 },
  { offset: 3.53, span: 89.9, start: 0.4, width: 2.4, opacity: 0.79 },
  { offset: 4.17, span: 90.5, start: 2.2, width: 2, opacity: 0.81 },
  { offset: 5.07, span: 87.9, start: 0.5, width: 1.84, opacity: 0.8 },
  { offset: 5.94, span: 44.3, start: 7.3, width: 2.35, opacity: 0.72 },
  { offset: 6.5, span: 80.5, start: 2.8, width: 2.25, opacity: 0.76 },
  { offset: 7.62, span: 74.7, start: 1.3, width: 1.62, opacity: 0.75 },
  { offset: 8.62, span: 66, start: 8.9, width: 1.5, opacity: 0.75 },
  { offset: 9.37, span: 69.2, start: 3.6, width: 1.41, opacity: 0.69 },
  { offset: 9.93, span: 56.8, start: 11.6, width: 1.41, opacity: 0.73 },
  { offset: 10.99, span: 58.8, start: 1.7, width: 1.63, opacity: 0.77 },
  { offset: 11.83, span: 56.1, start: 4.9, width: 1.23, opacity: 0.56 },
];

export function BrushStrike({
  className,
  animated = false,
  firstRevealRef,
  secondRevealRef,
}: BrushStrikeProps) {
  const instanceId = useId().replace(/:/g, "");
  const maskIds = [`brush-a-${instanceId}`, `brush-b-${instanceId}`];
  const bristleFilterId = `brush-bristles-${instanceId}`;
  const initialOffset = animated ? BRUSH_REVEAL_LENGTH : 0;

  const painted = (stroke: (typeof STROKES)[number], key: string) => {
    const [nx, ny] = stroke.normal;

    return (
      <g key={key}>
        {BODY_PASSES.map((pass, index) => (
          <path
            key={`body-${index}`}
            className={styles.brushStrokePass}
            d={stroke.d}
            strokeWidth={pass.width * WIDTH_SCALE}
            opacity={pass.opacity}
            pathLength={BRUSH_REVEAL_LENGTH}
            strokeDasharray={`${pass.span} ${BRUSH_REVEAL_LENGTH}`}
            strokeDashoffset={-(BRUSH_REVEAL_LENGTH - pass.span) / 2}
          />
        ))}

        {HAIRS.map((hair, index) => (
          <path
            key={`hair-${index}`}
            className={styles.brushHair}
            d={stroke.d}
            transform={`translate(${(nx * hair.offset * WIDTH_SCALE).toFixed(2)} ${(ny * hair.offset * WIDTH_SCALE).toFixed(2)})`}
            strokeWidth={hair.width}
            opacity={hair.opacity}
            pathLength={BRUSH_REVEAL_LENGTH}
            strokeDasharray={`${hair.span} ${BRUSH_REVEAL_LENGTH}`}
            strokeDashoffset={-hair.start}
          />
        ))}
      </g>
    );
  };

  const revealPath = (d: string, ref?: Ref<SVGPathElement>) => (
    <path
      ref={ref}
      d={d}
      fill="none"
      stroke="#fff"
      // Wide enough to clear the outermost hair plus the displacement.
      strokeWidth="52"
      // Butt, never round: a round cap on an empty dash renders as a dot.
      strokeLinecap="butt"
      pathLength={BRUSH_REVEAL_LENGTH}
      strokeDasharray={BRUSH_REVEAL_LENGTH}
      strokeDashoffset={initialOffset}
    />
  );

  return (
    <svg
      className={[styles.brushStrike, className].filter(Boolean).join(" ")}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/*
          userSpaceOnUse so the bristle scale is fixed in viewBox units. Under
          the default bounding-box units it changed with every tile size, and
          this SVG is stretched by preserveAspectRatio="none".
        */}
        <filter
          id={bristleFilterId}
          filterUnits="userSpaceOnUse"
          x="-16"
          y="-16"
          width="132"
          height="132"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.1 0.05"
            numOctaves="3"
            seed="23"
            result="grain"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="grain"
            scale="7"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {STROKES.map((stroke, index) => (
          <mask
            key={maskIds[index]}
            id={maskIds[index]}
            maskUnits="userSpaceOnUse"
            x="-16"
            y="-16"
            width="132"
            height="132"
          >
            {revealPath(stroke.d, index === 0 ? firstRevealRef : secondRevealRef)}
          </mask>
        ))}
      </defs>

      <g filter={`url(#${bristleFilterId})`}>
        {STROKES.map((stroke, index) => (
          <g key={maskIds[index]} mask={`url(#${maskIds[index]})`}>
            {painted(stroke, `paint-${index}`)}
          </g>
        ))}
      </g>
    </svg>
  );
}
