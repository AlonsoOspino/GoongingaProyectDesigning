"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import styles from "./phase-transition.module.css";

const TRANSITION_MS = 480;

type Scene = { key: string; node: ReactNode };
type Transition = { key: string; outgoing: Scene | null; sequence: number };

/** Keep the last committed phase mounted for the broadcast wipe. Its keyed
 * wrapper changes from live to outgoing in the same parent, so React preserves
 * the real subtree instead of mounting a second, state-resetting copy. */
export function PhaseTransition({ phaseKey, children }: { phaseKey: string; children: ReactNode }) {
  const committed = useRef<Scene>({ key: phaseKey, node: children });
  const [transition, setTransition] = useState<Transition>({
    key: phaseKey,
    outgoing: null,
    sequence: 0,
  });

  // Derive the change before committing the new tree. An effect would first
  // unmount the old phase, then remount it as the outgoing layer.
  if (transition.key !== phaseKey) {
    setTransition({
      key: phaseKey,
      outgoing: committed.current.key === phaseKey ? null : committed.current,
      sequence: transition.sequence + 1,
    });
  }

  useLayoutEffect(() => {
    committed.current = { key: phaseKey, node: children };
  }, [phaseKey, children]);

  useEffect(() => {
    if (!transition.outgoing) return;
    const sequence = transition.sequence;
    const timeout = window.setTimeout(() => {
      setTransition((current) =>
        current.sequence === sequence ? { ...current, outgoing: null } : current
      );
    }, TRANSITION_MS);
    return () => window.clearTimeout(timeout);
  }, [transition.outgoing, transition.sequence]);

  const outgoing = transition.key === phaseKey ? transition.outgoing : null;

  return (
    <div className={styles.host} data-phase={phaseKey.split(":")[0]} data-transitioning={outgoing ? "true" : "false"}>
      {outgoing && (
        <div key={outgoing.key} className={styles.outgoing} aria-hidden="true" inert>
          {outgoing.node}
        </div>
      )}
      <div key={phaseKey} className={clsx(styles.scene, outgoing && styles.incoming)}>
        {children}
      </div>
      {outgoing && <span className={styles.signal} aria-hidden="true" />}
    </div>
  );
}
