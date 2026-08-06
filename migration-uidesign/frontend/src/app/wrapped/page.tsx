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
  type WrappedHeroRanking,
} from "@/lib/api/wrapped";
import { resolveGenericBackendAsset, resolveHeroImageUrl } from "@/lib/assetUrls";
import { getCurrentTournament, getMembers } from "@/lib/api/admin";
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

type BrandIntroStory = { id: string; kind: "brand"; durationSeconds: number };
type FinalistsStory = { id: string; kind: "finalists"; teams: Array<{ id: number; name: string; logo: string | null }>; durationSeconds: number };
type ThanksBeforeStory = { id: string; kind: "thanksBefore"; teams: Array<{ id: number; name: string; logo: string | null }>; durationSeconds: number };
type CommunityStory = { id: string; kind: "community"; players: Array<{ name: string; teamName: string | null }>; durationSeconds: number };
type LeaderboardTeaseStory = { id: string; kind: "leaderboardTease"; durationSeconds: number };

type Story =
  | PlayerStory
  | MapStory
  | BrandIntroStory
  | FinalistsStory
  | ThanksBeforeStory
  | CommunityStory
  | LeaderboardTeaseStory
  | { id: string; kind: "opening"; variant: "teams" | "thanks" }
  | { id: "heroBans"; kind: "heroBans"; most: WrappedHeroRanking | null; least: WrappedHeroRanking | null }
  | { id: "finale"; kind: "finale" }
  | { id: "communityThanks"; kind: "thanks" }
  | { id: "finalsTransition"; kind: "transition" };

const STANDARD_STORY_DURATION_MS = 4000;
const EMPTY_AUDIO_SOURCES: string[] = [];
const MUSIC_HIGHLIGHT_VOLUME = 0.38;
const MUSIC_RESTING_VOLUME = 0.65;
const POST_COUNT_HOLD_MS = 1_500;
const CUE_STABLE_GAIN = 1.5;
const HIGHLIGHT_TEXT_SEQUENCE_MS = 10_000;
const COUNT_UP_DURATION_MS = 2_500;
const MIN_PLAYER_HIGHLIGHT_DURATION_MS = HIGHLIGHT_TEXT_SEQUENCE_MS + COUNT_UP_DURATION_MS + POST_COUNT_HOLD_MS;
const STORY_EXIT_DURATION_MS = 850;

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
          <img src={resolveGenericBackendAsset(team.logo)} alt={team.name} onError={() => setLogoUnavailable(true)} />
        ) : (
          <span aria-label={team.name}>{team.name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <p>{team.name}</p>
    </div>
  );
}

function SeasonLogo({ team, index }: { team: GoongingaWrapped["snapshot"]["overview"]["teams"][number]; index: number }) {
  const [logoUnavailable, setLogoUnavailable] = useState(!team.logo);
  return (
    <div className={styles.seasonLogo} style={{ "--logo-index": index } as CSSProperties}>
      {!logoUnavailable && team.logo ? (
        <img src={resolveGenericBackendAsset(team.logo)} alt={team.name} onError={() => setLogoUnavailable(true)} />
      ) : <span aria-label={`${team.name} logo`}>{team.name.slice(0, 2).toUpperCase()}</span>}
      <small>{team.name}</small>
    </div>
  );
}

