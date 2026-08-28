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
 * A scalable, original brush-painted X. The silhouette and dry-brush gaps are
 * authored SVG geometry, so the draft never depends on the watermarked raster
 * reference and the same mark stays crisp in the grid, rails and broadcast.
 *
 * When `animated` is true, each painted half is revealed by its own mask. The
 * caller owns the timing so the central ban ceremony can keep one timeline.
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
  const initialOffset = animated ? BRUSH_REVEAL_LENGTH : 0;

  return (
    <svg
      className={[styles.brushStrike, className].filter(Boolean).join(" ")}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask id={firstMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <path
            ref={firstRevealRef}
            d="M 7 9 C 31 31, 65 64, 94 92"
            fill="none"
            stroke="#fff"
            strokeWidth="28"
            strokeLinecap="round"
            pathLength={BRUSH_REVEAL_LENGTH}
            strokeDasharray={BRUSH_REVEAL_LENGTH}
            strokeDashoffset={initialOffset}
          />
        </mask>
        <mask id={secondMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <path
            ref={secondRevealRef}
            d="M 93 8 C 69 30, 39 61, 8 93"
            fill="none"
            stroke="#fff"
            strokeWidth="28"
            strokeLinecap="round"
            pathLength={BRUSH_REVEAL_LENGTH}
            strokeDasharray={BRUSH_REVEAL_LENGTH}
            strokeDashoffset={initialOffset}
          />
        </mask>
      </defs>

      <g mask={`url(#${firstMaskId})`}>
        <path
          className={styles.brushStrikePaint}
          fillRule="evenodd"
          d="M 7.1 8.7 C 9.5 5.8 13.7 5.9 17.4 8.5 L 94.2 80.1 C 97.3 83 97.1 88.1 94 91.8 C 90.9 95.3 86.2 95.2 82.6 92.1 L 7.9 22 C 3.9 18.3 4.1 12.5 7.1 8.7 Z M 25.1 23.8 C 27.1 23.8 30.5 26.4 33.2 29.4 L 31.1 30.3 C 28.4 28.3 26.4 26.4 25.1 23.8 Z M 55.8 54.2 C 59.3 55.8 64.5 61 67.2 64.7 L 64.6 65.3 C 61.2 62.8 58.1 59.1 55.8 54.2 Z M 74.2 72.5 C 78.1 74.4 82.1 78.6 84.9 82.1 L 82.1 82.9 C 78.9 80.6 76.5 77.7 74.2 72.5 Z"
        />
        <path
          className={styles.brushStrikePaint}
          d="M 3.9 16.3 C 5.2 14.9 6.7 15.2 7.5 17.2 C 6.2 18.8 4.8 18.4 3.9 16.3 Z M 12.4 4.9 C 14.2 3.8 16.8 5.1 17.2 6.7 C 15 6.5 13.3 6 12.4 4.9 Z M 89.5 94 C 92.1 94 94 95.4 94.2 97 C 91.8 97.4 90 96.2 89.5 94 Z M 68.7 72.1 C 70.7 71.7 72.8 73.5 73.5 75.2 C 71.5 75 69.6 73.9 68.7 72.1 Z"
        />
      </g>

      <g mask={`url(#${secondMaskId})`}>
        <path
          className={styles.brushStrikePaint}
          fillRule="evenodd"
          d="M 83.8 6.5 C 87.4 3.9 92.2 5.3 95 8.7 C 97.8 12.2 97 17 93.4 20.5 L 19.7 94.9 C 16.3 98.1 11 97.6 7.6 94.5 C 4.3 91.3 4.8 86.2 8.1 82.8 L 79.1 10.8 C 80.6 9.2 82.2 7.7 83.8 6.5 Z M 75.2 18.7 C 78.5 15.1 80.8 12.8 84.1 11.1 C 82.4 14.8 79.4 18 76.7 20.2 Z M 52.4 44.1 C 55.2 39.8 59.1 36.8 62.8 34.4 C 61.1 38.7 56.9 42.8 53.7 45.9 Z M 26.2 72.6 C 29 67.8 33.1 63.8 36.8 61.9 C 34.5 66.4 30.8 70.8 27.5 73.8 Z"
        />
        <path
          className={styles.brushStrikePaint}
          d="M 93.4 5.8 C 95.7 5.5 97.3 7 96.8 9.1 C 94.8 9.1 93.4 8 93.4 5.8 Z M 95.3 18.7 C 98 18.3 99.2 19.8 98.6 21.9 C 96.2 22.1 95.1 20.8 95.3 18.7 Z M 4.3 86 C 6.1 84.5 7.7 85.6 7.8 87.7 C 5.9 89 4.4 88.1 4.3 86 Z M 11.1 96.2 C 13.3 95.8 15.2 97.1 15.2 98.6 C 12.9 99 11.5 98.2 11.1 96.2 Z M 36 58.1 C 37.8 55.9 40.1 54.1 42.6 53.1 C 41.2 55.7 39.2 57.7 36.8 59 Z"
        />
      </g>
    </svg>
  );
}
