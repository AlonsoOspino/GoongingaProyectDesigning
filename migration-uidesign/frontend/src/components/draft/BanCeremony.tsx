"use client";

import { useEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import { resolveHeroImageUrl } from "@/lib/assetUrls";
import { teamVars, type TeamSide } from "./DraftStage";
import { BRUSH_REVEAL_LENGTH, BrushStrike } from "./BrushStrike";

/** How much longer the ban plays than it used to. 1.5 = 50% slower. */
const BAN_SLOWDOWN = 1.5;
import styles from "./draft-stage.module.css";

export type BanCeremonyRequest = {
  /** Unique per ban, so banning the same hero in a later game still plays. */
  key: string;
  heroName: string;
  imgPath: string | null;
  teamName: string;
  side: TeamSide;
  teamId: number;
  slotIndex: number;
};

/**
 * The ban, staged.
 *
 * A ban is the loudest thing that happens in a draft, so it plays out in the
 * middle of the board rather than in a corner: the hero comes up large, takes
 * an X across the face, is named along with the team that spent the ban, and
 * only then flies out to that team's rail. One announcement, one motion, and
 * the board is never covered by a second notification competing with it.
 *
 * Geometry is measured against `containerRef` rather than the viewport: the
 * broadcast view renders the draft into a canvas it scales with a CSS
 * transform, so viewport pixels and layout pixels differ by that factor.
 */
export function BanCeremony({
  request,
  containerRef,
  onComplete,
}: {
  request: BanCeremonyRequest | null;
  containerRef: RefObject<HTMLElement | null>;
  onComplete: (key: string) => void;
}) {
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const kickerRef = useRef<HTMLParagraphElement | null>(null);
  const portraitRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const strokeOneRef = useRef<SVGPathElement | null>(null);
  const strokeTwoRef = useRef<SVGPathElement | null>(null);
  const captionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!request) return;

    const scrim = scrimRef.current;
    const portrait = portraitRef.current;
    if (!scrim || !portrait) {
      onComplete(request.key);
      return;
    }

    const finish = () => onComplete(request.key);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const revealPaths = [strokeOneRef.current, strokeTwoRef.current].filter(Boolean);
      gsap.set(revealPaths, { strokeDashoffset: 0 });
      if (imageRef.current) gsap.set(imageRef.current, { filter: "grayscale(1) brightness(0.65)" });
      const hold = window.setTimeout(finish, 1400 * BAN_SLOWDOWN);
      return () => window.clearTimeout(hold);
    }

    const context = gsap.context(() => {
      // Half again as long. Scaling the timeline keeps every beat in the same
      // relative place instead of drifting the choreography apart.
      const timeline = gsap.timeline({ onComplete: finish });
      timeline.timeScale(1 / BAN_SLOWDOWN);

      timeline
        .fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: "power2.out" })
        // Hero lands hard rather than easing in politely.
        .fromTo(
          portrait,
          { scale: 1.45, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.34, ease: "power4.out" },
          0
        )
        .fromTo(
          kickerRef.current,
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.26, ease: "power2.out" },
          0.16
        );

      // The strike: two red paint strokes and a physical kick.
      timeline
        .fromTo(
          strokeOneRef.current,
          { strokeDashoffset: BRUSH_REVEAL_LENGTH },
          { strokeDashoffset: 0, duration: 0.19, ease: "power2.inOut" },
          0.44
        )
        .fromTo(
          portrait,
          { x: 0 },
          { keyframes: [{ x: -9 }, { x: 7 }, { x: -3 }, { x: 0 }], duration: 0.3, ease: "power2.out" },
          0.44
        )
        .fromTo(
          strokeTwoRef.current,
          { strokeDashoffset: BRUSH_REVEAL_LENGTH },
          { strokeDashoffset: 0, duration: 0.19, ease: "power2.inOut" },
          0.61
        )
        // Lights out on the hero.
        .to(imageRef.current, { filter: "grayscale(1) brightness(0.65)", duration: 0.4 }, 0.64)
        .fromTo(
          captionRef.current,
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.3, ease: "power2.out" },
          0.7
        );

      // Then it leaves for the rail that now owns it. Values are functions so
      // GSAP measures the slot when this leg starts, not when the timeline is
      // built — the rail may still be laying out at that point.
      const flightAt = 1.95;
      timeline
        .to(captionRef.current, { opacity: 0, y: -10, duration: 0.24, ease: "power2.in" }, flightAt - 0.1)
        .to(kickerRef.current, { opacity: 0, duration: 0.24, ease: "power2.in" }, flightAt - 0.1)
        .to(
          portrait,
          {
            x: () => measure(request, containerRef, portraitRef)?.dx ?? 0,
            y: () => measure(request, containerRef, portraitRef)?.dy ?? 0,
            scale: () => measure(request, containerRef, portraitRef)?.scale ?? 0.3,
            duration: 0.55,
            ease: "power3.inOut",
          },
          flightAt
        )
        .to(scrim, { opacity: 0, duration: 0.3, ease: "power2.in" }, flightAt + 0.25)
        .to(portrait, { opacity: 0, duration: 0.2, ease: "power2.in" }, flightAt + 0.4);
    });

    return () => context.revert();
  }, [request, containerRef, onComplete]);

  if (!request) return null;

  return (
    <div ref={scrimRef} className={styles.ceremony} style={teamVars(request.side)} role="status">
      <div className={styles.ceremonyStack}>
        <p ref={kickerRef} className={styles.ceremonyKicker}>
          Hero banned
        </p>

        <div ref={portraitRef} className={styles.ceremonyPortrait}>
          {request.imgPath && (
            <img ref={imageRef} src={resolveHeroImageUrl(request.imgPath)} alt="" />
          )}
          <BrushStrike
            className={styles.ceremonyX}
            animated
            firstRevealRef={strokeOneRef}
            secondRevealRef={strokeTwoRef}
          />
        </div>

        <div ref={captionRef} className={styles.ceremonyStack}>
          <p className={styles.ceremonyName}>{request.heroName}</p>
          <p className={styles.ceremonyTeam}>
            Banned by <span className={styles.ceremonyTeamName}>{request.teamName}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Where the portrait has to travel to land on its rail slot, in layout px. */
function measure(
  request: BanCeremonyRequest,
  containerRef: RefObject<HTMLElement | null>,
  portraitRef: RefObject<HTMLDivElement | null>
) {
  const container = containerRef.current;
  const portrait = portraitRef.current;
  const target = document.querySelector<HTMLElement>(
    `[data-ban-slot="${request.teamId}-${request.slotIndex}"]`
  );
  if (!container || !portrait || !target) return null;

  const containerRect = container.getBoundingClientRect();
  // Layout pixels per viewport pixel — 1 unless an ancestor is scaled.
  const scale = container.offsetWidth ? containerRect.width / container.offsetWidth : 1;
  if (!scale) return null;

  // `from` already carries whatever transform the timeline has applied, so the
  // travel is expressed as an offset from the current x/y rather than absolute.
  const from = portrait.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (!from.width || !to.width || !portrait.offsetWidth) return null;

  const currentX = (gsap.getProperty(portrait, "x") as number) || 0;
  const currentY = (gsap.getProperty(portrait, "y") as number) || 0;

  return {
    dx: currentX + (to.left + to.width / 2 - (from.left + from.width / 2)) / scale,
    dy: currentY + (to.top + to.height / 2 - (from.top + from.height / 2)) / scale,
    // Shrink so the portrait's painted width matches the slot's.
    scale: to.width / (portrait.offsetWidth * scale),
  };
}
