"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  getGoongingaWrapped,
  resolveWrappedSnapshot,
  type GoongingaWrapped,
  type WrappedAssetKey,
  type WrappedMapRanking,
  type WrappedPlayerLeader,
} from "@/lib/api/wrapped";
import styles from "./wrapped.module.css";

type PlayerStory = {
  id: string;
  kind: "player";
  layout: "diagonal" | "column" | "impact" | "shield" | "network" | "survival" | "burst" | "cascade" | "fortress" | "spotlight";
  eyebrow: string;
  title: string;
  caption: string;
  value: WrappedPlayerLeader | null;
  assetKey: WrappedAssetKey;
  decimals?: number;
  suffix?: string;
};

type MapStory = {
  id: string;
  kind: "map";
  layout: "panorama" | "fragment";
  eyebrow: string;
  title: string;
  caption: string;
  value: WrappedMapRanking | null;
  assetKey: WrappedAssetKey;
};

type Story = PlayerStory | MapStory | { id: "finale"; kind: "finale" };

const STORY_DURATION_MS = 4000;

function formatNumber(value: number | null | undefined, decimals = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function useCountUp(target: number, active: boolean, reducedMotion: boolean) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    if (reducedMotion) {
      setValue(target);
      return;
    }

    let frame = 0;
    const duration = 2500;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, reducedMotion, target]);

  return value;
}

