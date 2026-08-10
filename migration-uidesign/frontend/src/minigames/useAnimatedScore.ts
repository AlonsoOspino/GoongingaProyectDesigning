"use client";

import { useEffect, useRef, useState } from "react";

export function useAnimatedScore(target: number, delay = 0, duration = 900) {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);

  useEffect(() => {
    let frame = 0;
    let timeout = 0;
    const from = displayRef.current;
    const difference = target - from;

    timeout = window.setTimeout(() => {
      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const next = Math.round(from + difference * eased);
        displayRef.current = next;
        setDisplay(next);
        if (progress < 1) frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      window.cancelAnimationFrame(frame);
    };
  }, [delay, duration, target]);

  return display;
}
