"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./phase-transition.module.css";

/**
 * Crossfades between draft phases instead of hard-swapping components.
 *
 * The live layer renders the current phase and is keyed by `phaseKey`, so React
 * only remounts it when the phase actually changes — never on the 3s poll
 * refreshes that update the same phase in place. When the phase does change we
 * snapshot the outgoing phase's last-rendered subtree into a frozen "ghost"
 * layer and let it fade out over the top while the new phase animates in, so
 * MAPTYPEPICKING -> MAPPICKING -> BAN -> waiting all read as one continuous
 * broadcast transition rather than a jump cut.
 */
export function PhaseTransition({ phaseKey, children }: { phaseKey: string; children: ReactNode }) {
  const [ghost, setGhost] = useState<{ token: number; node: ReactNode } | null>(null);
  // The subtree committed for the current phase; kept fresh so it can be frozen
  // as the ghost the instant the phase flips.
  const committedRef = useRef<{ key: string; node: ReactNode }>({ key: phaseKey, node: children });
  const tokenRef = useRef(0);

  useEffect(() => {
    const committed = committedRef.current;
    if (committed.key !== phaseKey) {
      const token = ++tokenRef.current;
      setGhost({ token, node: committed.node });
      committedRef.current = { key: phaseKey, node: children };
      const timeout = setTimeout(() => {
        setGhost((current) => (current?.token === token ? null : current));
      }, 560);
      return () => clearTimeout(timeout);
    }
    // Same phase, live update: keep the snapshot current without any animation.
    committedRef.current = { key: phaseKey, node: children };
  }, [phaseKey, children]);

  return (
    <div className={styles.host}>
      {ghost && (
        <div key={`ghost-${ghost.token}`} className={styles.ghost} aria-hidden="true">
          {ghost.node}
        </div>
      )}
      <div key={phaseKey} className={styles.live}>
        {children}
      </div>
    </div>
  );
}
