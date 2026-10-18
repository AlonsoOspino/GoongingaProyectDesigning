"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { clsx } from "clsx";
import type { GameMap, MapType } from "@/lib/api/types";
import { resolveMapImageUrl } from "@/lib/assetUrls";
import { splitModeMaps } from "@/lib/draft/mapModeScene";
import { MapImage, preloadImages } from "./MapImage";
import { MapTypeIcon, MAP_TYPE_LABEL } from "./MapTypePlate";
import plateStyles from "./draft-stage.module.css";
import styles from "./map-mode-scene.module.css";

export const MODE_SCENE_SPIN_MS = 1400;
export const MODE_SCENE_REEL_MS = 2500;
export const MODE_SCENE_TOTAL_MS = MODE_SCENE_SPIN_MS + MODE_SCENE_REEL_MS;
const BRAKE_MS = 600;

/** Source plate bounds in viewport pixels, before any OBS canvas scaling. */
export interface MapModeOrigin { left: number; top: number; width: number; height: number }

interface MapModeSceneProps {
  mapType: MapType;
  maps: GameMap[];
  availableMaps: GameMap[];
  side: "A" | "B";
  teamName: string;
  gameNumber: number;
  broadcast: boolean;
  transition: { key: string; origin?: MapModeOrigin } | null;
  selectable: boolean;
  pendingMapId: number | null;
  onSelect: (mapId: number) => void;
  onSettled: () => void;
}

type ScenePhase = "spin" | "reeling" | "braking" | "settled";

function uniqueModeMaps(maps: GameMap[], mapType: MapType) {
  const ids = new Set<number>();
  return maps.filter((map) => {
    if (map.type !== mapType || ids.has(map.id)) return false;
    ids.add(map.id);
    return true;
  });
}

