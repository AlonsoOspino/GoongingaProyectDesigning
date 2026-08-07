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
  type WrappedParticipant,
} from "@/lib/api/wrapped";
import { resolveGenericBackendAsset, resolveHeroImageUrl } from "@/lib/assetUrls";
import { getCurrentTournament } from "@/lib/api/admin";
import { getMatchesByTournament } from "@/lib/api/match";
import { getTeams } from "@/lib/api/team";
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

type FinalsTeam = { id: number; name: string; logo: string | null };
type FinalistsStory = { id: string; kind: "finalists"; teams: FinalsTeam[]; durationSeconds: number };
type ThanksBeforeStory = { id: string; kind: "thanksBefore"; teams: FinalsTeam[]; durationSeconds: number };
type SpectacularStory = { id: string; kind: "spectacular"; participants: WrappedParticipant[]; durationSeconds: number };
type StatsIntroStory = { id: string; kind: "statsIntro"; durationSeconds: number };

type Story =
  | PlayerStory
  | MapStory
  | FinalistsStory
  | ThanksBeforeStory
  | SpectacularStory
  | StatsIntroStory
  | { id: string; kind: "opening"; variant: "teams" | "thanks" }
  | { id: "heroBans"; kind: "heroBans"; most: WrappedHeroRanking | null; least: WrappedHeroRanking | null }
  | { id: "finale"; kind: "finale" }
  | { id: "communityThanks"; kind: "thanks" }
  | { id: "finalsTransition"; kind: "transition" };

const STANDARD_STORY_DURATION_MS = 4000;
const EMPTY_AUDIO_SOURCES: string[] = [];
const MUSIC_HIGHLIGHT_VOLUME = 0.63;
const MUSIC_RESTING_VOLUME = 1;
const POST_COUNT_HOLD_MS = 1_500;
const CUE_STABLE_GAIN = 1.2;
const HIGHLIGHT_TEXT_SEQUENCE_MS = 10_000;
const COUNT_UP_DURATION_MS = 2_500;
const MIN_PLAYER_HIGHLIGHT_DURATION_MS = HIGHLIGHT_TEXT_SEQUENCE_MS + COUNT_UP_DURATION_MS + POST_COUNT_HOLD_MS;
const STORY_EXIT_DURATION_MS = 850;
const MUSIC_CROSSFADE_MS = 900;
const MUSIC_FADE_IN_MS = 1_800;
const STATS_INTRO_FADE_IN_MS = 2_700;
// When no dedicated bridge track exists, the stats-intro slide ("la quinta")
// becomes the transition zone between the two songs. The intro and highlights
// tracks are very different in style, so instead of overlapping them (which
// sounds muddy) we use a "dip" / V-shaped handoff: song A resolves and fades
// out cleanly, a short breath of near-silence follows, then song B swells in
// on its own underneath the "AND NOW..." copy and settles before the first
// highlight — no hard cut, no clashing overlap.
const QUINTA_MIN_SECONDS = 10; // floor so the handoff always has room to breathe
const INTRO_RESOLVE_MS = 2_600; // song A fades out gently at the top of the quinta
const HIGHLIGHTS_BRIDGE_DELAY_MS = 2_900; // breath before song B enters
const HIGHLIGHTS_BRIDGE_RISE_MS = 5_200; // song B swells in slowly and alone
const HIGHLIGHTS_BRIDGE_BED_VOLUME = 0.5; // resting bed level reached during the quinta

