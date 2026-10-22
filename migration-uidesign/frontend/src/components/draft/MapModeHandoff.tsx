"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import styles from "./map-mode-handoff.module.css";

export const HANDOFF_MS = 650;
export const REDUCED_HANDOFF_MS = 180;

type HandoffState = { active: boolean; retained: boolean; sequence: number };

/** Keep the actual mode scene mounted as it fades over the confirmed map.
 * The stable wrapper and child key preserve its settled card and reel state. */
export function MapModeHandoff({ active, children }: { active: boolean; children: ReactNode }) {
  const lastActive = useRef<ReactNode>(null);
  const [handoff, setHandoff] = useState<HandoffState>({ active, retained: active, sequence: 0 });

  // Update before committing so deactivating never unmounts then recreates the
  // outgoing scene. Re-entry reuses that same subtree and cancels its exit.
  if (handoff.active !== active) {
    setHandoff({ active, retained: active || handoff.retained, sequence: handoff.sequence + 1 });
  }

  useLayoutEffect(() => {
    if (active) lastActive.current = children;
  }, [active, children]);

  useEffect(() => {
    if (active || !handoff.retained) return;
    const sequence = handoff.sequence;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? REDUCED_HANDOFF_MS : HANDOFF_MS;
    // A wall-clock deadline also finishes when CSS animation events are lost.
    const timeout = window.setTimeout(() => {
      setHandoff((current) => current.sequence === sequence && !current.active
        ? { ...current, retained: false } : current);
    }, duration);
    return () => window.clearTimeout(timeout);
  }, [active, handoff.retained, handoff.sequence]);

  if (!active && !handoff.retained) return null;

  return <div
    className={styles.host}
    style={{ "--handoff-duration": `${HANDOFF_MS}ms`, "--handoff-reduced-duration": `${REDUCED_HANDOFF_MS}ms` } as CSSProperties}
    data-mode-handoff={active ? "active" : "exiting"}
    inert={!active}
    aria-hidden={active ? undefined : true}
  >
    {active ? children : lastActive.current}
  </div>;
}
