"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  getGoongingaWrapped,
  resolveWrappedAssets,
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
  contentSide: "left" | "right";
  eyebrow: string;
  titleLines: readonly string[];
  titleColor: string;
  descriptor: string;
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

const STANDARD_STORY_DURATION_MS = 4000;
const EMPTY_AUDIO_SOURCES: string[] = [];
const MUSIC_HIGHLIGHT_VOLUME = 0.38;
const MUSIC_RESTING_VOLUME = 0.65;
const POST_COUNT_HOLD_MS = 1_500;
const CUE_STABLE_GAIN = 1.5;
const HIGHLIGHT_TEXT_SEQUENCE_MS = 10_000;
const COUNT_UP_DURATION_MS = 2_500;
const MIN_PLAYER_HIGHLIGHT_DURATION_MS = HIGHLIGHT_TEXT_SEQUENCE_MS + COUNT_UP_DURATION_MS + POST_COUNT_HOLD_MS;

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

function useCountUp(target: number, active: boolean, reducedMotion: boolean, decimals = 0) {
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
    const duration = COUNT_UP_DURATION_MS;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const next = target * (1 - Math.pow(1 - progress, 3));
      setValue(Number(next.toFixed(decimals)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, reducedMotion, target]);

  return value;
}

function useHighlightSequence(active: boolean) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!active) {
      setStage(0);
      return;
    }
    setStage(0);
    // Text timing is intentionally independent of media metadata: three
    // seconds for the player identity, then six evenly spaced entries in a
    // fixed ten-second highlight sequence.
    const identityPhase = 3_000;
    const laterStepDuration = (HIGHLIGHT_TEXT_SEQUENCE_MS - identityPhase) / 5;
    let currentStage = 0;
    let timeout = 0;
    const advance = () => {
      currentStage += 1;
      setStage(currentStage);
      if (currentStage < 6) timeout = window.setTimeout(advance, laterStepDuration);
    };
    // Deliberately chain the timeouts. A high-bitrate video can delay the
    // event loop; independent timers would then flush together and make every
    // title look as if it appeared at once.
    timeout = window.setTimeout(advance, identityPhase);
    return () => window.clearTimeout(timeout);
  }, [active]);

  return stage;
}

