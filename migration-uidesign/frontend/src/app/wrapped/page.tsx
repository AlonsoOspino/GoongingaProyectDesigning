"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const STANDARD_STORY_DURATION_MS = 4000;
const EMPTY_AUDIO_SOURCES: string[] = [];
const MUSIC_HIGHLIGHT_VOLUME = 0.38;
const MUSIC_RESTING_VOLUME = 0.65;
const DEFAULT_AUDIO_DURATION_MS = 12_500;
const FINAL_FRAME_DURATION_MS = 2_500;
const MIN_VALID_AUDIO_DURATION_SECONDS = 0.25;
const CUE_TARGET_RMS = 0.24;
const CUE_MIN_GAIN = 1.3;
const CUE_MAX_GAIN = 2.5;
const audioGainCache = new Map<string, Promise<number>>();

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
    const duration = 2500;
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

function useHighlightSequence(active: boolean, videoPhaseDurationMs: number, reducedMotion: boolean) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!active) {
      setStage(0);
      return;
    }
    if (reducedMotion) {
      setStage(4);
      return;
    }
    setStage(0);
    const identityPhase = Math.min(3_000, videoPhaseDurationMs);
    const remainingPhase = Math.max(0, videoPhaseDurationMs - identityPhase);
    const timeouts = [1, 2, 3, 4].map((nextStage) => window.setTimeout(
      () => setStage(nextStage),
      identityPhase + (remainingPhase * nextStage) / 4
    ));
    return () => timeouts.forEach((timeout) => window.clearTimeout(timeout));
  }, [active, reducedMotion, videoPhaseDurationMs]);

  return stage;
}

function fadeAudio(audio: HTMLAudioElement, targetVolume: number, durationMs: number) {
  const initialVolume = audio.volume;
  const startedAt = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / durationMs);
    audio.volume = initialVolume + (targetVolume - initialVolume) * progress;
    if (progress < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getNormalizedCueGain(url: string, context: AudioContext) {
  const cached = audioGainCache.get(url);
  if (cached) return cached;

  const gain = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error("Unable to analyse cue audio.");
      return response.arrayBuffer();
    })
    .then((buffer) => context.decodeAudioData(buffer))
    .then((buffer) => {
      let sumSquares = 0;
      let sampleCount = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const data = buffer.getChannelData(channel);
        const step = Math.max(1, Math.floor(data.length / 48_000));
        for (let index = 0; index < data.length; index += step) {
          sumSquares += data[index] * data[index];
          sampleCount += 1;
        }
      }
      const rms = sampleCount ? Math.sqrt(sumSquares / sampleCount) : 0;
      return clamp(CUE_TARGET_RMS / Math.max(rms, 0.02), CUE_MIN_GAIN, CUE_MAX_GAIN);
    })
    .catch(() => CUE_MIN_GAIN);
  audioGainCache.set(url, gain);
  return gain;
}

function useStoryAudioDurations(storyAudios: Partial<Record<WrappedAssetKey, string[]>> | undefined) {
  const [durations, setDurations] = useState<Partial<Record<WrappedAssetKey, number>>>({});
  const sourcesKey = useMemo(() => JSON.stringify(storyAudios || {}), [storyAudios]);

  useEffect(() => {
    const entries = Object.entries(storyAudios || {}) as Array<[WrappedAssetKey, string[]]>;
    if (!entries.length) {
      setDurations({});
      return;
    }
    let cancelled = false;
    const getDuration = (source: string) => new Promise<number>((resolve) => {
      const audio = new Audio();
      const timeout = window.setTimeout(() => resolve(0), 8_000);
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        resolve(Number.isFinite(audio.duration) && audio.duration >= MIN_VALID_AUDIO_DURATION_SECONDS ? audio.duration : 0);
      };
      audio.onerror = () => {
        window.clearTimeout(timeout);
        resolve(0);
      };
      audio.src = source;
      audio.load();
    });

    void Promise.all(entries.map(async ([key, sources]) => [key, (await Promise.all(sources.map(getDuration))).reduce((total, duration) => total + duration, 0)] as const))
      .then((nextEntries) => {
        if (!cancelled) setDurations(Object.fromEntries(nextEntries));
      });
    return () => { cancelled = true; };
  }, [sourcesKey, storyAudios]);

  return durations;
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
          <div><strong>{snapshot.overview.games}</strong><span>Battles logged</span></div>
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