function IntroSlide({ wrapped, onStart, autoPlaying = false }: { wrapped: GoongingaWrapped; onStart: () => void; autoPlaying?: boolean }) {
  const snapshot = resolveWrappedSnapshot(wrapped.snapshot);
  const teams = snapshot.overview.teams.slice(0, 12);
  return (
    <section className={`${styles.slide} ${styles.introSlide}`} aria-label="Finals introduction">
      <div className={styles.introCopy}>
        <p className={styles.eyebrow}>GOONGINGA LEAGUE · SEASON RECAP</p>
        <h1><span>This season</span> was yours</h1>
        <p className={styles.introDescription}>Thank you for showing up, competing, and giving the league a season worth remembering.</p>
        <div className={styles.introNumbers}>
          <div><strong>{snapshot.overview.games}</strong><span>Maps played</span></div>
          <div><strong>{snapshot.overview.players}</strong><span>Names in record</span></div>
          <div><strong>{teams.length}</strong><span>Teams assembled</span></div>
        </div>
        {!autoPlaying && <button type="button" className={styles.startButton} onClick={onStart}>Play the season recap <span aria-hidden="true">↓</span></button>}
        {autoPlaying && <p className={styles.autoStartLabel}>THE RECAP BEGINS</p>}
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

function OpeningSlide({ wrapped, variant }: { wrapped: GoongingaWrapped; variant: "teams" | "thanks" }) {
  const teams = resolveWrappedSnapshot(wrapped.snapshot).overview.teams.slice(0, 14);
  if (variant === "thanks") {
    return (
      <section className={`${styles.slide} ${styles.openingThanks}`} aria-label="Thank you for playing">
        <p>TO EVERY PLAYER, CAPTAIN, AND TEAM</p>
        <h2>THANK YOU<br />FOR PLAYING.</h2>
        <span>Every map, every late-night lobby, every close series — this season happened because you were part of it.</span>
      </section>
    );
  }
  return (
    <section className={`${styles.slide} ${styles.openingTeams}`} aria-label="The teams of the season">
      <div className={styles.openingTeamCopy}>
        <p>THE TEAMS OF GOONGINGA LEAGUE</p>
        <h2>YOU BUILT<br />THIS SEASON.</h2>
      </div>
      <div className={styles.logoField}>
        {teams.map((team, index) => <SeasonLogo key={team.id} team={team} index={index} />)}
      </div>
    </section>
  );
}

function HeroBansSlide({ most, least }: { most: WrappedHeroRanking | null; least: WrappedHeroRanking | null }) {
  const cards = [
    { label: "MOST BANNED", hero: most, tone: "most" },
    { label: "LEAST BANNED", hero: least, tone: "least" },
  ];
  return (
    <section className={`${styles.slide} ${styles.heroBansSlide}`} aria-label="Most and least banned heroes">
      <header><p>DRAFT ROOM · SEASON RECORD</p><h2>THE HERO BAN SPLIT</h2></header>
      <div className={styles.heroBanGrid}>
        {cards.map(({ label, hero, tone }) => (
          <article key={label} className={`${styles.heroBanCard} ${styles[`heroBan${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>
            <div>{hero?.image ? <img src={resolveHeroImageUrl(hero.image)} alt={hero.name} /> : <span>?</span>}</div>
            <p>{label}</p>
            <h3>{hero?.name || "NO DATA"}</h3>
            <strong>{formatNumber(hero?.count)} <small>BANS</small></strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function BrandIntroSlide() {
  return (
    <section className={`${styles.slide} ${styles.brandIntroSlide}`} aria-label="Brand introduction">
      <div className={styles.brandIntroContent}>
        <p className={styles.brandIntroEyebrow}>presented in motion</p>
        <h2>RAT&apos;S PRODUCTIONS</h2>
        <p className={styles.brandIntroSubtitle}>with the help of the Social Teams</p>
        <p className={styles.brandIntroPresents}>presents</p>
      </div>
    </section>
  );
}

function FinalistsSlide({ teams }: { teams: Array<{ id: number; name: string; logo: string | null }> }) {
  return (
    <section className={`${styles.slide} ${styles.finalistsSlide}`} aria-label="Finalists showdown">
      <div className={styles.finalistsHeader}>
        <p>the grand final contenders</p>
        <h2>Two teams. One stage.</h2>
      </div>
      <div className={styles.finalistsGrid}>
        {teams.slice(0, 2).map((team, index) => (
          <article key={team.id} className={styles.finalistCard}>
            <div className={styles.finalistAvatarWrap}>
              {team.logo ? (
                <img src={resolveGenericBackendAsset(team.logo)} alt={team.name} />
              ) : (
                <span>{team.name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className={styles.finalistMeta}>
              <span>{index === 0 ? "North" : "South"}</span>
              <strong>{team.name}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ThanksBeforeSlide({ teams }: { teams: Array<{ id: number; name: string; logo: string | null }> }) {
  return (
    <section className={`${styles.slide} ${styles.thanksBeforeSlide}`} aria-label="Thanks before the recap">
      <div className={styles.thanksBeforeHeader}>
        <p>but before</p>
        <h2>We want to thank every team that brought this season to life.</h2>
      </div>
      <div className={styles.thanksBeforeRoster}>
        {teams.slice(0, 9).map((team) => (
          <div key={team.id} className={styles.thanksBeforeTeam}>
            {team.logo ? <img src={resolveGenericBackendAsset(team.logo)} alt={team.name} /> : <span>{team.name.slice(0, 2).toUpperCase()}</span>}
            <strong>{team.name}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function CommunityThanksSlide({ players }: { players: Array<{ name: string; teamName: string | null }> }) {
  return (
    <section className={`${styles.slide} ${styles.communityThanks}`} aria-label="Community thank you">
      <div className={styles.communityThanksCopy}>
        <p className={styles.communityThanksEyebrow}>from the whole league</p>
        <h2>You made this season spectacular.</h2>
      </div>
      <div className={styles.communityThanksNames}>
        {players.map((player, index) => (
          <span key={`${player.name}-${index}`} className={styles.communityThanksName} style={{ animationDelay: `${index * 70}ms` }}>
            {player.name}{player.teamName ? ` · ${player.teamName}` : ""}
          </span>
        ))}
      </div>
    </section>
  );
}

function LeaderboardTeaseSlide() {
  return (
    <section className={`${styles.slide} ${styles.leaderboardTeaseSlide}`} aria-label="Leaderboard tease">
      <p className={styles.leaderboardTeaseEyebrow}>stats are about to speak</p>
      <h2>And now it&apos;s time to show who dominated the stats leaderboard.</h2>
    </section>
  );
}

function FinalsTransitionSlide() {
  return (
    <section className={`${styles.slide} ${styles.finalsTransition}`} aria-label="Transition to the Grand Final">
      <div aria-hidden="true">GGL</div>
      <p>THE RECAP IS OVER</p>
      <h2>THE FINAL<br />STARTS NOW.</h2>
      <span>CAPTAINS, TAKE YOUR POSITIONS.</span>
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
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [leader?.profilePic]);

  return (
    <div className={styles.playerProfile}>
      {leader?.profilePic && !imageFailed
        ? <img src={leader.profilePic} alt={leader.player} onError={() => setImageFailed(true)} />
        : <span>{initials}</span>}
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
  onStoryAudioPlaybackChange,
  onStoryAudioCompleted,
}: {
  story: PlayerStory;
  wrapped: GoongingaWrapped;
  active: boolean;
  reducedMotion: boolean;
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
  const title = story.titleLines.join("\n");
  const titleRevealed = revealStage >= 1;
  const [typedTitleLength, setTypedTitleLength] = useState(0);

  useEffect(() => {
    if (!active || !titleRevealed) {
      setTypedTitleLength(0);
      return;
    }
    if (reducedMotion) {
      setTypedTitleLength(title.length);
      return;
    }

    let nextLength = 1;
    setTypedTitleLength(nextLength);
    const interval = window.setInterval(() => {
      nextLength += 1;
      setTypedTitleLength(Math.min(nextLength, title.length));
      if (nextLength >= title.length) window.clearInterval(interval);
    }, 55);
    return () => window.clearInterval(interval);
  }, [active, reducedMotion, title, titleRevealed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.loop = false;
    video.defaultPlaybackRate = 0.75;
    video.playbackRate = 0.75;

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
    video.loop = false;
    video.playbackRate = 0.75;
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
  return (
    <section
      className={`${styles.slide} ${styles.playerSlide}`}
      data-side={story.contentSide}
      aria-label={title.replace(/\n/g, " ")}
      style={{ "--title-color": story.titleColor } as CSSProperties}
    >
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
              className={`${styles.sequenceTitle} ${reducedMotion ? "" : styles.typingTitle}`}
            >
              {reducedMotion
                ? title
                : (
                  <>
                    <span className={styles.typingMeasure} aria-hidden="true">{title}</span>
                    <span className={styles.typingVisible} aria-hidden="true">{title.slice(0, typedTitleLength)}</span>
                  </>
                )}
            </h2>
          )}
          {revealStage >= 2 && <p className={`${styles.metricDescriptor} ${styles.sequenceDescriptor}`}>{story.descriptor}</p>}
          {revealStage >= 3 && <p className={`${styles.eyebrow} ${styles.sequenceEyebrow}`}>{story.eyebrow}</p>}
          {revealStage >= 6 && <div className={`${styles.valueBlock} ${styles.sequenceValue}`}>
            <strong>{formatNumber(displayedValue, story.decimals ?? 0)}<small>{story.suffix || ""}</small></strong>
          </div>}
        </div>
      </div>
      {revealStage >= 4 && (
        <div
          className={`${styles.seasonFact} ${styles.sequenceFact}`}
          aria-label={`${formatNumber(leader?.mapsPlayed)} maps played by ${leader?.player || "this player"} this season`}
        >
          <strong>{revealStage >= 5 ? formatNumber(leader?.mapsPlayed) : "—"}</strong>
          <span>Maps played<small>This season</small></span>
        </div>
      )}
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

export default function FinalsPage() {
  const [wrapped, setWrapped] = useState<GoongingaWrapped | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [completedAudioStoryId, setCompletedAudioStoryId] = useState<string | null>(null);
  const [storyAudioPlayingId, setStoryAudioPlayingId] = useState<string | null>(null);
  const [finalsAutostart, setFinalsAutostart] = useState(false);
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const [registeredPlayers, setRegisteredPlayers] = useState<Array<{ name: string; teamName: string | null }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recapAudioRef = useRef<HTMLAudioElement>(null);
  const playerHighlightStartedAtRef = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    async function loadWrapped() {
      try {
        const [tournament, data] = await Promise.all([
          getCurrentTournament({ cache: "no-store" }),
          getGoongingaWrapped(),
        ]);
        if (tournament.state !== "FINALS") {
          setError("The Finals experience unlocks when the tournament enters Finals.");
          return;
        }
        setWrapped(data);
      } catch (err: any) {
        setError(err?.status === 404 ? "The Finals story is still being prepared." : err?.message || "Could not load the Goonginga Finals experience.");
      } finally {
        setLoading(false);
      }
    }
    void loadWrapped();
  }, []);

  const media = useMemo(() => wrapped ? resolveWrappedAssets(wrapped.assets) : null, [wrapped]);
  const storyDurations = media?.storyDurations || {};
  const getStoryDuration = useCallback((key: string, fallback: number) => {
    const value = storyDurations[key as keyof typeof storyDurations];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
    if (key === "thanksBefore") {
      const legacyValue = storyDurations.thanks;
      if (typeof legacyValue === "number" && Number.isFinite(legacyValue) && legacyValue > 0) return legacyValue;
    }
    return fallback;
  }, [storyDurations]);

  useEffect(() => {
    async function loadPlayers() {
      try {
        const members = await getMembers();
        const teamLookup = new Map((resolveWrappedSnapshot(wrapped?.snapshot || { overview: { teams: [] }, averagesPer10: {}, totals: {}, performance: {}, maps: {}, heroes: {} } as any).overview.teams || []).map((team: { id: number; name: string }) => [team.id, team.name]));
        const players = (members || [])
          .filter((member: { nickname?: string; teamId?: number | null }) => Boolean(member.nickname))
          .map((member: { nickname: string; teamId?: number | null }) => ({
            name: member.nickname,
            teamName: member.teamId ? teamLookup.get(member.teamId) || null : null,
          }));
        setRegisteredPlayers(players);
      } catch {
        setRegisteredPlayers([]);
      }
    }
    if (wrapped) void loadPlayers();
  }, [wrapped]);

  const stories = useMemo<Story[]>(() => {
    if (!wrapped) return [];
    const snapshot = resolveWrappedSnapshot(wrapped.snapshot);
    const { averagesPer10, totals, performance, maps, heroes } = snapshot;
    return [
      { id: "brandIntro", kind: "brand", durationSeconds: Number(getStoryDuration("intro", 4.5)) },
      { id: "finalists", kind: "finalists", teams: snapshot.overview.teams.slice(0, 2), durationSeconds: Number(getStoryDuration("finalists", 12.5)) },
      { id: "thanksBefore", kind: "thanksBefore", teams: snapshot.overview.teams.slice(0, 9), durationSeconds: Number(getStoryDuration("thanksBefore", 7.25)) },
      { id: "community", kind: "community", players: registeredPlayers.slice(0, 80), durationSeconds: Number(getStoryDuration("community", 8)) },
      { id: "leaderboardTease", kind: "leaderboardTease", durationSeconds: Number(getStoryDuration("leaderboard", 5)) },
      { id: "averageKills", kind: "player", contentSide: "left", eyebrow: "BEST AVERAGES · PER 10", titleLines: ["COLD-BLOODED", "FINISHER"], titleColor: "#57E6F2", descriptor: "Highest average kills of the season.", caption: "The season's sharpest elimination pace.", value: averagesPer10.kills, assetKey: "averageKills", decimals: 2, suffix: " / 10" },
      { id: "averageHealing", kind: "player", contentSide: "left", eyebrow: "BEST AVERAGES · PER 10", titleLines: ["LIFELINE", "ON CALL"], titleColor: "#83F5B5", descriptor: "Highest average healing of the season.", caption: "Keeping every fight alive when it mattered.", value: averagesPer10.healing, assetKey: "averageHealing", decimals: 2, suffix: " / 10" },
      { id: "averageDamage", kind: "player", contentSide: "right", eyebrow: "BEST AVERAGES · PER 10", titleLines: ["PRESSURE,", "UNBROKEN"], titleColor: "#FF9867", descriptor: "Highest average damage of the season.", caption: "Damage that never gave the lobby room to breathe.", value: averagesPer10.damage, assetKey: "averageDamage", decimals: 2, suffix: " / 10" },
      { id: "averageMitigation", kind: "player", contentSide: "left", eyebrow: "BEST AVERAGES · PER 10", titleLines: ["THE WALL", "THAT HELD"], titleColor: "#64B9FF", descriptor: "Highest average mitigation of the season.", caption: "Pressure absorbed, space protected, fights saved.", value: averagesPer10.mitigation, assetKey: "averageMitigation", decimals: 2, suffix: " / 10" },
      { id: "averageAssists", kind: "player", contentSide: "right", eyebrow: "BEST AVERAGES · PER 10", titleLines: ["THE FIGHT", "CONDUCTOR"], titleColor: "#D88CFF", descriptor: "Highest average assists of the season.", caption: "Every teamfight had another hand behind it.", value: averagesPer10.assists, assetKey: "averageAssists", decimals: 2, suffix: " / 10" },
      { id: "averageSurvival", kind: "player", contentSide: "left", eyebrow: "BEST AVERAGES · PER 10", titleLines: ["REFUSED", "TO FALL"], titleColor: "#C8F07D", descriptor: "Lowest average deaths of the season.", caption: "The lowest death rate on the road to victory.", value: averagesPer10.lowestDeaths, assetKey: "averageSurvival", decimals: 2, suffix: " / 10" },
      { id: "totalDamage", kind: "player", contentSide: "left", eyebrow: "SEASON SUMS", titleLines: ["A SEASON", "OF IMPACT"], titleColor: "#FF6F61", descriptor: "Highest total damage dealt across the full season.", caption: "The heaviest damage total in the record.", value: totals.damage, assetKey: "totalDamage" },
      { id: "totalHealing", kind: "player", contentSide: "left", eyebrow: "SEASON SUMS", titleLines: ["LIFEBAR", "ARCHITECT"], titleColor: "#49E0C5", descriptor: "Highest total healing delivered across the full season.", caption: "The deepest reserve of healing all season.", value: totals.healing, assetKey: "totalHealing" },
      { id: "totalMitigation", kind: "player", contentSide: "left", eyebrow: "SEASON SUMS", titleLines: ["FRONTLINE", "FORTRESS"], titleColor: "#F6C443", descriptor: "Highest total mitigation recorded across the full season.", caption: "A season spent holding the line.", value: totals.mitigation, assetKey: "totalMitigation" },
      { id: "heroBans", kind: "heroBans", most: heroes.mostBanned, least: heroes.leastBanned },
      { id: "bestKd", kind: "player", contentSide: "left", eyebrow: "GREAT PERFORMANCE", titleLines: ["THE", "CLEANEST", "FINISH"], titleColor: "#FF79B7", descriptor: "Highest kill-to-death performance of the season.", caption: "The strongest K/D performance in the season.", value: performance.kd, assetKey: "bestKd", decimals: 2, suffix: " K/D" },
      { id: "mostPickedMap", kind: "map", layout: "panorama", eyebrow: "MAP POOL", title: "Home field", caption: "The battleground that kept calling the season back.", value: maps.mostPicked, assetKey: "mostPickedMap" },
      { id: "leastPickedMap", kind: "map", layout: "fragment", eyebrow: "MAP POOL", title: "The road untaken", caption: "The quietest corner of the draft, zeros included.", value: maps.leastPicked, assetKey: "leastPickedMap" },
      { id: "finale", kind: "finale" },
      { id: "communityThanks", kind: "thanks" },
      { id: "finalsTransition", kind: "transition" },
    ];
  }, [getStoryDuration, registeredPlayers, wrapped]);

  const totalSlides = stories.length + 1;
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
    setLeavingIndex(null);
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
      const recap = recapAudioRef.current;
      if (recap) {
        recap.loop = false;
        recap.currentTime = 0;
        recap.volume = MUSIC_RESTING_VOLUME;
        void recap.play().catch(() => undefined);
      }
    }
    goTo(1);
  }, [goTo, started]);

  useEffect(() => {
    if (!wrapped || started) return;
    const mode = new URLSearchParams(window.location.search).get("autostart");
    if (mode !== "finals") return;
    setFinalsAutostart(true);
    setStarted(true);
    goTo(0, "auto");
    const recap = recapAudioRef.current;
    if (recap) {
      recap.loop = false;
      recap.currentTime = 0;
      recap.volume = MUSIC_RESTING_VOLUME;
      void recap.play().catch(() => undefined);
    }
  }, [goTo, started, wrapped]);

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
    const recap = recapAudioRef.current;
    if (!recap || !media?.soundtrack.recap || !started) return;
    recap.loop = false;
    void recap.play().catch(() => undefined);
    const activeStory = activeIndex > 0 ? stories[activeIndex - 1] : null;
    const isPlayerHighlight = activeStory?.kind === "player";
    const isStoryAudioPlaying = activeStory?.kind === "player" && storyAudioPlayingId === activeStory.id;
    const targetVolume = isStoryAudioPlaying || isPlayerHighlight
      ? MUSIC_HIGHLIGHT_VOLUME
      : MUSIC_RESTING_VOLUME;
    return fadeAudio(recap, targetVolume, isStoryAudioPlaying ? 360 : 650);
  }, [activeIndex, media?.soundtrack.recap, started, stories, storyAudioPlayingId]);

  useEffect(() => {
    setCompletedAudioStoryId(null);
    setStoryAudioPlayingId(null);
    playerHighlightStartedAtRef.current = started && activeIndex > 0 ? performance.now() : null;
  }, [activeIndex, started]);

  useEffect(() => {
    if (!started || (reducedMotion && !finalsAutostart) || activeIndex >= totalSlides - 1) return;
    const activeStory = activeIndex > 0 ? stories[activeIndex - 1] : null;
    if (activeStory?.kind === "player" && completedAudioStoryId !== activeStory.id) return;
    const elapsed = playerHighlightStartedAtRef.current === null ? 0 : performance.now() - playerHighlightStartedAtRef.current;
    const duration = activeStory?.kind === "player"
      ? Math.max(POST_COUNT_HOLD_MS, MIN_PLAYER_HIGHLIGHT_DURATION_MS - elapsed)
      : activeStory?.kind === "brand"
        ? (activeStory.durationSeconds ?? 4.5) * 1000
        : activeStory?.kind === "finalists"
          ? (activeStory.durationSeconds ?? 12.5) * 1000
          : activeStory?.kind === "thanksBefore"
            ? (activeStory.durationSeconds ?? 7.25) * 1000
            : activeStory?.kind === "community"
              ? (activeStory.durationSeconds ?? 8) * 1000
              : activeStory?.kind === "leaderboardTease"
                ? (activeStory.durationSeconds ?? 5) * 1000
                : STANDARD_STORY_DURATION_MS;
    let exitTimeout = 0;
    const timeout = window.setTimeout(() => {
      setLeavingIndex(activeIndex);
      exitTimeout = window.setTimeout(() => goTo(activeIndex + 1), STORY_EXIT_DURATION_MS);
    }, duration);
    return () => {
      window.clearTimeout(timeout);
      window.clearTimeout(exitTimeout);
    };
  }, [activeIndex, completedAudioStoryId, finalsAutostart, goTo, reducedMotion, started, stories, totalSlides]);

  useEffect(() => {
    if (!started || activeIndex !== totalSlides - 1) return;
    const activeStory = stories[activeIndex - 1];
    if (activeStory?.kind !== "transition") return;
    const timeout = window.setTimeout(() => {
      window.parent.postMessage({ type: "goonginga-wrapped-complete" }, window.location.origin);
    }, 4_200);
    return () => window.clearTimeout(timeout);
  }, [activeIndex, started, stories, totalSlides]);

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
  if (error || !wrapped) return <main className={styles.status}><p>GOONGINGA FINALS</p><h1>{error || "No Finals recap found"}</h1></main>;

  return (
    <main className={styles.wrapped}>
      {media?.soundtrack.recap?.url && <audio ref={recapAudioRef} src={media.soundtrack.recap.url} preload="auto" />}
      <div className={styles.progress} aria-label={`Story ${activeIndex + 1} of ${totalSlides}`}>
        {Array.from({ length: totalSlides }).map((_, index) => <span key={index} className={index <= activeIndex ? styles.progressActive : ""} />)}
      </div>
      <div ref={scrollRef} className={styles.scrollTrack}>
        <IntroSlide wrapped={wrapped} onStart={beginPlayback} autoPlaying={finalsAutostart} />
        {stories.map((story, index) => {
          const storyIndex = index + 1;
          const isActive = started && activeIndex === storyIndex;
          return (
            <div key={story.id} className={`${styles.storyViewport} ${isActive ? styles.storyActive : ""} ${leavingIndex === storyIndex ? styles.storyLeaving : ""}`}>
              {story.kind === "player" && <PlayerSlide story={story} wrapped={wrapped} active={isActive} reducedMotion={reducedMotion} onStoryAudioPlaybackChange={setStoryAudioPlayback} onStoryAudioCompleted={setStoryAudioCompleted} />}
              {story.kind === "map" && <MapSlide story={story} wrapped={wrapped} />}
              {story.kind === "opening" && <OpeningSlide wrapped={wrapped} variant={story.variant} />}
              {story.kind === "brand" && <BrandIntroSlide />}
              {story.kind === "finalists" && <FinalistsSlide teams={story.teams} />}
              {story.kind === "thanksBefore" && <ThanksBeforeSlide teams={story.teams} />}
              {story.kind === "community" && <CommunityThanksSlide players={story.players} />}
              {story.kind === "leaderboardTease" && <LeaderboardTeaseSlide />}
              {story.kind === "heroBans" && <HeroBansSlide most={story.most} least={story.least} />}
              {story.kind === "finale" && <FinaleSlide wrapped={wrapped} active={isActive} reducedMotion={reducedMotion} />}
              {story.kind === "thanks" && <CommunityThanksSlide players={[]} />}
              {story.kind === "transition" && <FinalsTransitionSlide />}
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