function fadeAudio(audio: HTMLAudioElement, targetVolume: number, durationMs: number) {
  const initialVolume = clamp(audio.volume, 0, 1);
  const finalVolume = clamp(targetVolume, 0, 1);
  const startedAt = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / durationMs);
    audio.volume = clamp(initialVolume + (finalVolume - initialVolume) * progress, 0, 1);
    if (progress < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function TeamTile({ team, index }: { team: GoongingaWrapped["snapshot"]["overview"]["teams"][number]; index: number }) {
  const [logoUnavailable, setLogoUnavailable] = useState(!team.logo);
  return (
    <div className={styles.teamTile}>
      <span className={styles.teamIndex}>{String(index + 1).padStart(2, "0")}</span>
      <div className={styles.teamMark}>
        {!logoUnavailable && team.logo ? (
          <img src={team.logo} alt={team.name} onError={() => setLogoUnavailable(true)} />
        ) : (
          <span aria-label={team.name}>{team.name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <p>{team.name}</p>
    </div>
  );
}

function IntroSlide({ wrapped, onStart }: { wrapped: GoongingaWrapped; onStart: () => void }) {
  const snapshot = resolveWrappedSnapshot(wrapped.snapshot);
  const teams = snapshot.overview.teams.slice(0, 12);
  return (
    <section className={`${styles.slide} ${styles.introSlide}`} aria-label="Wrapped introduction">
      <div className={styles.introCopy}>
        <p className={styles.eyebrow}>GOONGINGA LEAGUE · SEASON ARCHIVE</p>
        <h1><span>Season</span> in review</h1>
        <p className={styles.introDescription}>A complete record of the players, battles and moments that defined this Goonginga season.</p>
        <div className={styles.introNumbers}>
          <div><strong>{snapshot.overview.games}</strong><span>Maps played</span></div>
          <div><strong>{snapshot.overview.players}</strong><span>Names in record</span></div>
          <div><strong>{teams.length}</strong><span>Teams assembled</span></div>
        </div>
        <button type="button" className={styles.startButton} onClick={onStart}>Begin the replay <span aria-hidden="true">↓</span></button>
      </div>
      <div className={styles.coverVisual} aria-label={`${teams.length} teams in the season`}>
        <div className={styles.coverHeading}>
          <p>{wrapped.snapshot.tournament.name}</p>
          <strong>The league</strong>
        </div>
        <div className={styles.coverRoster}>
          {teams.map((team, index) => <TeamTile key={team.id} team={team} index={index} />)}
        </div>
        <div className={styles.coverFooter}>
          <span>{teams.length} teams</span>
          <span>One season · one record</span>
        </div>
      </div>
    </section>
  );
}

function Art({ src, alt, fallback, flipped = false }: { src?: string | null; alt: string; fallback: string; flipped?: boolean }) {
  return (
    <div className={styles.artFrame}>
      {src ? <img src={src} alt={alt} className={`${styles.artImage} ${flipped ? styles.artworkFlipped : ""}`} /> : <div className={styles.artFallback} aria-label={`${alt}: artwork pending`}>{fallback}</div>}
    </div>
  );
}

function PlayerProfile({ leader }: { leader: WrappedPlayerLeader | null }) {
  const initials = leader?.player?.slice(0, 2).toUpperCase() || "GG";
  return (
    <div className={styles.playerProfile}>
      {leader?.profilePic ? <img src={leader.profilePic} alt={leader.player} /> : <span>{initials}</span>}
      <div>
        <strong>{leader?.player || "No eligible player"}</strong>
        <small>{leader?.team || "No team"}</small>
      </div>
    </div>
  );
}

function StoryAudioSequence({ sources, active, onPlaybackChange, onComplete }: { sources: string[]; active: boolean; onPlaybackChange: (playing: boolean) => void; onComplete: () => void }) {
  useEffect(() => {
    if (!active || !sources.length) {
      onPlaybackChange(false);
      if (active) onComplete();
      return;
    }

    let cancelled = false;
    let current: HTMLAudioElement | null = null;
    let currentSource: MediaElementAudioSourceNode | null = null;
    let currentGain: GainNode | null = null;
    let index = 0;
    const context = window.AudioContext ? new AudioContext() : null;
    const compressor = context?.createDynamicsCompressor();
    if (compressor && context) {
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.008;
      compressor.release.value = 0.18;
      compressor.connect(context.destination);
    }

    const disconnectCurrent = () => {
      currentSource?.disconnect();
      currentGain?.disconnect();
      currentSource = null;
      currentGain = null;
    };
    const playNext = async () => {
      if (cancelled) return;
      if (index >= sources.length) {
        onPlaybackChange(false);
        onComplete();
        return;
      }
      disconnectCurrent();
      current = new Audio();
      current.crossOrigin = "anonymous";
      current.src = sources[index];
      index += 1;
      current.preload = "auto";
      current.onended = playNext;
      try {
        if (context && compressor) {
          try {
            const gainNode = context.createGain();
            currentSource = context.createMediaElementSource(current);
            currentGain = gainNode;
            // A fixed gain + compressor is intentionally used instead of
            // decoding every uploaded file a second time for loudness analysis.
            // That duplicate 30–40 MB download was causing playback stalls.
            gainNode.gain.value = CUE_STABLE_GAIN;
            currentSource.connect(gainNode).connect(compressor);
            await context.resume();
          } catch {
            // Keep the cue playable if a third-party URL does not allow the
            // Web Audio graph. Blob-hosted assets use the normalized path.
            current.volume = 1;
          }
        }
        await current.play();
        if (!cancelled) onPlaybackChange(true);
      } catch {
        playNext();
      }
    };

    void playNext();
    return () => {
      cancelled = true;
      if (current) {
        current.onended = null;
        current.pause();
      }
      disconnectCurrent();
      void context?.close();
      onPlaybackChange(false);
    };
  }, [active, onComplete, onPlaybackChange, sources]);

  return null;
}

function PlayerSlide({
  story,
  wrapped,
  active,
  reducedMotion,
  seasonMapsPlayed,
  onStoryAudioPlaybackChange,
  onStoryAudioCompleted,
}: {
  story: PlayerStory;
  wrapped: GoongingaWrapped;
  active: boolean;
  reducedMotion: boolean;
  seasonMapsPlayed: number;
  onStoryAudioPlaybackChange: (storyId: string, playing: boolean) => void;
  onStoryAudioCompleted: (storyId: string) => void;
}) {
  const leader = story.value;
  const assets = useMemo(() => resolveWrappedAssets(wrapped.assets), [wrapped.assets]);
  const introVideo = assets.videos[story.assetKey] || null;
  const artwork = assets.images[story.assetKey] || null;
  const flipped = assets.flipped[story.assetKey] === true;
  const framing = assets.videoPositions[story.assetKey] || { x: 50, y: 50 };
  const visualX = flipped ? 100 - framing.x : framing.x;
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const storyAudioSources = assets.storyAudios[story.assetKey] || EMPTY_AUDIO_SOURCES;
  const revealStage = useHighlightSequence(active);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.loop = true;
    video.defaultPlaybackRate = 1;
    video.playbackRate = 1;

    if (!active || reducedMotion) {
      video.pause();
      if (reducedMotion) {
        try {
          video.currentTime = 0;
        } catch {
          // Remote media can reject seeking until its metadata is available.
        }
      }
      return;
    }

    video.load();
    void video.play().catch(() => undefined);
    return () => video.pause();
  }, [active, introVideo, reducedMotion]);

  useEffect(() => {
    if (!active) return;
    setVideoFailed(false);
    setVideoReady(false);
  }, [active, introVideo]);

  const playActiveVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video || !active || reducedMotion) return;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.loop = true;
    void video.play().catch(() => undefined);
  }, [active, reducedMotion]);
  const handleStoryAudioPlaybackChange = useCallback((playing: boolean) => {
    onStoryAudioPlaybackChange(story.id, playing);
  }, [onStoryAudioPlaybackChange, story.id]);
  const handleStoryAudioComplete = useCallback(() => {
    onStoryAudioCompleted(story.id);
  }, [onStoryAudioCompleted, story.id]);

  const valueRevealed = revealStage >= 6;
  const displayedValue = useCountUp(leader?.value || 0, valueRevealed, reducedMotion, story.decimals ?? 0);
  const title = story.titleLines.join("\n");
  return (
    <section className={`${styles.slide} ${styles.playerSlide}`} data-side={story.contentSide} aria-label={title.replace(/\n/g, " ")}>
      <div className={styles.artworkBackdrop} aria-hidden="true">
        {active && artwork && (
          <img src={artwork} alt="" className={flipped ? styles.artworkFlipped : undefined} />
        )}
        {active && introVideo && !videoFailed && (
          <video
            key={introVideo}
            ref={videoRef}
            src={introVideo}
            className={`${flipped ? styles.artworkFlipped : ""} ${videoReady ? styles.videoReady : ""}`}
            style={{ objectPosition: `${visualX}% ${framing.y}%` }}
            autoPlay={!reducedMotion}
            playsInline
            muted
            loop
            disablePictureInPicture
            preload="auto"
            onLoadStart={() => setVideoReady(false)}
            onLoadedData={() => setVideoReady(true)}
            onCanPlay={() => {
              setVideoReady(true);
              playActiveVideo();
            }}
            onPlaying={() => setVideoReady(true)}
            onError={() => setVideoFailed(true)}
          />
        )}
      </div>
      <div className={styles.highlightContent}>
        <div className={`${styles.playerIdentity} ${active ? styles.playerIdentityVisible : ""}`}>
          <PlayerProfile leader={leader} />
        </div>
        <div className={`${styles.storyCopy} ${active ? styles.storyTimeline : styles.storyWaiting}`} data-sequence-stage={revealStage}>
          {revealStage >= 1 && (
            <h2
              aria-label={title.replace(/\n/g, " ")}
              className={styles.sequenceTitle}
              style={{ "--title-color": story.titleColor } as CSSProperties}
            >
              {title}
            </h2>
          )}
          {revealStage >= 2 && <p className={`${styles.eyebrow} ${styles.sequenceEyebrow}`}>{story.eyebrow}</p>}
          {revealStage >= 3 && <p className={`${styles.metricDescriptor} ${styles.sequenceDescriptor}`}>{story.descriptor}</p>}
          {revealStage >= 4 && <div className={styles.seasonFact}><span className={styles.sequenceFact}>Maps played this season</span>{revealStage >= 5 && <strong className={styles.sequenceFact}>{formatNumber(seasonMapsPlayed)}</strong>}</div>}
          {revealStage >= 6 && <div className={`${styles.valueBlock} ${styles.sequenceValue}`}>
            <strong>{formatNumber(displayedValue, story.decimals ?? 0)}<small>{story.suffix || ""}</small></strong>
          </div>}
        </div>
      </div>
      <StoryAudioSequence sources={storyAudioSources} active={active} onPlaybackChange={handleStoryAudioPlaybackChange} onComplete={handleStoryAudioComplete} />
    </section>
  );
}