type MusicPhase = "idle" | "intro" | "statsIntro" | "highlights";

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
    // Smoothstep easing: gentler starts and stops than a linear ramp, so fades
    // feel organic rather than mechanical — important when bridging two songs.
    const eased = progress * progress * (3 - 2 * progress);
    audio.volume = clamp(initialVolume + (finalVolume - initialVolume) * eased, 0, 1);
    if (progress < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getCreditsDurationSeconds(participantCount: number) {
  // Long enough to keep every player readable, but capped so the scene does not drag forever.
  return Math.min(28, Math.max(9, (6 + participantCount * 0.78) / 1.5));
}


type TypewriterTextProps = {
  text: string;
  active: boolean;
  reducedMotion: boolean;
  delay?: number;
  speed?: number;
  className?: string;
};

function TypewriterText({
  text,
  active,
  reducedMotion,
  delay = 0,
  speed = 55,
  className = "",
}: TypewriterTextProps) {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    let interval = 0;
    let timeout = 0;

    if (!active) {
      setVisibleLength(0);
      return;
    }
    if (reducedMotion) {
      setVisibleLength(text.length);
      return;
    }

    setVisibleLength(0);
    timeout = window.setTimeout(() => {
      setVisibleLength(text.length ? 1 : 0);
      interval = window.setInterval(() => {
        setVisibleLength((current) => {
          if (current >= text.length) {
            window.clearInterval(interval);
            return current;
          }
          return current + 1;
        });
      }, speed);
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [active, delay, reducedMotion, speed, text]);

  const typing = active && visibleLength < text.length;
  return (
    <span
      className={`${styles.typewriterText} ${typing ? styles.typewriterTyping : ""} ${className}`}
      aria-hidden="true"
    >
      {text.slice(0, visibleLength)}
    </span>
  );
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

function IntroSlide({ onStart, active, reducedMotion }: { onStart: () => void; active: boolean; reducedMotion: boolean }) {
  return (
    <section className={`${styles.slide} ${styles.introSlide} ${active ? styles.storyActive : ""}`} aria-label="Rat's Productions, with the help of the Social Teams, presents">
      <div className={styles.productionLockup}>
        <h1
          aria-label="RAT'S PRODUCTIONS"
          style={{
            fontSize: "clamp(9rem, 16vw, 19rem)",
            lineHeight: 0.68,
            letterSpacing: "0.015em",
            textAlign: "center",
            whiteSpace: "nowrap",
          }}
        >
          <TypewriterText text="RAT'S PRODUCTIONS" active={active} reducedMotion={reducedMotion} speed={34} />
        </h1>
        <div className={styles.productionSequence}>
          <p aria-label="with the help of the Social Teams">
            <TypewriterText text="with the help of the Social Teams" active={active} reducedMotion={reducedMotion} delay={850} speed={32} />
          </p>
          <span aria-label="presents">
            <TypewriterText text="presents:" active={active} reducedMotion={reducedMotion} delay={2_250} speed={48} />
          </span>
        </div>
      </div>
      {!active && <small className={styles.introStartHint}>CLICK ANYWHERE TO START</small>}
      <button type="button" className={styles.introStartOverlay} onClick={onStart} aria-label="Start the Finals presentation" />
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

function HeroBansSlide({ wrapped, most, least }: { wrapped: GoongingaWrapped; most: WrappedHeroRanking | null; least: WrappedHeroRanking | null }) {
  const assets = useMemo(() => resolveWrappedAssets(wrapped.assets), [wrapped.assets]);
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
            <div>
              {tone === "most" && assets.images.heroBanMost ? (
                <img src={assets.images.heroBanMost} alt={hero?.name || "Most banned hero"} />
              ) : tone === "least" && assets.images.heroBanLeast ? (
                <img src={assets.images.heroBanLeast} alt={hero?.name || "Least banned hero"} />
              ) : hero?.image ? (
                <img src={resolveHeroImageUrl(hero.image)} alt={hero.name} />
              ) : (
                <span>?</span>
              )}
            </div>
            <p>{label}</p>
            <h3>{hero?.name || "NO DATA"}</h3>
            <strong>{formatNumber(hero?.count)} <small>BANS</small></strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function FinalistsSlide({ teams, active, reducedMotion }: { teams: FinalsTeam[]; active: boolean; reducedMotion: boolean }) {
  const matchup = teams.slice(0, 2);
  return (
    <section className={`${styles.slide} ${styles.finalistsSlide}`} aria-label="Goonginga League Grand Final">
      <div className={styles.finalistsBackdrop} aria-hidden="true"><span /><span /><span /></div>
      <header className={styles.finalistsHeader}>
        <p aria-label="GOONGINGA LEAGUE">
          <TypewriterText text="GOONGINGA LEAGUE" active={active} reducedMotion={reducedMotion} delay={180} speed={68} />
        </p>
        <h2 aria-label="THE GRAND FINAL">
          <TypewriterText text="THE GRAND FINAL" active={active} reducedMotion={reducedMotion} delay={1_150} speed={145} />
        </h2>
      </header>
      <div className={styles.finalistsArena}>
        {matchup.map((team, index) => (
          <article key={team.id} className={`${styles.finalistCard} ${index === 0 ? styles.finalistCardLeft : styles.finalistCardRight}`}>
            <div className={styles.finalistEnergyRing} aria-hidden="true" />
            <div className={styles.finalistAvatarWrap}>
              {team.logo ? (
                <img src={resolveGenericBackendAsset(team.logo)} alt={team.name} />
              ) : (
                <span>{team.name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className={styles.finalistMeta}>
              <span>{index === 0 ? "FINALIST 01" : "FINALIST 02"}</span>
              <strong title={team.name}>{/gaming\s+for\s+goonginga/i.test(team.name) ? "GAMING FOR GOONGINGA" : team.name}</strong>
            </div>
          </article>
        ))}
        <div className={styles.finalistsCenterBadge}><small>CHAMPIONSHIP</small><strong>VS</strong><span>ONE MATCH</span></div>
      </div>
      <p className={styles.finalistsSubtitle}>EVERY ROUND LED HERE.</p>
    </section>
  );
}

function ThanksBeforeSlide({ teams, active, reducedMotion }: { teams: FinalsTeam[]; active: boolean; reducedMotion: boolean }) {
  return (
    <section className={`${styles.slide} ${styles.thanksBeforeSlide}`} aria-label="Thanks before the recap">
      <div className={styles.thanksBeforeHeader}>
        <p
          aria-label="BUT BEFORE"
          style={{
            fontSize: "clamp(1.35rem, 1.8vw, 2.15rem)",
            letterSpacing: "0.34em",
            lineHeight: 1,
          }}
        >
          <TypewriterText text="BUT BEFORE..." active={active} reducedMotion={reducedMotion} delay={120} speed={46} />
        </p>
        <h2
          aria-label="THANK YOU FOR SHOWING UP"
          style={{
            fontFamily: '"Arial Black", Arial, sans-serif',
            fontSize: "clamp(6rem, 9.2vw, 11rem)",
            fontWeight: 900,
            letterSpacing: "-0.045em",
            lineHeight: 0.78,
            textAlign: "center",
          }}
        >
          <TypewriterText
            text={"THANK YOU FOR\nSHOWING UP."}
            active={active}
            reducedMotion={reducedMotion}
            delay={850}
            speed={58}
            className={styles.thanksBeforeTypedTitle}
          />
        </h2>
        <span
          aria-label="Thank you to every team for the commitment, the match nights, and the effort that carried this League through the season."
          style={{
            fontSize: "clamp(1.25rem, 1.65vw, 1.9rem)",
            fontWeight: 700,
            lineHeight: 1.35,
          }}
        >
          <TypewriterText
            text="Thank you to every team for the commitment, the match nights, and the effort that carried this League through the season."
            active={active}
            reducedMotion={reducedMotion}
            delay={2_650}
            speed={26}
          />
        </span>
      </div>
      <div className={styles.thanksBeforeRoster}>
        {teams.slice(0, 9).map((team, index) => (
          <div key={team.id} className={styles.thanksBeforeTeam} style={{ "--team-index": index } as CSSProperties}>
            {team.logo ? <img src={resolveGenericBackendAsset(team.logo)} alt={team.name} /> : <span>{team.name.slice(0, 2).toUpperCase()}</span>}
            <strong>{team.name}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function SpectacularSlide({ participants, active, reducedMotion }: { participants: WrappedParticipant[]; active: boolean; reducedMotion: boolean }) {
  const creditsDurationSeconds = getCreditsDurationSeconds(participants.length);

  return (
    <section className={`${styles.slide} ${styles.spectacularSlide}`} aria-label="You made this season spectacular">
      <div className={styles.spectacularGhost} aria-hidden="true">SEASON</div>
      <div className={styles.spectacularCopy}>
        <p aria-label="TO EVERY TEAM. TO EVERY PLAYER.">
          <TypewriterText text="TO EVERY TEAM. TO EVERY PLAYER." active={active} reducedMotion={reducedMotion} delay={180} speed={56} />
        </p>
        <h2 aria-label="YOU MADE THIS SEASON SPECTACULAR">
          <TypewriterText text="YOU MADE" active={active} reducedMotion={reducedMotion} delay={1_000} speed={90} className={styles.typewriterLine} />
          <br />
          <TypewriterText text="THIS SEASON" active={active} reducedMotion={reducedMotion} delay={1_850} speed={82} className={styles.typewriterLine} />
          <br />
          <TypewriterText text="SPECTACULAR." active={active} reducedMotion={reducedMotion} delay={2_950} speed={82} className={styles.typewriterLine} />
        </h2>
      </div>
      <aside className={styles.creditsViewport} aria-label="Players who competed during the season">
        <p className={styles.creditsHeading} aria-label="SEASON PLAYERS">
          <TypewriterText text="SEASON PLAYERS" active={active} reducedMotion={reducedMotion} delay={650} speed={64} />
        </p>
        <div
          className={styles.creditsRoll}
          style={{ animationDuration: `${creditsDurationSeconds}s` }}
        >
          {participants.length ? participants.map((participant, index) => (
            <div className={styles.creditEntry} key={participant.userId}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <strong>{participant.nickname}</strong>
              <span>{participant.team || "UNAFFILIATED PLAYER"}</span>
            </div>
          )) : (
            <div className={styles.creditEntry}>
              <small>00</small>
              <strong>PLAYER LIST UNAVAILABLE</strong>
              <span>REGENERATE THE WRAPPED SNAPSHOT</span>
            </div>
          )}
        </div>
      </aside>
    </section>
  );
}

function StatsIntroSlide({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  return (
    <section className={`${styles.slide} ${styles.statsIntroSlide}`} aria-label="It is time to see who led the season in numbers">
      <div className={styles.statsIntroGrid} aria-hidden="true" />
      <div className={styles.statsIntroCopy}>
        <p aria-label="AND NOW">
          <TypewriterText text="AND NOW..." active={active} reducedMotion={reducedMotion} delay={250} speed={105} />
        </p>
        <h2 aria-label="IT'S TIME TO SEE WHO LED THE SEASON IN NUMBERS">
          <TypewriterText text="IT'S TIME TO SEE" active={active} reducedMotion={reducedMotion} delay={1_350} speed={72} className={styles.typewriterLine} />
          <br />
          <TypewriterText text="WHO LED THE SEASON" active={active} reducedMotion={reducedMotion} delay={2_650} speed={68} className={styles.typewriterLine} />
          <br />
          <TypewriterText text="IN NUMBERS." active={active} reducedMotion={reducedMotion} delay={4_000} speed={82} className={styles.typewriterLine} />
        </h2>
      </div>
    </section>
  );
}

function EndThanksSlide() {
  return (
    <section className={`${styles.slide} ${styles.communityThanks}`} aria-label="Final community thank you">
      <p>FROM GOONGINGA LEAGUE</p>
      <h2>THANK YOU FOR<br />BACKING THE LEAGUE.</h2>
      <span>Every match watched, every clip shared, and every voice in the community made this season matter.</span>
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
            current.volume = 0.8;
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
            <h2 aria-label={title.replace(/\n/g, " ")} className={styles.sequenceTitle}>
              {title}
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
      </div>
      <div className={styles.mapCopy}>
        <p className={styles.eyebrow}>{story.eyebrow}</p>
        <h2>{story.title}</h2>
        <strong className={styles.mapName}>{map?.name || "No map data"}</strong>
        <span className={styles.mapCount}>{map ? `${map.count} PICK${map.count === 1 ? "" : "S"}` : "NO DATA"}</span>
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
  const [seasonTeams, setSeasonTeams] = useState<FinalsTeam[]>([]);
  const [finalsMatchup, setFinalsMatchup] = useState<FinalsTeam[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const introAudioRef = useRef<HTMLAudioElement>(null);
  const statsIntroAudioRef = useRef<HTMLAudioElement>(null);
  const highlightsAudioRef = useRef<HTMLAudioElement>(null);
  const musicFadeCancelsRef = useRef<Array<() => void>>([]);
  const musicPauseTimersRef = useRef<number[]>([]);
  const playerHighlightStartedAtRef = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    async function loadWrapped() {
      try {
        const tournament = await getCurrentTournament({ cache: "no-store" });
        const localPreview = process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("preview") === "1";
        if (tournament.state !== "FINALS" && !localPreview) {
          setError("The Finals experience unlocks when the tournament enters Finals.");
          return;
        }
        const [data, matches, teams] = await Promise.all([
          getGoongingaWrapped(),
          localPreview ? Promise.resolve([]) : getMatchesByTournament(tournament.id),
          getTeams(),
        ]);
        const tournamentTeams = (teams || [])
          .filter((team) => team.tournamentId === tournament.id)
          .map((team) => ({ id: team.id, name: team.name, logo: team.logo || null }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const teamLookup = new Map(tournamentTeams.map((team) => [team.id, team]));
        const finalsMatch = (matches || [])
          .filter((match) => Boolean(match.teamAId && match.teamBId) && (match.type === "FINALS" || /grand\s*final/i.test(match.title || "")))
          .sort((a, b) => {
            const liveA = a.status === "ACTIVE" || a.status === "SCHEDULED" ? 1 : 0;
            const liveB = b.status === "ACTIVE" || b.status === "SCHEDULED" ? 1 : 0;
            return liveB - liveA || Number(b.type === "FINALS") - Number(a.type === "FINALS") || b.id - a.id;
          })[0];
        const matchupTeams = finalsMatch
          ? [teamLookup.get(finalsMatch.teamAId!), teamLookup.get(finalsMatch.teamBId!)].filter((team): team is FinalsTeam => Boolean(team))
          : localPreview ? tournamentTeams.slice(0, 2) : [];
        if (matchupTeams.length !== 2) throw new Error("The Grand Final matchup has not been assigned yet.");
        setWrapped(data);
        setSeasonTeams(tournamentTeams);
        setFinalsMatchup(matchupTeams);
      } catch (err: any) {
        setError(err?.status === 404 ? "The Finals story is still being prepared." : err?.message || "Could not load the Goonginga Finals experience.");
      } finally {
        setLoading(false);
      }
    }
    void loadWrapped();
  }, []);

  const media = useMemo(() => wrapped ? resolveWrappedAssets(wrapped.assets) : null, [wrapped]);
  const introTrack = media?.soundtrack.intro || media?.soundtrack.recap;
  const statsIntroTrack = media?.soundtrack.statsIntro;
  const highlightsTrack = media?.soundtrack.highlights || media?.soundtrack.recap;
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

  const stories = useMemo<Story[]>(() => {
    if (!wrapped) return [];
    const snapshot = resolveWrappedSnapshot(wrapped.snapshot);
    const { averagesPer10, totals, performance, maps, heroes } = snapshot;
    const participants = snapshot.overview.participants;
    const creditsDurationSeconds = getCreditsDurationSeconds(participants.length);
    return [
      { id: "finalists", kind: "finalists", teams: finalsMatchup, durationSeconds: 12.5 },
      { id: "thanksBefore", kind: "thanksBefore", teams: seasonTeams.slice(0, 9), durationSeconds: Number(getStoryDuration("thanksBefore", 11)) },
      {
        id: "spectacular",
        kind: "spectacular",
        participants,
        durationSeconds: Math.max(Number(getStoryDuration("community", creditsDurationSeconds + 1.6)), creditsDurationSeconds + 1.6),
      },
      { id: "statsIntro", kind: "statsIntro", durationSeconds: Number(getStoryDuration("statsIntro", getStoryDuration("leaderboard", 7))) },
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
  }, [finalsMatchup, getStoryDuration, seasonTeams, wrapped]);

  const totalSlides = stories.length + 1;
  const musicPhase = useMemo<MusicPhase>(() => {
    if (!started) return "idle";
    const activeStory = activeIndex > 0 ? stories[activeIndex - 1] : null;
    if (activeStory?.kind === "statsIntro") return "statsIntro";
    const statsIntroIndex = stories.findIndex((story) => story.kind === "statsIntro") + 1;
    if (statsIntroIndex > 0 && activeIndex > statsIntroIndex) return "highlights";
    return "intro";
  }, [activeIndex, started, stories]);

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
      const intro = introAudioRef.current;
      if (intro) {
        intro.loop = false;
        intro.currentTime = 0;
        intro.volume = MUSIC_RESTING_VOLUME;
        void intro.play().catch(() => undefined);
      }
    }
    goTo(0, "auto");
  }, [goTo, started]);

  useEffect(() => {
    if (!wrapped || started) return;
    const mode = new URLSearchParams(window.location.search).get("autostart");
    if (mode !== "finals") return;
    setFinalsAutostart(true);
    setStarted(true);
    goTo(0, "auto");
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
    musicFadeCancelsRef.current.forEach((cancel) => cancel());
    musicFadeCancelsRef.current = [];
    musicPauseTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    musicPauseTimersRef.current = [];

    const intro = introAudioRef.current;
    const statsIntro = statsIntroAudioRef.current;
    const highlights = highlightsAudioRef.current;

    const fadeOutAndPause = (audio: HTMLAudioElement | null, durationMs = MUSIC_CROSSFADE_MS) => {
      if (!audio) return;
      if (audio.paused) {
        audio.volume = 0;
        return;
      }
      musicFadeCancelsRef.current.push(fadeAudio(audio, 0, durationMs));
      const timer = window.setTimeout(() => {
        audio.pause();
        try {
          audio.currentTime = 0;
        } catch {
          // Remote media may reject seeking until metadata is available.
        }
      }, durationMs + 80);
      musicPauseTimersRef.current.push(timer);
    };

    const fadeInTrack = (
      audio: HTMLAudioElement | null,
      targetVolume: number,
      durationMs: number,
    ) => {
      if (!audio) return;
      audio.loop = false;
      if (audio.paused || audio.ended) {
        try {
          audio.currentTime = 0;
        } catch {
          // Remote media may reject seeking until metadata is available.
        }
        audio.volume = 0;
        void audio.play().catch(() => undefined);
      }
      musicFadeCancelsRef.current.push(fadeAudio(audio, targetVolume, durationMs));
    };

    if (musicPhase === "idle") {
      fadeOutAndPause(intro, 250);
      fadeOutAndPause(statsIntro, 250);
      fadeOutAndPause(highlights, 250);
      return;
    }

    if (musicPhase === "intro") {
      fadeOutAndPause(statsIntro);
      fadeOutAndPause(highlights);
      fadeInTrack(intro, MUSIC_RESTING_VOLUME, MUSIC_FADE_IN_MS);
      return;
    }

    if (musicPhase === "statsIntro") {
      // "La quinta" is where we hand off from the intro song to the highlights
      // song. The intro always resolves and fades out gently here.
      fadeOutAndPause(intro, INTRO_RESOLVE_MS);
      if (statsIntroTrack?.url) {
        // A dedicated bridge track exists: let it carry the transition and keep
        // the highlights track silent until its own slide.
        fadeOutAndPause(highlights);
        fadeInTrack(statsIntro, MUSIC_RESTING_VOLUME, STATS_INTRO_FADE_IN_MS);
      } else {
        // No bridge track: the quinta itself is the transition. Because the two
        // songs are stylistically different, we do NOT overlap them. Song A
        // fades out first (above), then after a short breath song B swells in
        // on its own so it is established (at a bed level) before the first
        // highlight — a cinematic dip rather than a muddy crossfade.
        fadeOutAndPause(statsIntro, 250);
        const timer = window.setTimeout(() => {
          fadeInTrack(highlights, HIGHLIGHTS_BRIDGE_BED_VOLUME, HIGHLIGHTS_BRIDGE_RISE_MS);
        }, HIGHLIGHTS_BRIDGE_DELAY_MS);
        musicPauseTimersRef.current.push(timer);
      }
      return;
    }

    fadeOutAndPause(intro, 1_400);
    fadeOutAndPause(statsIntro, 1_100);
    // If the bridge already primed the highlights track during the quinta, it is
    // already playing at the bed level and the highlights sync effect owns its
    // volume from here (ducking to the highlight level). Only start it fresh if
    // it is not already playing — e.g. the viewer jumped straight to this phase.
    if (!highlights || highlights.paused) {
      fadeInTrack(highlights, MUSIC_RESTING_VOLUME, MUSIC_FADE_IN_MS);
    }
  }, [highlightsTrack?.url, introTrack?.url, musicPhase, statsIntroTrack?.url]);

  useEffect(() => {
    const highlights = highlightsAudioRef.current;
    if (!highlights || !highlightsTrack || !started || musicPhase !== "highlights") return;
    highlights.loop = false;
    void highlights.play().catch(() => undefined);
    const activeStory = activeIndex > 0 ? stories[activeIndex - 1] : null;
    const isPlayerHighlight = activeStory?.kind === "player";
    const isStoryAudioPlaying = isPlayerHighlight && storyAudioPlayingId === activeStory.id;
    const targetVolume = isStoryAudioPlaying || isPlayerHighlight
      ? MUSIC_HIGHLIGHT_VOLUME
      : MUSIC_RESTING_VOLUME;
    return fadeAudio(highlights, targetVolume, isStoryAudioPlaying ? 360 : 650);
  }, [activeIndex, highlightsTrack, musicPhase, started, stories, storyAudioPlayingId]);

  useEffect(() => () => {
    musicFadeCancelsRef.current.forEach((cancel) => cancel());
    musicPauseTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    [introAudioRef.current, statsIntroAudioRef.current, highlightsAudioRef.current].forEach((audio) => audio?.pause());
  }, []);

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
    const duration = activeIndex === 0
      ? Math.min(4.5, Number(getStoryDuration("intro", 4.5))) * 1000
      : activeStory?.kind === "player"
      ? Math.max(POST_COUNT_HOLD_MS, MIN_PLAYER_HIGHLIGHT_DURATION_MS - elapsed)
      : activeStory?.kind === "finalists"
          ? (activeStory.durationSeconds ?? 12.5) * 1000
          : activeStory?.kind === "thanksBefore"
            ? (activeStory.durationSeconds ?? 7.25) * 1000
            : activeStory?.kind === "spectacular"
              ? (activeStory.durationSeconds ?? 12.5) * 1000
              : activeStory?.kind === "statsIntro"
                // Floor the quinta so the two-song handoff always has room to
                // breathe (fade out A, breath, swell B in) before the cut.
                ? Math.max(activeStory.durationSeconds ?? 0, QUINTA_MIN_SECONDS) * 1000
                : STANDARD_STORY_DURATION_MS;
    const durationIncludesExit = activeIndex === 0 || activeStory?.kind === "finalists" || activeStory?.kind === "thanksBefore" || activeStory?.kind === "spectacular" || activeStory?.kind === "statsIntro";
    const exitAt = durationIncludesExit ? Math.max(0, duration - STORY_EXIT_DURATION_MS) : duration;
    let exitTimeout = 0;
    const timeout = window.setTimeout(() => {
      setLeavingIndex(activeIndex);
      exitTimeout = window.setTimeout(() => goTo(activeIndex + 1), STORY_EXIT_DURATION_MS);
    }, exitAt);
    return () => {
      window.clearTimeout(timeout);
      window.clearTimeout(exitTimeout);
    };
  }, [activeIndex, completedAudioStoryId, finalsAutostart, getStoryDuration, goTo, reducedMotion, started, stories, totalSlides]);

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
      {introTrack?.url && <audio ref={introAudioRef} src={introTrack.url} preload="auto" />}
      {statsIntroTrack?.url && <audio ref={statsIntroAudioRef} src={statsIntroTrack.url} preload="auto" />}
      {highlightsTrack?.url && <audio ref={highlightsAudioRef} src={highlightsTrack.url} preload="auto" />}
      <div className={styles.progress} aria-label={`Story ${activeIndex + 1} of ${totalSlides}`}>
        {Array.from({ length: totalSlides }).map((_, index) => <span key={index} className={index <= activeIndex ? styles.progressActive : ""} />)}
      </div>
      <div ref={scrollRef} className={styles.scrollTrack}>
        <IntroSlide onStart={beginPlayback} active={started && activeIndex === 0} reducedMotion={reducedMotion} />
        {stories.map((story, index) => {
          const storyIndex = index + 1;
          const isActive = started && activeIndex === storyIndex;
          return (
            <div key={story.id} className={`${styles.storyViewport} ${isActive ? styles.storyActive : ""} ${leavingIndex === storyIndex ? styles.storyLeaving : ""}`}>
              {story.kind === "player" && <PlayerSlide story={story} wrapped={wrapped} active={isActive} reducedMotion={reducedMotion} onStoryAudioPlaybackChange={setStoryAudioPlayback} onStoryAudioCompleted={setStoryAudioCompleted} />}
              {story.kind === "map" && <MapSlide story={story} wrapped={wrapped} />}
              {story.kind === "opening" && <OpeningSlide wrapped={wrapped} variant={story.variant} />}
              {story.kind === "finalists" && <FinalistsSlide teams={story.teams} active={isActive} reducedMotion={reducedMotion} />}
              {story.kind === "thanksBefore" && <ThanksBeforeSlide teams={story.teams} active={isActive} reducedMotion={reducedMotion} />}
              {story.kind === "spectacular" && <SpectacularSlide participants={story.participants} active={isActive} reducedMotion={reducedMotion} />}
              {story.kind === "statsIntro" && <StatsIntroSlide active={isActive} reducedMotion={reducedMotion} />}
              {story.kind === "heroBans" && <HeroBansSlide wrapped={wrapped} most={story.most} least={story.least} />}
              {story.kind === "finale" && <FinaleSlide wrapped={wrapped} active={isActive} reducedMotion={reducedMotion} />}
              {story.kind === "thanks" && <EndThanksSlide />}
              {story.kind === "transition" && <FinalsTransitionSlide />}
            </div>
          );
        })}
      </div>
      {started && (
        <div
          className={`${styles.filmOverlay} ${leavingIndex !== null ? styles.filmDipActive : ""}`}
          aria-hidden="true"
        >
          <div className={styles.filmGrain} />
          <div className={styles.filmDip} />
        </div>
      )}
      <div className={styles.controls}>
        <button type="button" onClick={() => goTo(activeIndex - 1)} disabled={activeIndex === 0} aria-label="Previous story">↑</button>
        <span>{String(activeIndex + 1).padStart(2, "0")} / {String(totalSlides).padStart(2, "0")}</span>
        <button type="button" onClick={() => { if (!started) beginPlayback(); else goTo(activeIndex + 1); }} disabled={activeIndex === totalSlides - 1} aria-label="Next story">↓</button>
      </div>
    </main>
  );
}
