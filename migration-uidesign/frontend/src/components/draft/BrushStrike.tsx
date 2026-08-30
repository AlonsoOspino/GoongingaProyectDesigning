"use client";

import { useId, type Ref } from "react";
import styles from "./draft-stage.module.css";

export const BRUSH_REVEAL_LENGTH = 100;

type BrushStrikeProps = {
  className?: string;
  animated?: boolean;
  firstRevealRef?: Ref<SVGPathElement>;
  secondRevealRef?: Ref<SVGPathElement>;
};

/*
 * A painted X.
 *
 * Two problems with the previous attempts, both fixed here.
 *
 * The look. A single even stroke reads as a marker, not a brush. A real one is
 * thin where the bristles land and lift and fat through the middle of the drag,
 * so each diagonal is three concentric strokes: the full length thin, then
 * shorter and wider, then shorter and widest. Overlapped they form a lens that
 * tapers at both ends, and the turbulence filter frays the outline into
 * bristles. No holes are carved anywhere — the body is solid by construction.
 *
 * The bug. The filter used to sit inside the masked group, so every frame of
 * the reveal re-rendered the displacement and the ends of the strokes flickered
 * and jumped. The filter now wraps the finished mark and the mask wipes that
 * stable result. The reveal stroke also uses butt caps: a round cap on a
 * zero-length dash paints a disc, which is what put a blob of paint on screen
 * before the animation had started.
 */
export function BrushStrike({
  className,
  animated = false,
  firstRevealRef,
  secondRevealRef,
}: BrushStrikeProps) {
  const instanceId = useId().replace(/:/g, "");
  const firstMaskId = `brush-strike-a-${instanceId}`;
  const secondMaskId = `brush-strike-b-${instanceId}`;
  const bristleFilterId = `brush-bristles-${instanceId}`;
  const initialOffset = animated ? BRUSH_REVEAL_LENGTH : 0;

  // Slightly bowed, because a dragged brush does not travel in a straight line.
  const firstStroke = "M 9 11 C 33 33, 63 61, 91 89";
  const secondStroke = "M 91 10 C 67 32, 37 62, 10 90";

  /*
   * Concentric passes. Each is centred on the same path and drawn shorter than
   * the last using the dash pattern, which is what produces the taper without
   * needing hand-authored outline geometry.
   */
  const passes = [
    { width: 6.5, span: 100, opacity: 0.92 },
    { width: 11, span: 82, opacity: 0.97 },
    { width: 14, span: 56, opacity: 1 },
  ];

  const paintedStroke = (d: string, key: string) => (
    <g key={key}>
      {passes.map((pass, index) => (
        <path
          key={index}
          className={styles.brushStrokePass}
          d={d}
          strokeWidth={pass.width}
          opacity={pass.opacity}
          pathLength={BRUSH_REVEAL_LENGTH}
          strokeDasharray={`${pass.span} ${BRUSH_REVEAL_LENGTH}`}
          strokeDashoffset={-(BRUSH_REVEAL_LENGTH - pass.span) / 2}
        />
      ))}
    </g>
  );

  const revealPath = (d: string, ref?: Ref<SVGPathElement>) => (
    <path
      ref={ref}
      d={d}
      fill="none"
      stroke="#fff"
      strokeWidth="34"
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
          userSpaceOnUse so the bristle scale is fixed in viewBox units. With the
          default bounding-box units it changed with every tile size, and this
          SVG is stretched by preserveAspectRatio="none".
        */}
        <filter
          id={bristleFilterId}
          filterUnits="userSpaceOnUse"
          x="-12"
          y="-12"
          width="124"
          height="124"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.09 0.16"
            numOctaves="3"
            seed="17"
            result="bristles"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="bristles"
            scale="6"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        <mask id={firstMaskId} maskUnits="userSpaceOnUse" x="-12" y="-12" width="124" height="124">
          {revealPath(firstStroke, firstRevealRef)}
        </mask>
        <mask id={secondMaskId} maskUnits="userSpaceOnUse" x="-12" y="-12" width="124" height="124">
          {revealPath(secondStroke, secondRevealRef)}
        </mask>
      </defs>

      {/* Filter outside the masks: the bristles are computed once and the
          reveal simply wipes a finished mark. */}
      <g filter={`url(#${bristleFilterId})`}>
        <g mask={`url(#${firstMaskId})`}>{paintedStroke(firstStroke, "a")}</g>
        <g mask={`url(#${secondMaskId})`}>{paintedStroke(secondStroke, "b")}</g>
      </g>
    </svg>
  );
}