/** One continuous scene: the two reels become the final, interactive map pool. */
export function MapModeScene({
  mapType, maps, availableMaps, side, teamName, gameNumber, broadcast,
  transition, selectable, pendingMapId, onSelect, onSettled,
}: MapModeSceneProps) {
  const sceneRef = useRef<HTMLElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const leftTrackRef = useRef<HTMLDivElement>(null);
  const rightTrackRef = useRef<HTMLDivElement>(null);
  const transitionRef = useRef(transition);
  const settledRef = useRef(onSettled);
  const startedRef = useRef<{ key: string; at: number } | null>(null);
  const notifiedKeysRef = useRef(new Set<string>());
  const focusedKeysRef = useRef(new Set<string>());
  const [phase, setPhase] = useState<ScenePhase>(transition ? "spin" : "settled");
  transitionRef.current = transition;
  settledRef.current = onSettled;
  const transitionKey = transition?.key ?? null;
  const allModeMaps = useMemo(() => uniqueModeMaps(maps, mapType), [maps, mapType]);
  const choices = useMemo(() => uniqueModeMaps(availableMaps, mapType), [availableMaps, mapType]);
  const { left, right } = splitModeMaps(choices);
  const maxRows = Math.max(left.length, right.length, 1);
  const isSettled = phase === "settled";
  const canSelect = isSettled && selectable && pendingMapId == null;
  const reelMaps = allModeMaps.length ? allModeMaps : choices;
  const reelMapCountRef = useRef(reelMaps.length);
  reelMapCountRef.current = reelMaps.length;

  useEffect(() => {
    void preloadImages([...new Set([...allModeMaps, ...choices].map((map) => resolveMapImageUrl(map.imgPath)))]);
  }, [allModeMaps, choices]);

  // Logical dimensions keep a 1920×1080 OBS scene independent of the host viewport.
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const measure = () => {
      scene.style.setProperty("--scene-w", `${scene.clientWidth}px`);
      scene.style.setProperty("--scene-h", `${scene.clientHeight}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scene);
    return () => observer.disconnect();
  }, [broadcast]);

  // Only a new transition identity starts a scene. Polls, images, pending state
  // and callback changes cannot restart either the animation or its deadline.
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    const plate = plateRef.current;
    if (!scene || !plate || !transitionKey) {
      setPhase("settled");
      return;
    }
    if (startedRef.current?.key !== transitionKey) startedRef.current = { key: transitionKey, at: Date.now() };
    const startedAt = startedRef.current.at;
    let disposed = false;
    let finished = false;
    const animations: Animation[] = [];
    const deadlines: number[] = [];
    let watchdog: number | undefined;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const elapsed = () => Math.max(0, Date.now() - startedAt);

    const box = scene.getBoundingClientRect();
    const target = plate.getBoundingClientRect();
    const scaleX = box.width > 0 ? scene.offsetWidth / box.width : 1;
    const scaleY = box.height > 0 ? scene.offsetHeight / box.height : 1;
    const origin = transitionRef.current?.origin;
    const dx = origin ? (origin.left + origin.width / 2 - target.left - target.width / 2) * scaleX : 0;
    const dy = origin ? (origin.top + origin.height / 2 - target.top - target.height / 2) * scaleY : 28;
    const sx = origin && target.width > 0 ? origin.width / target.width : 0.92;
    const sy = origin && target.height > 0 ? origin.height / target.height : 0.92;

    let plateAnimation: Animation | null = null;
    if (elapsed() < MODE_SCENE_SPIN_MS && typeof plate.animate === "function") {
      plateAnimation = plate.animate(reduceMotion ? [
        { opacity: 0.45 }, { opacity: 1 },
      ] : [
        { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy}) rotateY(0deg) rotateZ(0deg)`, offset: 0 },
        { transform: `translate3d(${dx * 0.32}px, ${dy * 0.12 - 22}px, 100px) scale(1.12) rotateY(310deg) rotateZ(-5deg)`, offset: 0.36 },
        { transform: "translate3d(0, -10px, 50px) scale(1.055) rotateY(640deg) rotateZ(2deg)", offset: 0.76 },
        { transform: "translate3d(0, 0, 0) scale(1) rotateY(720deg) rotateZ(0deg)", offset: 1 },
      ], { duration: MODE_SCENE_SPIN_MS, easing: "cubic-bezier(.2,.72,.2,1)", fill: "both" });
      plateAnimation.currentTime = elapsed();
      animations.push(plateAnimation);
    }

    const reels: Animation[] = [];
    if (!reduceMotion) {
      for (const [index, track] of [leftTrackRef.current, rightTrackRef.current].entries()) {
        if (!track || typeof track.animate !== "function") continue;
        const animation = track.animate([
          { transform: "translate3d(0, 0, 0)" },
          { transform: "translate3d(0, -25%, 0)" },
        ], {
          duration: Math.max(500, reelMapCountRef.current * 105),
          iterations: Infinity,
          easing: "linear",
          direction: index === 0 ? "normal" : "reverse",
        });
        animation.currentTime = elapsed();
        reels.push(animation);
        animations.push(animation);
      }
    }

    const settle = () => {
      if (disposed || finished) return;
      finished = true;
      plateAnimation?.cancel();
      for (const reel of reels) reel.pause();
      for (const timer of deadlines) window.clearTimeout(timer);
      if (watchdog !== undefined) window.clearInterval(watchdog);
      setPhase("settled");
      if (!notifiedKeysRef.current.has(transitionKey)) {
        notifiedKeysRef.current.add(transitionKey);
        settledRef.current();
      }
    };
    const syncClock = () => {
      if (disposed || finished) return;
      const time = elapsed();
      if (time >= MODE_SCENE_TOTAL_MS) { settle(); return; }
      if (time >= MODE_SCENE_SPIN_MS) {
        plateAnimation?.cancel();
        plateAnimation = null;
      }
      if (time >= MODE_SCENE_TOTAL_MS - BRAKE_MS) {
        setPhase("braking");
        const remaining = Math.max(0, (MODE_SCENE_TOTAL_MS - time) / BRAKE_MS);
        for (const reel of reels) reel.updatePlaybackRate(0.07 + 0.93 * remaining * remaining);
      } else setPhase(time < MODE_SCENE_SPIN_MS ? "spin" : "reeling");
    };

    // setTimeout is authoritative: a paused/throttled RAF or animation event
    // must never leave the actual draft locked behind this presentation.
    for (const time of [MODE_SCENE_SPIN_MS, MODE_SCENE_TOTAL_MS - BRAKE_MS])
      deadlines.push(window.setTimeout(syncClock, Math.max(0, time - elapsed())));
    deadlines.push(window.setTimeout(settle, Math.max(0, MODE_SCENE_TOTAL_MS - elapsed())));
    watchdog = window.setInterval(syncClock, 40);
    window.addEventListener("focus", syncClock);
    document.addEventListener("visibilitychange", syncClock);
    syncClock();
    return () => {
      disposed = true;
      for (const timer of deadlines) window.clearTimeout(timer);
      window.clearInterval(watchdog);
      window.removeEventListener("focus", syncClock);
      document.removeEventListener("visibilitychange", syncClock);
      for (const animation of animations) animation.cancel();
    };
  }, [transitionKey]);

  // Restore keyboard flow once per actual reveal, never on ordinary draft polls.
  useEffect(() => {
    if (!isSettled || !transitionKey || !canSelect || focusedKeysRef.current.has(transitionKey)) return;
    const scene = sceneRef.current;
    const option = scene?.querySelector<HTMLButtonElement>("[data-map-option]:not(:disabled)");
    const active = document.activeElement;
    if (option && (active === document.body || !active || scene?.contains(active))) {
      option.focus({ preventScroll: true });
      focusedKeysRef.current.add(transitionKey);
    }
  }, [isSettled, transitionKey, canSelect]);

  const renderReel = (trackRef: typeof leftTrackRef) => <div className={styles.reelWindow} aria-hidden="true">
    <div className={styles.reelTrack} ref={trackRef}>
      {Array.from({ length: 4 }, (_, copy) => <div className={styles.reelCycle} key={copy}>
        {reelMaps.map((map) => <div className={styles.reelTile} key={map.id}>
          <MapImage src={resolveMapImageUrl(map.imgPath)} alt="" fallbackInitial={map.description.charAt(0)} className={styles.mapArt} />
          <span className={styles.reelName}>{map.description}</span>
        </div>)}
      </div>)}
    </div>
  </div>;

  const renderChoices = (laneMaps: GameMap[]) => <div className={styles.mapStack} aria-hidden={!isSettled}>
    {laneMaps.map((map, index) => <button
      key={map.id}
      type="button"
      className={clsx(styles.mapCard, pendingMapId === map.id && styles.mapPending)}
      style={{ "--card-index": index } as CSSProperties}
      disabled={!canSelect}
      tabIndex={isSettled ? 0 : -1}
      aria-label={`${pendingMapId === map.id ? "Selecting" : selectable ? "Select" : "Available map:"} ${map.description}`}
      aria-pressed={pendingMapId === map.id}
      data-map-option="true"
      title={map.description}
      onClick={() => { if (canSelect) onSelect(map.id); }}
    >
      <MapImage src={resolveMapImageUrl(map.imgPath)} alt="" fallbackInitial={map.description.charAt(0)} className={styles.mapArt} />
      <span className={styles.cardLight} aria-hidden="true" />
      <span className={styles.mapCaption}><span><span className={styles.mapEyebrow}>{pendingMapId === map.id ? "Locking selection" : "Available map"}</span><strong>{map.description}</strong></span><span className={styles.mapArrow} aria-hidden="true">{pendingMapId === map.id ? "···" : "↗"}</span></span>
    </button>)}
  </div>;

  return <section
    ref={sceneRef}
    className={clsx(styles.scene, broadcast && styles.broadcast)}
    style={{ "--map-rows": maxRows } as CSSProperties}
    data-scene-phase={phase}
    data-mode={mapType}
    data-side={side}
    data-selectable={canSelect}
    data-transition-key={transitionKey ?? ""}
    aria-label={`${MAP_TYPE_LABEL[mapType]} map selection`}
    aria-busy={!isSettled || pendingMapId != null}
  >
    <div className={styles.atmosphere} aria-hidden="true" />
    <div className={styles.scanlines} aria-hidden="true" />
    <header className={styles.header}>
      <span className={styles.brand}><i aria-hidden="true" /> GGL <span>/</span> DRAFT</span>
      <div className={styles.teamMeta}><span>Game {String(gameNumber).padStart(2, "0")}</span><strong>{teamName}</strong></div>
      <span className={styles.chapter}>Map selection <span>02</span></span>
    </header>
    <div className={styles.contextTop} aria-hidden="true"><span>MODE CONFIRMED</span><i /><span>{MAP_TYPE_LABEL[mapType].toUpperCase()}</span></div>
    <div className={styles.board}>
      <div className={clsx(styles.lane, styles.leftLane)}>
        {renderReel(leftTrackRef)}
        {renderChoices(left)}
        {isSettled && !left.length && <div className={styles.emptyLane} aria-hidden="true"><MapTypeIcon mapType={mapType} /><span>Pool complete</span></div>}
      </div>
      <div className={styles.center}>
        <div className={styles.orbit} aria-hidden="true" />
        <div className={clsx(plateStyles.plate, styles.modeCard)} ref={plateRef}>
          <span className={styles.cardCorner} aria-hidden="true" />
          <MapTypeIcon mapType={mapType} className={styles.modeIcon} />
          <span className={plateStyles.plateName}>{MAP_TYPE_LABEL[mapType]}</span>
          <span className={clsx(plateStyles.plateMeta, styles.modeCount)}>{choices.length} {choices.length === 1 ? "map" : "maps"}</span>
          <span className={styles.modeSerial} aria-hidden="true">GGL / {String(gameNumber).padStart(2, "0")}</span>
        </div>
        <p className={styles.centerStatus} aria-live="polite">{isSettled ? choices.length ? "MODE LOCKED" : "NO MAPS AVAILABLE" : "MODE LOCKED"}</p>
      </div>
      <div className={clsx(styles.lane, styles.rightLane)}>
        {renderReel(rightTrackRef)}
        {renderChoices(right)}
        {isSettled && !right.length && <div className={styles.emptyLane} aria-hidden="true"><MapTypeIcon mapType={mapType} /><span>{choices.length ? "Mode locked" : "Pool complete"}</span></div>}
      </div>
    </div>
    <footer className={styles.footer}>
      <span className={styles.footerLabel}><i aria-hidden="true" />{isSettled ? "MAP POOL READY" : "RESOLVING MAP POOL"}</span>
      <p role="status">{isSettled
        ? pendingMapId != null ? "Locking map selection…" : choices.length === 0 ? "No eligible maps remain in this mode." : selectable ? "Choose your battleground" : `${teamName} is choosing a map`
        : phase === "spin" ? "Mode confirmed" : "Finding your battleground"}</p>
      <span className={styles.poolCount}>{String(choices.length).padStart(2, "0")} <span>AVAILABLE</span></span>
    </footer>
  </section>;
}
