"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./broadcast.module.css";

/** Keep broadcast layout at 1920×1080, including inside a one-monitor preview. */
export function BroadcastFrame({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = () => setScale(Math.min(element.clientWidth / 1920, element.clientHeight / 1080));
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`${styles.frame} casting-full-frame`}><div className={styles.canvas} style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>{children}</div></div>;
}
