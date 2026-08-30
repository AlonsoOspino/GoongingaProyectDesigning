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

/**
 * A painted X.
 *
 * The previous version carved dry-brush gaps out of the silhouette with
 * evenodd sub-paths, which read as random holes punched in the middle of the
 * mark rather than as paint. This builds the same idea the other way round:
 *
 *   - a solid core stroke, drawn straight, so the body of the paint can never
 *     have a hole in it;
 *   - a slightly wider stroke behind it, run through a turbulence displacement
 *     filter, which frays only the outline into the uneven edge a loaded brush
 *     leaves.
 *
 * Everything else about the mark stays: authored geometry, no raster
 * dependency, and one reveal mask per half so the caller keeps the timing.
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
  const edgeFilterId = `brush-edge-${instanceId}`;
  const initialOffset = animated ? BRUSH_REVEAL_LENGTH : 0;

  // The two diagonals. Gentle curves rather than straight rules: a brush drags.
  const firstStroke = "M 8 10 C 32 32, 64 62, 92 90";
  const secondStroke = "M 92 9 C 68 31, 36 62, 9 91";

  const revealPath = (d: string, ref?: Ref<SVGPathElement>) => (
    <path
      ref={ref}
      d={d}
      fill="none"
      stroke="#fff"
      strokeWidth="30"
      strokeLinecap="round"
      pathLength={BRUSH_REVEAL_LENGTH}
      strokeDasharray={BRUSH_REVEAL_LENGTH}
      strokeDashoffset={initialOffset}
    />
  );

  const paintedStroke = (d: string) => (
    <>
      <path className={styles.brushStrikeEdge} d={d} filter={`url(#${edgeFilterId})`} />
      <path className={styles.brushStrikeCore} d={d} />
    </>
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
          Low frequency on purpose. Higher values shred the outline into noise;
          this keeps recognisable bristle-scale irregularity.
        */}
        <filter id={edgeFilterId} x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.055 0.11"
            numOctaves="2"
            seed="11"
            result="bristles"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="bristles"
            scale="4.5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        <mask id={firstMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          {revealPath(firstStroke, firstRevealRef)}
        </mask>
        <mask id={secondMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          {revealPath(secondStroke, secondRevealRef)}
        </mask>
      </defs>

      <g mask={`url(#${firstMaskId})`}>{paintedStroke(firstStroke)}</g>
      <g mask={`url(#${secondMaskId})`}>{paintedStroke(secondStroke)}</g>
    </svg>
  );
}
