"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { clsx } from "clsx";
import type { GameMap } from "@/lib/api/types";
import { resolveMapImageUrl } from "@/lib/assetUrls";
import { MapImage } from "./MapImage";
import { MapTypeIcon, MAP_TYPE_LABEL } from "./MapTypePlate";
import styles from "./map-selection-reveal.module.css";

export interface MapSelectionOrigin { left: number; top: number; width: number; height: number; aspectRatio?: number }

export function getMapSelectionIntroMs(description: string) {
  const wordCount = description.trim().split(/\s+/).length;
  return Math.max(1800, 1290 + (wordCount - 1) * 85);
}

/** Read before the confirmed draft replaces the map pool, including on viewers. */
export function measureMapCard(mapId: number): MapSelectionOrigin | undefined {
  const card = document.querySelector<HTMLElement>(`[data-map-option-id="${mapId}"]`);
  const rect = card?.getBoundingClientRect();
  const image = card?.querySelector("img");
  return rect && rect.width > 0 && rect.height > 0
    ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height, aspectRatio: image?.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : undefined }
    : undefined;
}

/** The actual selected artwork moves into its final frame, then introduces its name. */
export function MapSelectionReveal({
  map, gameNumber, broadcast = false, animate = false, origin, children,
}: {
  map: GameMap;
  gameNumber: number;
  broadcast?: boolean;
  animate?: boolean;
  origin?: MapSelectionOrigin;
  children?: ReactNode;
}) {
  const revealRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [introducing, setIntroducing] = useState(animate);
  const originRef = useRef(origin);
  originRef.current = origin;
  const titleWords = map.description.trim().split(/\s+/);
  const introDuration = getMapSelectionIntroMs(map.description);

  useEffect(() => {
    if (!animate) { setIntroducing(false); return; }
    setIntroducing(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(() => {
      setIntroducing(false);
      // The chosen card is now gone. Continue keyboard reading at its verdict,
      // unless the user already moved focus elsewhere during the transition.
      if (!broadcast && document.activeElement === document.body) headingRef.current?.focus({ preventScroll: true });
    }, reduced ? 180 : introDuration);
    return () => window.clearTimeout(timeout);
  }, [animate, map.id, gameNumber, broadcast, introDuration]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const image = frame?.querySelector("img");
    if (!frame || !image) return;
    const reserveArtwork = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) revealRef.current?.style.setProperty("--selected-map-ratio", String(image.naturalWidth / image.naturalHeight));
    };
    reserveArtwork();
    image.addEventListener("load", reserveArtwork);
    return () => image.removeEventListener("load", reserveArtwork);
  }, [map.id, map.imgPath]);

  // Operator chrome and the developer toolbar consume real viewport height.
  // Fit the whole composition, rather than cropping a large map below the fold.
  useLayoutEffect(() => {
    const reveal = revealRef.current;
    if (!reveal || broadcast) return;
    const fit = () => {
      const box = reveal.getBoundingClientRect();
      const scale = reveal.offsetWidth > 0 ? box.width / reveal.offsetWidth : 1;
      const header = reveal.querySelector("header");
      const actions = reveal.querySelector<HTMLElement>(`[data-map-actions]`);
      const gap = parseFloat(getComputedStyle(reveal).rowGap) || 20;
      const available = (window.innerHeight - Math.max(0, box.top)) / (scale || 1)
        - (header?.offsetHeight ?? 0) - (actions?.offsetHeight ?? 0) - gap * (actions ? 2 : 1) - 24;
      const height = `${Math.max(220, Math.min(600, Math.floor(available)))}px`;
      if (reveal.style.getPropertyValue("--selected-map-height") !== height) reveal.style.setProperty("--selected-map-height", height);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(reveal);
    window.addEventListener("resize", fit);
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); };
  }, [broadcast, map.id, gameNumber]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!animate || !frame || typeof frame.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = frame.getBoundingClientRect();
    const source = originRef.current;
    // OBS scales the complete canvas; translate in its logical pixels.
    const scaleX = target.width > 0 ? frame.offsetWidth / target.width : 1;
    const scaleY = target.height > 0 ? frame.offsetHeight / target.height : 1;
    const dx = source ? (source.left + source.width / 2 - target.left - target.width / 2) * scaleX : 0;
    const dy = source ? (source.top + source.height / 2 - target.top - target.height / 2) * scaleY : 28;
    const sx = source && target.width > 0 ? source.width / target.width : .94;
    const sy = source && target.height > 0 ? source.height / target.height : .94;
    const animation = frame.animate([
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`, borderRadius: "5px", filter: "brightness(.82)" },
      { transform: "translate3d(0, 0, 0) scale(1)", borderRadius: "6px", filter: "brightness(1)" },
    ], { duration: 1250, easing: "cubic-bezier(.22,.8,.2,1)", fill: "both" });
    return () => animation.cancel();
  }, [animate, map.id, gameNumber]);

  return <section ref={revealRef} className={clsx(styles.reveal, broadcast && styles.broadcast)} style={{ "--selected-map-ratio": origin?.aspectRatio ?? 16 / 9 } as CSSProperties} data-map-selected={map.id} data-animate={animate} data-reveal-state={introducing ? "entering" : "ready"}>
    <header className={styles.heading}>
      <div className={styles.headline}>
        <span className={styles.eyebrow}>Game {String(gameNumber).padStart(2, "0")} <i aria-hidden="true" /> Map selected</span>
        <h2 ref={headingRef} tabIndex={-1} aria-label={map.description}>
          <span aria-hidden="true">{titleWords.map((word, index) => <span className={styles.wordMask} key={`${word}-${index}`}><span className={styles.word} style={{ "--word-index": index } as CSSProperties}>{word}</span>{index < titleWords.length - 1 ? " " : ""}</span>)}</span>
        </h2>
      </div>
      <div className={styles.modeBadge}><MapTypeIcon mapType={map.type} /><span>{MAP_TYPE_LABEL[map.type]}</span></div>
    </header>
    <div className={styles.frame} ref={frameRef}>
      <MapImage src={map.imgPath ? resolveMapImageUrl(map.imgPath) : null} alt={map.description} fallbackInitial={map.description.charAt(0)} className={styles.art} />
      <span className={styles.light} aria-hidden="true" />
    </div>
    {children && <div className={styles.actions} data-map-actions="true" inert={introducing}>
      <span className={styles.next}><span>Up next</span><strong>Hero bans</strong></span>
      <div className={styles.control}>{children}</div>
    </div>}
  </section>;
}