function StoryAudioSequence({ sources, active, onPlaybackChange }: { sources: string[]; active: boolean; onPlaybackChange: (playing: boolean) => void }) {
  useEffect(() => {
    if (!active || !sources.length) {
      onPlaybackChange(false);
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
        return;
      }
      disconnectCurrent();
      const sourceUrl = sources[index];
      current = new Audio();
      current.crossOrigin = "anonymous";
      current.src = sourceUrl;
      index += 1;
      current.preload = "auto";
      current.onended = playNext;
      try {
        if (context && compressor) {
          try {
            const gainNode = context.createGain();
            currentSource = context.createMediaElementSource(current);
            currentGain = gainNode;
            gainNode.gain.value = CUE_MIN_GAIN;
            currentSource.connect(gainNode).connect(compressor);
            void getNormalizedCueGain(sourceUrl, context).then((gain) => {
              if (!cancelled && currentGain === gainNode) gainNode.gain.setTargetAtTime(gain, context.currentTime, 0.16);
            });
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
  }, [active, onPlaybackChange, sources]);

  return null;
}

function PlayerSlide({
  story,
  wrapped,
  active,
  reducedMotion,
  audioDurationMs,
  onVideoFinished,
  onStoryAudioPlaybackChange,
}: {
  story: PlayerStory;
  wrapped: GoongingaWrapped;
  active: boolean;
  reducedMotion: boolean;
  audioDurationMs: number;
  onVideoFinished: (storyId: string) => void;
  onStoryAudioPlaybackChange: (storyId: string, playing: boolean) => void;
}) {
  const leader = story.value;
  const assets = useMemo(() => resolveWrappedAssets(wrapped.assets), [wrapped.assets]);
  const introVideo = assets.videos[story.assetKey] || null;
  const artwork = assets.images[story.assetKey] || null;
  const flipped = assets.flipped[story.assetKey] === true;
  const [videoFinished, setVideoFinished] = useState(!introVideo);
  const videoRef = useRef<HTMLVideoElement>(null);
  const storyAudioSources = assets.storyAudios[story.assetKey] || EMPTY_AUDIO_SOURCES;
  const revealStage = useHighlightSequence(active, audioDurationMs, reducedMotion);

  const finishVideo = useCallback(() => {
    setVideoFinished(true);
    onVideoFinished(story.id);
  }, [onVideoFinished, story.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!introVideo || reducedMotion) {
      setVideoFinished(true);
      if (active) onVideoFinished(story.id);
      return;
    }

    setVideoFinished(false);
    if (!active || !video) return;
    let finishTimeout = 0;
    let finished = false;
    const finishOnSeek = () => finishVideo();
    const freezeOnLastFrame = () => {
      if (finished) return;
      finished = true;
      video.pause();
      const lastFrame = Number.isFinite(video.duration) && video.duration > 0 ? Math.max(0, video.duration - 0.04) : 0;
      if (lastFrame && Math.abs(video.currentTime - lastFrame) > 0.03) {
        video.addEventListener("seeked", finishOnSeek, { once: true });
        video.currentTime = lastFrame;
      } else {
        finishVideo();
      }
    };
    const playVideo = () => {
      const sourceDuration = Number.isFinite(video.duration) ? video.duration : 0;
      const requestedRate = sourceDuration ? sourceDuration / Math.max(audioDurationMs / 1000, 0.1) : 0.86;
      // Keep the background cinematic: it can slow down to meet the cue
      // timeline, but never accelerates beyond normal speed.
      video.playbackRate = clamp(requestedRate, 0.55, 0.92);
      // Story audio is authored separately. Muting the background clip makes
      // video playback reliable in browsers and OBS's Chromium source.
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      video.currentTime = 0;
      void video.play().catch(() => undefined);
    };

    if (video.readyState >= 1) playVideo();
    else video.addEventListener("loadedmetadata", playVideo, { once: true });
    finishTimeout = window.setTimeout(freezeOnLastFrame, audioDurationMs);
    return () => {
      window.clearTimeout(finishTimeout);
      video.removeEventListener("loadedmetadata", playVideo);
      video.removeEventListener("seeked", finishOnSeek);
      video.pause();
    };
  }, [active, audioDurationMs, finishVideo, introVideo, onVideoFinished, reducedMotion, story.id]);
  const handleStoryAudioPlaybackChange = useCallback((playing: boolean) => {
    onStoryAudioPlaybackChange(story.id, playing);
  }, [onStoryAudioPlaybackChange, story.id]);

  const valueRevealed = revealStage >= 4;
  const displayedValue = useCountUp(leader?.value || 0, valueRevealed, reducedMotion, story.decimals ?? 0);
  return (
    <section className={`${styles.slide} ${styles.playerSlide} ${styles[`layout${story.layout[0].toUpperCase()}${story.layout.slice(1)}`]}`} aria-label={story.title}>
      <div className={styles.artworkBackdrop} aria-hidden="true">
        {introVideo ? (
          <video
            ref={videoRef}
            src={introVideo}
            className={`${flipped ? styles.artworkFlipped : ""} ${videoFinished ? styles.videoFrozen : ""}`}
            playsInline
            muted
            preload="auto"
          />
        ) : artwork && <img src={artwork} alt="" className={flipped ? styles.artworkFlipped : undefined} />}
      </div>
      <div className={`${styles.playerIdentity} ${active ? styles.playerIdentityVisible : ""}`}>
        <PlayerProfile leader={leader} />
      </div>
      <div className={`${styles.storyCopy} ${active ? styles.storyTimeline : styles.storyWaiting}`}>
        <p className={`${styles.eyebrow} ${revealStage >= 1 ? styles.sequenceEyebrow : styles.sequenceHidden}`}>{story.eyebrow}</p>
        <h2 className={revealStage >= 2 ? styles.sequenceTitle : styles.sequenceHidden}>{story.title}</h2>
        <p className={`${styles.storyCaption} ${revealStage >= 3 ? styles.sequenceCaption : styles.sequenceHidden}`}>{story.caption}</p>
        <div className={`${styles.valueBlock} ${revealStage >= 4 ? styles.sequenceValue : styles.sequenceHidden}`}>
          <strong>{formatNumber(displayedValue, story.decimals ?? 0)}<small>{story.suffix || ""}</small></strong>
        </div>
      </div>
      <StoryAudioSequence sources={storyAudioSources} active={active} onPlaybackChange={handleStoryAudioPlaybackChange} />
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
  const { totals, games, players } = resolveWrappedSnapshot(wrapped.snapshot).overview;
  const counters = [
    { label: "Damage done", value: useCountUp(totals.damage, active, reducedMotion), tone: "damage" },
    { label: "Healing done", value: useCountUp(totals.healing, active, reducedMotion), tone: "healing" },
    { label: "Mitigation done", value: useCountUp(totals.mitigation, active, reducedMotion), tone: "mitigation" },
    { label: "Games played", value: useCountUp(games, active, reducedMotion), tone: "games" },
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
  const [completedVideoStoryId, setCompletedVideoStoryId] = useState<string | null>(null);
  const [storyAudioPlayingId, setStoryAudioPlayingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const introAudioRef = useRef<HTMLAudioElement>(null);
  const generalAudioRef = useRef<HTMLAudioElement>(null);
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
  const media = useMemo(() => wrapped ? resolveWrappedAssets(wrapped.assets) : null, [wrapped]);
  const storyAudioDurations = useStoryAudioDurations(media?.storyAudios);
  const goTo = useCallback((nextIndex: number, behavior: ScrollBehavior = "smooth") => {
    const bounded = Math.max(0, Math.min(nextIndex, totalSlides - 1));
    setActiveIndex(bounded);
    const viewport = scrollRef.current;
    if (viewport) viewport.scrollTo({ top: viewport.clientHeight * bounded, behavior });
  }, [totalSlides]);

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
    const targetVolume = isStoryAudioPlaying || (isPlayerHighlight && completedVideoStoryId !== activeStory.id)
      ? MUSIC_HIGHLIGHT_VOLUME
      : MUSIC_RESTING_VOLUME;
    return fadeAudio(general, targetVolume, isStoryAudioPlaying ? 360 : 650);
  }, [activeIndex, completedVideoStoryId, media?.soundtrack.general, started, stories, storyAudioPlayingId]);

  useEffect(() => {
    setCompletedVideoStoryId(null);
    setStoryAudioPlayingId(null);
  }, [activeIndex]);

  useEffect(() => {
    if (!started || reducedMotion || activeIndex >= totalSlides - 1) return;
    const activeStory = activeIndex > 0 ? stories[activeIndex - 1] : null;
    const duration = activeStory?.kind === "player"
      ? (storyAudioDurations[activeStory.assetKey] || DEFAULT_AUDIO_DURATION_MS) + FINAL_FRAME_DURATION_MS
      : STANDARD_STORY_DURATION_MS;
    const timeout = window.setTimeout(() => goTo(activeIndex + 1), duration);
    return () => window.clearTimeout(timeout);
  }, [activeIndex, goTo, reducedMotion, started, stories, storyAudioDurations, totalSlides]);

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
              {story.kind === "player" && <PlayerSlide story={story} wrapped={wrapped} active={isActive} reducedMotion={reducedMotion} audioDurationMs={storyAudioDurations[story.assetKey] || DEFAULT_AUDIO_DURATION_MS} onVideoFinished={setCompletedVideoStoryId} onStoryAudioPlaybackChange={setStoryAudioPlayback} />}
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
