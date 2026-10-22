"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { clsx } from "clsx";
import styles from "./phase-transition.module.css";

const TRANSITION_MS = 980;
const REDUCED_TRANSITION_MS = 180;

type Scene = { key: string; node: ReactNode; height: number };
type Transition = { key: string; outgoing: Scene | null; sequence: number };

const PHASE_LABELS: Record<string, string> = {
  STARTING: "Draft ready",
  MAPTYPEPICKING: "Choose a mode",
  MAPPICKING: "Map selection",
  "MAPPICKING:LOCKED": "Map locked",
  BAN: "Hero bans",
  PLAYING: "Game live",
  ENDMAP: "Map complete",
  FINISHED: "Series complete",
};

/** Keep the last committed phase mounted for the broadcast handoff. Its keyed
 * wrapper changes from live to outgoing in the same parent, so React preserves
 * the real subtree instead of mounting a second, state-resetting copy. */
export function PhaseTransition({ phaseKey, children, instant = false }: { phaseKey: string; children: ReactNode; instant?: boolean }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const committed = useRef<Scene>({ key: phaseKey, node: children, height: 0 });
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
      outgoing: instant || committed.current.key === phaseKey ? null : committed.current,
      sequence: transition.sequence + 1,
    });
  }

  useLayoutEffect(() => {
    committed.current = { key: phaseKey, node: children, height: sceneRef.current?.offsetHeight ?? 0 };
  }, [phaseKey, children]);

  // Keep the last real layout height, including late-loading art. offsetHeight
  // stays in logical pixels when OBS scales the enclosing 1920×1080 canvas.
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const measure = () => {
      if (committed.current.key === phaseKey) committed.current.height = scene.offsetHeight;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scene);
    return () => observer.disconnect();
  }, [phaseKey]);

  useEffect(() => {
    if (!transition.outgoing) return;
    const sequence = transition.sequence;
    if (instant) {
      setTransition((current) => current.sequence === sequence ? { ...current, outgoing: null } : current);
      return;
    }
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? REDUCED_TRANSITION_MS : TRANSITION_MS;
    const timeout = window.setTimeout(() => {
      setTransition((current) =>
        current.sequence === sequence ? { ...current, outgoing: null } : current
      );
    }, duration);
    return () => window.clearTimeout(timeout);
  }, [instant, transition.outgoing, transition.sequence]);

  // A dedicated full-screen mode scene owns this handoff, including its card
  // flight. A second wipe underneath it would clip or duplicate that flight.
  const outgoing = !instant && transition.key === phaseKey ? transition.outgoing : null;

  // DraftStage's real three-column children enter separately. Annotating the
  // existing nodes preserves their state and avoids coupling to CSS-module hashes.
  useLayoutEffect(() => {
    if (!outgoing || !sceneRef.current) return;
    const stage = sceneRef.current.querySelector("[data-draft-stage]");
    if (!stage) return;
    const panels = Array.from(stage.children);
    panels.forEach((panel, index) => panel.setAttribute("data-phase-panel", ["left", "center", "right"][index]));
    return () => panels.forEach((panel) => panel.removeAttribute("data-phase-panel"));
  }, [phaseKey, transition.sequence, Boolean(outgoing)]);

  const fromLabel = outgoing ? PHASE_LABELS[outgoing.key] : undefined;
  const toLabel = PHASE_LABELS[phaseKey];

  return (
    <div
      className={styles.host}
      style={outgoing?.height ? { minHeight: outgoing.height, "--phase-duration": `${TRANSITION_MS}ms` } as CSSProperties : undefined}
      data-phase={phaseKey.split(":")[0]}
      data-transitioning={outgoing ? "true" : "false"}
    >
      {outgoing && (
        <div key={outgoing.key} className={styles.outgoing} aria-hidden="true" inert>
          {outgoing.node}
        </div>
      )}
      <div ref={sceneRef} key={phaseKey} className={clsx(styles.scene, outgoing && styles.incoming)} inert={Boolean(outgoing)} aria-hidden={outgoing ? true : undefined}>
        {children}
      </div>
      {outgoing && (
        <div key={`handoff-${transition.sequence}`} className={styles.handoff} aria-hidden="true">
          <div className={styles.wash} />
          {toLabel && <div className={styles.cue}>
            {fromLabel && <span className={styles.fromLabel}>{fromLabel}</span>}
            <strong className={styles.phaseLabel}>{toLabel}</strong>
            <span className={styles.cueDetail}>GGL Tournament</span>
          </div>}
        </div>
      )}
    </div>
  );
}