function MapSlide({ story, wrapped }: { story: MapStory; wrapped: GoongingaWrapped }) {
  const map = story.value;
  const assets = useMemo(() => resolveWrappedAssets(wrapped.assets), [wrapped.assets]);
  const uploadedArtwork = assets.images[story.assetKey] || null;
  const image = uploadedArtwork || map?.image || null;
  const flipped = Boolean(uploadedArtwork && assets.flipped[story.assetKey]);
  return (
    <section className={`${styles.slide} ${styles.mapSlide} ${styles[`layout${story.layout[0].toUpperCase()}${story.layout.slice(1)}`]}`} aria-label={story.title}>
      <div className={styles.mapImageWrap}>
        <Art src={image} alt={map?.name || story.title} fallback="MAP" flipped={flipped} />
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
  const { totals, games: mapsPlayed, players } = resolveWrappedSnapshot(wrapped.snapshot).overview;
  const counters = [
    { label: "Damage done", value: useCountUp(totals.damage, active, reducedMotion), tone: "damage" },
    { label: "Healing done", value: useCountUp(totals.healing, active, reducedMotion), tone: "healing" },
    { label: "Mitigation done", value: useCountUp(totals.mitigation, active, reducedMotion), tone: "mitigation" },
    { label: "Maps played", value: useCountUp(mapsPlayed, active, reducedMotion), tone: "games" },
    { label: "Players recorded", value: useCountUp(players, active, reducedMotion), tone: "players" },
  ];

  return (
    <section className={`${styles.slide} ${styles.finaleSlide}`} aria-label="Season finale">
      <div className={styles.finaleGlow} aria-hidden="true" />
      <div className={styles.finaleHeading}>
        <p className={styles.eyebrow}>GOONGINGA LEAGUE · {new Date(wrapped.generatedAt).getFullYear()}</p>
        <h2>The complete season in numbers</h2>
      </div>
      <div className={styles.counterGrid}>
        {counters.map((counter) => (
          <div key={counter.label} className={`${styles.counter} ${styles[`counter${counter.tone[0].toUpperCase()}${counter.tone.slice(1)}`]}`}>
            <strong>{formatNumber(counter.value)}</strong>
            <span>{counter.label}</span>
          </div>
        ))}
      </div>
      <p className={styles.finaleSignoff}>GOONGINGA LEAGUE · OFFICIAL SEASON RECORD</p>
    </section>
  );
}

export default function WrappedPage() {
  const [wrapped, setWrapped] = useState<GoongingaWrapped | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [completedAudioStoryId, setCompletedAudioStoryId] = useState<string | null>(null);
  const [storyAudioPlayingId, setStoryAudioPlayingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const introAudioRef = useRef<HTMLAudioElement>(null);
  const generalAudioRef = useRef<HTMLAudioElement>(null);
  const playerHighlightStartedAtRef = useRef<number | null>(null);
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
      { id: "averageKills", kind: "player", contentSide: "left", eyebrow: "BEST AVERAGES · PER 10", titleLines: ["COLD-BLOODED", "FINISHER"], titleColor: "#57E6F2", descriptor: "Highest average kills per 10 minutes of the season.", caption: "The season's sharpest elimination pace.", value: averagesPer10.kills, assetKey: "averageKills", decimals: 2, suffix: " / 10" },
      { id: "averageHealing", kind: "player", contentSide: "left", eyebrow: "BEST AVERAGES · PER 10", titleLines: ["LIFELINE ON", "CALL"], titleColor: "#83F5B5", descriptor: "Highest average healing per 10 minutes of the season.", caption: "Keeping every fight alive when it mattered.", value: averagesPer10.healing, assetKey: "averageHealing", decimals: 2, suffix: " / 10" },
      { id: "averageDamage", kind: "player", contentSide: "right", eyebrow: "BEST AVERAGES · PER 10", titleLines: ["PRESSURE,", "UNBROKEN"], titleColor: "#FF9867", descriptor: "Highest average damage output per 10 minutes of the season.", caption: "Damage that never gave the lobby room to breathe.", value: averagesPer10.damage, assetKey: "averageDamage", decimals: 2, suffix: " / 10" },
      { id: "averageMitigation", kind: "player", contentSide: "left", eyebrow: "BEST AVERAGES · PER 10", titleLines: ["THE WALL", "THAT HELD"], titleColor: "#64B9FF", descriptor: "Highest average mitigation per 10 minutes of the season.", caption: "Pressure absorbed, space protected, fights saved.", value: averagesPer10.mitigation, assetKey: "averageMitigation", decimals: 2, suffix: " / 10" },
      { id: "averageAssists", kind: "player", contentSide: "right", eyebrow: "BEST AVERAGES · PER 10", titleLines: ["THE FIGHT", "CONDUCTOR"], titleColor: "#D88CFF", descriptor: "Highest average assists per 10 minutes of the season.", caption: "Every teamfight had another hand behind it.", value: averagesPer10.assists, assetKey: "averageAssists", decimals: 2, suffix: " / 10" },
      { id: "averageSurvival", kind: "player", contentSide: "left", eyebrow: "BEST AVERAGES · PER 10", titleLines: ["REFUSED", "TO FALL"], titleColor: "#C8F07D", descriptor: "Lowest average deaths per 10 minutes of the season.", caption: "The lowest death rate on the road to victory.", value: averagesPer10.lowestDeaths, assetKey: "averageSurvival", decimals: 2, suffix: " / 10" },
      { id: "totalDamage", kind: "player", contentSide: "left", eyebrow: "SEASON SUMS", titleLines: ["A SEASON", "OF IMPACT"], titleColor: "#FF6F61", descriptor: "Highest total damage dealt across the full season.", caption: "The heaviest damage total in the record.", value: totals.damage, assetKey: "totalDamage" },
      { id: "totalHealing", kind: "player", contentSide: "left", eyebrow: "SEASON SUMS", titleLines: ["LIFEBAR", "ARCHITECT"], titleColor: "#49E0C5", descriptor: "Highest total healing delivered across the full season.", caption: "The deepest reserve of healing all season.", value: totals.healing, assetKey: "totalHealing" },
      { id: "totalMitigation", kind: "player", contentSide: "left", eyebrow: "SEASON SUMS", titleLines: ["FRONTLINE", "FORTRESS"], titleColor: "#F6C443", descriptor: "Highest total mitigation recorded across the full season.", caption: "A season spent holding the line.", value: totals.mitigation, assetKey: "totalMitigation" },
      { id: "bestKd", kind: "player", contentSide: "left", eyebrow: "GREAT PERFORMANCE", titleLines: ["THE", "CLEANEST", "FINISH"], titleColor: "#FF79B7", descriptor: "Highest kill-to-death performance of the season.", caption: "The strongest K/D performance in the season.", value: performance.kd, assetKey: "bestKd", decimals: 2, suffix: " K/D" },
      { id: "mostPickedMap", kind: "map", layout: "panorama", eyebrow: "MAP POOL", title: "Home field", caption: "The battleground that kept calling the season back.", value: maps.mostPicked, assetKey: "mostPickedMap" },
      { id: "leastPickedMap", kind: "map", layout: "fragment", eyebrow: "MAP POOL", title: "The road untaken", caption: "The quietest corner of the draft, zeros included.", value: maps.leastPicked, assetKey: "leastPickedMap" },
      { id: "finale", kind: "finale" },
    ];
  }, [wrapped]);

  const totalSlides = stories.length + 1;
  const media = useMemo(() => wrapped ? resolveWrappedAssets(wrapped.assets) : null, [wrapped]);
  const seasonMapsPlayed = useMemo(() => wrapped ? resolveWrappedSnapshot(wrapped.snapshot).overview.games : 0, [wrapped]);
  const nextVideoToPreload = useMemo(() => {
    if (!started || !media) return null;
    // activeIndex includes the intro, so the following story begins at its
    // matching index in `stories`. Preload only one upcoming clip.
    for (let index = activeIndex; index < stories.length; index += 1) {
      const story = stories[index];
      if (story?.kind === "player") {
        const source = media.videos[story.assetKey];
        if (source) return source;
      }
    }
    return null;
  }, [activeIndex, media, started, stories]);
  const goTo = useCallback((nextIndex: number, behavior: ScrollBehavior = "smooth") => {
    const bounded = Math.max(0, Math.min(nextIndex, totalSlides - 1));
    setActiveIndex(bounded);
    const viewport = scrollRef.current;
    if (viewport) viewport.scrollTo({ top: viewport.clientHeight * bounded, behavior });
  }, [totalSlides]);

  useEffect(() => {
    if (!nextVideoToPreload) return;
    const preload = document.createElement("video");
    preload.preload = "auto";
    preload.muted = true;
    preload.src = nextVideoToPreload;
    preload.load();
    return () => {
      preload.pause();
      preload.removeAttribute("src");
      preload.load();
    };
  }, [nextVideoToPreload]);

  const beginPlayback = useCallback(() => {
    if (!started) {
      setStarted(true);
      const intro = introAudioRef.current;
      if (intro) {
        fadeAudio(intro, 0, 250);
        window.setTimeout(() => {
          intro.pause();
          intro.currentTime = 0;
        }, 260);
      }
      const general = generalAudioRef.current;
      if (general) {
        general.loop = true;
        general.currentTime = 0;
        general.volume = 1;
        void general.play().catch(() => undefined);
      }
    }
    goTo(1);
  }, [goTo, started]);

  const setStoryAudioPlayback = useCallback((storyId: string, playing: boolean) => {
    setStoryAudioPlayingId((current) => {
      if (playing) return storyId;
      return current === storyId ? null : current;
    });
  }, []);
  const setStoryAudioCompleted = useCallback((storyId: string) => {
    setCompletedAudioStoryId(storyId);
  }, []);

  useEffect(() => {
    const intro = introAudioRef.current;
    if (!intro || !media?.soundtrack.intro || started || reducedMotion) return;
    intro.loop = true;
    intro.volume = 0;
    let cancelFade: (() => void) | undefined;
    void intro.play().then(() => { cancelFade = fadeAudio(intro, 1, 1500); }).catch(() => undefined);
    return () => {
      cancelFade?.();
      intro.pause();
      intro.currentTime = 0;
    };
  }, [media?.soundtrack.intro, reducedMotion, started]);

  useEffect(() => {
    const general = generalAudioRef.current;
    if (!general || !media?.soundtrack.general || !started) return;
    general.loop = true;
    void general.play().catch(() => undefined);
    const activeStory = activeIndex > 0 ? stories[activeIndex - 1] : null;
    const isPlayerHighlight = activeStory?.kind === "player";
    const isStoryAudioPlaying = activeStory?.kind === "player" && storyAudioPlayingId === activeStory.id;
    const targetVolume = isStoryAudioPlaying || isPlayerHighlight
      ? MUSIC_HIGHLIGHT_VOLUME
      : MUSIC_RESTING_VOLUME;
    return fadeAudio(general, targetVolume, isStoryAudioPlaying ? 360 : 650);
  }, [activeIndex, media?.soundtrack.general, started, stories, storyAudioPlayingId]);

  useEffect(() => {
    setCompletedAudioStoryId(null);
    setStoryAudioPlayingId(null);
    playerHighlightStartedAtRef.current = started && activeIndex > 0 ? performance.now() : null;
  }, [activeIndex, started]);

  useEffect(() => {
    if (!started || reducedMotion || activeIndex >= totalSlides - 1) return;
    const activeStory = activeIndex > 0 ? stories[activeIndex - 1] : null;
    if (activeStory?.kind === "player" && completedAudioStoryId !== activeStory.id) return;
    const elapsed = playerHighlightStartedAtRef.current === null ? 0 : performance.now() - playerHighlightStartedAtRef.current;
    const duration = activeStory?.kind === "player"
      ? Math.max(POST_COUNT_HOLD_MS, MIN_PLAYER_HIGHLIGHT_DURATION_MS - elapsed)
      : STANDARD_STORY_DURATION_MS;
    const timeout = window.setTimeout(() => goTo(activeIndex + 1), duration);
    return () => window.clearTimeout(timeout);
  }, [activeIndex, completedAudioStoryId, goTo, reducedMotion, started, stories, totalSlides]);

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
          beginPlayback();
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
  }, [activeIndex, beginPlayback, goTo, started]);

  if (loading) return <main className={styles.status}>Building the season story...</main>;
  if (error || !wrapped) return <main className={styles.status}><p>GOONGINGA WRAPPED</p><h1>{error || "No Wrapped found"}</h1></main>;

  return (
    <main className={styles.wrapped}>
      {media?.soundtrack.intro && <audio ref={introAudioRef} src={media.soundtrack.intro} preload="auto" />}
      {media?.soundtrack.general && <audio ref={generalAudioRef} src={media.soundtrack.general} preload="auto" />}
      <div className={styles.progress} aria-label={`Story ${activeIndex + 1} of ${totalSlides}`}>
        {Array.from({ length: totalSlides }).map((_, index) => <span key={index} className={index <= activeIndex ? styles.progressActive : ""} />)}
      </div>
      <div ref={scrollRef} className={styles.scrollTrack}>
        <IntroSlide wrapped={wrapped} onStart={beginPlayback} />
        {stories.map((story, index) => {
          const storyIndex = index + 1;
          const isActive = started && activeIndex === storyIndex;
          return (
            <div key={story.id} className={`${styles.storyViewport} ${isActive ? styles.storyActive : ""}`}>
              {story.kind === "player" && <PlayerSlide story={story} wrapped={wrapped} active={isActive} reducedMotion={reducedMotion} seasonMapsPlayed={seasonMapsPlayed} onStoryAudioPlaybackChange={setStoryAudioPlayback} onStoryAudioCompleted={setStoryAudioCompleted} />}
              {story.kind === "map" && <MapSlide story={story} wrapped={wrapped} />}
              {story.kind === "finale" && <FinaleSlide wrapped={wrapped} active={isActive} reducedMotion={reducedMotion} />}
            </div>
          );
        })}
      </div>
      <div className={styles.controls}>
        <button type="button" onClick={() => goTo(activeIndex - 1)} disabled={activeIndex === 0} aria-label="Previous story">↑</button>
        <span>{String(activeIndex + 1).padStart(2, "0")} / {String(totalSlides).padStart(2, "0")}</span>
        <button type="button" onClick={() => { if (!started) beginPlayback(); else goTo(activeIndex + 1); }} disabled={activeIndex === totalSlides - 1} aria-label="Next story">↓</button>
      </div>
    </main>
  );
}