function IntroSlide({ wrapped, onStart }: { wrapped: GoongingaWrapped; onStart: () => void }) {
  const snapshot = resolveWrappedSnapshot(wrapped.snapshot);
  const teams = snapshot.overview.teams.slice(0, 12);
  return (
    <section className={`${styles.slide} ${styles.introSlide}`} aria-label="Wrapped introduction">
      <div className={styles.introCopy}>
        <p className={styles.eyebrow}>GOONGINGA LEAGUE · SEASON ARCHIVE</p>
        <h1><span>The season</span> remembers</h1>
        <p className={styles.introDescription}>Every final fight, every clutch save, every name that made this season impossible to forget.</p>
        <div className={styles.introNumbers}>
          <div><strong>{snapshot.overview.games}</strong><span>Battles logged</span></div>
          <div><strong>{snapshot.overview.players}</strong><span>Names in record</span></div>
          <div><strong>{teams.length}</strong><span>Teams assembled</span></div>
        </div>
        <button type="button" className={styles.startButton} onClick={onStart}>Begin the replay <span aria-hidden="true">↓</span></button>
      </div>
      <div className={styles.orbit} aria-label={`${teams.length} teams in the season`}>
        <div className={styles.orbitRing} />
        <div className={styles.orbitCore}>GG<span>{wrapped.snapshot.tournament.name}</span></div>
        {teams.map((team, index) => {
          const angle = (360 / Math.max(teams.length, 1)) * index;
          return (
            <div key={team.id} className={styles.teamOrbit} style={{ "--team-angle": `${angle}deg`, "--team-index": index } as CSSProperties}>
              {team.logo ? <img src={team.logo} alt={team.name} /> : <span>{team.name.slice(0, 2).toUpperCase()}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Art({ src, alt, fallback }: { src?: string | null; alt: string; fallback: string }) {
  return (
    <div className={styles.artFrame}>
      {src ? <img src={src} alt={alt} className={styles.artImage} /> : <div className={styles.artFallback} aria-label={`${alt}: artwork pending`}>{fallback}</div>}
    </div>
  );
}

function PlayerSlide({ story, wrapped }: { story: PlayerStory; wrapped: GoongingaWrapped }) {
  const leader = story.value;
  const image = wrapped.assets[story.assetKey] || leader?.profilePic || null;
  return (
    <section className={`${styles.slide} ${styles.playerSlide} ${styles[`layout${story.layout[0].toUpperCase()}${story.layout.slice(1)}`]}`} aria-label={story.title}>
      <div className={styles.storyCopy}>
        <p className={styles.eyebrow}>{story.eyebrow}</p>
        <h2>{story.title}</h2>
        <p className={styles.storyCaption}>{story.caption}</p>
        <div className={styles.valueBlock}>
          <strong>{formatNumber(leader?.value, story.decimals ?? 0)}<small>{story.suffix || ""}</small></strong>
          <span>{leader?.player || "No eligible player"}</span>
          {leader?.team && <em>{leader.team}</em>}
        </div>
      </div>
      <div className={styles.storyArt}>
        <span className={styles.backgroundWord} aria-hidden="true">{story.title.split(" ")[0]}</span>
        <Art src={image} alt={leader?.player || story.title} fallback={leader?.player?.slice(0, 2).toUpperCase() || "GG"} />
      </div>
    </section>
  );
}

function MapSlide({ story, wrapped }: { story: MapStory; wrapped: GoongingaWrapped }) {
  const map = story.value;
  const image = wrapped.assets[story.assetKey] || map?.image || null;
  return (
    <section className={`${styles.slide} ${styles.mapSlide} ${styles[`layout${story.layout[0].toUpperCase()}${story.layout.slice(1)}`]}`} aria-label={story.title}>
      <div className={styles.mapImageWrap}>
        <Art src={image} alt={map?.name || story.title} fallback="MAP" />
        <span className={styles.mapCount}>{map ? `${map.count} PICK${map.count === 1 ? "" : "S"}` : "NO DATA"}</span>
      </div>
      <div className={styles.mapCopy}>
        <p className={styles.eyebrow}>{story.eyebrow}</p>
        <h2>{story.title}</h2>
        <strong className={styles.mapName}>{map?.name || "No map data"}</strong>
        <p className={styles.storyCaption}>{story.caption}</p>
      </div>
    </section>
  );
}

function FinaleSlide({ wrapped, active, reducedMotion }: { wrapped: GoongingaWrapped; active: boolean; reducedMotion: boolean }) {
  const { totals, games, players } = resolveWrappedSnapshot(wrapped.snapshot).overview;
  const counters = [
    { label: "Firepower unleashed", value: useCountUp(totals.damage, active, reducedMotion), tone: "damage" },
    { label: "Lifelines delivered", value: useCountUp(totals.healing, active, reducedMotion), tone: "healing" },
    { label: "Frontline held", value: useCountUp(totals.mitigation, active, reducedMotion), tone: "mitigation" },
    { label: "Battles logged", value: useCountUp(games, active, reducedMotion), tone: "games" },
    { label: "Names in the record", value: useCountUp(players, active, reducedMotion), tone: "players" },
  ];

  return (
    <section className={`${styles.slide} ${styles.finaleSlide}`} aria-label="Season finale">
      <div className={styles.finaleGlow} aria-hidden="true" />
      <div className={styles.finaleHeading}>
        <p className={styles.eyebrow}>GOONGINGA LEAGUE · {new Date(wrapped.generatedAt).getFullYear()}</p>
        <h2>What a season leaves behind</h2>
      </div>
      <div className={styles.counterGrid}>
        {counters.map((counter) => (
          <div key={counter.label} className={`${styles.counter} ${styles[`counter${counter.tone[0].toUpperCase()}${counter.tone.slice(1)}`]}`}>
            <strong>{formatNumber(counter.value)}</strong>
            <span>{counter.label}</span>
          </div>
        ))}
      </div>
      <p className={styles.finaleSignoff}>The record is frozen. The story stays loud.</p>
    </section>
  );
}

export default function WrappedPage() {
  const [wrapped, setWrapped] = useState<GoongingaWrapped | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    async function loadWrapped() {
      try {
        setWrapped(await getGoongingaWrapped());
      } catch (err: any) {
        setError(err?.status === 404 ? "The season story is still being prepared." : err?.message || "Could not load Goonginga Wrapped.");
      } finally {
        setLoading(false);
      }
    }
    void loadWrapped();
  }, []);

  const stories = useMemo<Story[]>(() => {
    if (!wrapped) return [];
    const { averagesPer10, totals, performance, maps } = resolveWrappedSnapshot(wrapped.snapshot);
    return [
      { id: "averageKills", kind: "player", layout: "diagonal", eyebrow: "BEST AVERAGES · PER 10", title: "Cold-blooded finisher", caption: "The season's sharpest elimination pace.", value: averagesPer10.kills, assetKey: "averageKills", decimals: 2, suffix: " / 10" },
      { id: "averageHealing", kind: "player", layout: "column", eyebrow: "BEST AVERAGES · PER 10", title: "Lifeline on call", caption: "Keeping every fight alive when it mattered.", value: averagesPer10.healing, assetKey: "averageHealing", decimals: 2, suffix: " / 10" },
      { id: "averageDamage", kind: "player", layout: "impact", eyebrow: "BEST AVERAGES · PER 10", title: "Pressure, unbroken", caption: "Damage that never gave the lobby room to breathe.", value: averagesPer10.damage, assetKey: "averageDamage", decimals: 2, suffix: " / 10" },
      { id: "averageMitigation", kind: "player", layout: "shield", eyebrow: "BEST AVERAGES · PER 10", title: "The wall that held", caption: "Pressure absorbed, space protected, fights saved.", value: averagesPer10.mitigation, assetKey: "averageMitigation", decimals: 2, suffix: " / 10" },
      { id: "averageAssists", kind: "player", layout: "network", eyebrow: "BEST AVERAGES · PER 10", title: "The fight conductor", caption: "Every teamfight had another hand behind it.", value: averagesPer10.assists, assetKey: "averageAssists", decimals: 2, suffix: " / 10" },
      { id: "averageSurvival", kind: "player", layout: "survival", eyebrow: "BEST AVERAGES · PER 10", title: "Refused to fall", caption: "The lowest death rate on the road to victory.", value: averagesPer10.lowestDeaths, assetKey: "averageSurvival", decimals: 2, suffix: " / 10" },
      { id: "totalDamage", kind: "player", layout: "burst", eyebrow: "SEASON SUMS", title: "A season of impact", caption: "The heaviest damage total in the record.", value: totals.damage, assetKey: "totalDamage" },
      { id: "totalHealing", kind: "player", layout: "cascade", eyebrow: "SEASON SUMS", title: "Lifebar architect", caption: "The deepest reserve of healing all season.", value: totals.healing, assetKey: "totalHealing" },
      { id: "totalMitigation", kind: "player", layout: "fortress", eyebrow: "SEASON SUMS", title: "Frontline fortress", caption: "A season spent holding the line.", value: totals.mitigation, assetKey: "totalMitigation" },
      { id: "bestKd", kind: "player", layout: "spotlight", eyebrow: "BEST PERFORMANCE", title: "The cleanest finish", caption: "The strongest K/D performance in the season.", value: performance.kd, assetKey: "bestKd", decimals: 2, suffix: " K/D" },
      { id: "mostPickedMap", kind: "map", layout: "panorama", eyebrow: "MAP POOL", title: "Home field", caption: "The battleground that kept calling the season back.", value: maps.mostPicked, assetKey: "mostPickedMap" },
      { id: "leastPickedMap", kind: "map", layout: "fragment", eyebrow: "MAP POOL", title: "The road untaken", caption: "The quietest corner of the draft, zeros included.", value: maps.leastPicked, assetKey: "leastPickedMap" },
      { id: "finale", kind: "finale" },
    ];
  }, [wrapped]);

  const totalSlides = stories.length + 1;
  const goTo = useCallback((nextIndex: number, behavior: ScrollBehavior = "smooth") => {
    const bounded = Math.max(0, Math.min(nextIndex, totalSlides - 1));
    setActiveIndex(bounded);
    const viewport = scrollRef.current;
    if (viewport) viewport.scrollTo({ top: viewport.clientHeight * bounded, behavior });
  }, [totalSlides]);

  useEffect(() => {
    if (!started || reducedMotion || activeIndex >= totalSlides - 1) return;
    const timeout = window.setTimeout(() => goTo(activeIndex + 1), STORY_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [activeIndex, goTo, reducedMotion, started, totalSlides]);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const onScroll = () => {
      const next = Math.round(viewport.scrollTop / Math.max(viewport.clientHeight, 1));
      setActiveIndex((current) => current === next ? current : next);
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown" || event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        if (!started) {
          setStarted(true);
          goTo(1);
        } else {
          goTo(activeIndex + 1);
        }
      }
      if ((event.key === "ArrowUp" || event.key === "ArrowLeft") && started) {
        event.preventDefault();
        goTo(activeIndex - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, goTo, started]);

  if (loading) return <main className={styles.status}>Building the season story...</main>;
  if (error || !wrapped) return <main className={styles.status}><p>GOONGINGA WRAPPED</p><h1>{error || "No Wrapped found"}</h1></main>;

  return (
    <main className={styles.wrapped}>
      <div className={styles.progress} aria-label={`Story ${activeIndex + 1} of ${totalSlides}`}>
        {Array.from({ length: totalSlides }).map((_, index) => <span key={index} className={index <= activeIndex ? styles.progressActive : ""} />)}
      </div>
      <div ref={scrollRef} className={styles.scrollTrack}>
        <IntroSlide wrapped={wrapped} onStart={() => { setStarted(true); goTo(1); }} />
        {stories.map((story, index) => {
          const storyIndex = index + 1;
          const isActive = started && activeIndex === storyIndex;
          return (
            <div key={story.id} className={`${styles.storyViewport} ${isActive ? styles.storyActive : ""}`}>
              {story.kind === "player" && <PlayerSlide story={story} wrapped={wrapped} />}
              {story.kind === "map" && <MapSlide story={story} wrapped={wrapped} />}
              {story.kind === "finale" && <FinaleSlide wrapped={wrapped} active={isActive} reducedMotion={reducedMotion} />}
            </div>
          );
        })}
      </div>
      <div className={styles.controls}>
        <button type="button" onClick={() => goTo(activeIndex - 1)} disabled={activeIndex === 0} aria-label="Previous story">↑</button>
        <span>{String(activeIndex + 1).padStart(2, "0")} / {String(totalSlides).padStart(2, "0")}</span>
        <button type="button" onClick={() => { if (!started) setStarted(true); goTo(activeIndex === 0 ? 1 : activeIndex + 1); }} disabled={activeIndex === totalSlides - 1} aria-label="Next story">↓</button>
      </div>
    </main>
  );
}
