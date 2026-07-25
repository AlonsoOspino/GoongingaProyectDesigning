"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getGoongingaWrapped, type GoongingaWrapped, type WrappedAssetKey, type WrappedPlayerLeader } from "@/lib/api/wrapped";
import styles from "./wrapped.module.css";

type Story = {
  key: WrappedAssetKey;
  eyebrow: string;
  title: string;
  label: string;
  value: number | null;
  player?: WrappedPlayerLeader | null;
  suffix?: string;
  artwork?: string | null;
};

function formatNumber(value: number | null, decimals = 0) {
  if (value === null || value === undefined) return "--";
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function PlayerStory({ story, image }: { story: Story; image?: string | null }) {
  const hasData = story.value !== null && story.value !== undefined;
  return (
    <article className={styles.storyPanel}>
      <div className={styles.copyColumn}>
        <p className={styles.eyebrow}>{story.eyebrow}</p>
        <h2 className={styles.storyTitle}>{story.title}</h2>
        <div className={styles.metricBlock}>
          <span className={styles.metricLabel}>{story.label}</span>
          <strong className={styles.metricValue}>{hasData ? formatNumber(story.value, story.key === "kda" ? 2 : 0) : "NO DATA"}{hasData && story.suffix ? <small>{story.suffix}</small> : null}</strong>
        </div>
        <div className={styles.playerLine}>
          <span className={styles.playerDot} />
          <span>{story.player?.player || "Awaiting results"}</span>
          {story.player?.team ? <em>{story.player.team}</em> : null}
        </div>
        {story.player?.gameNumber ? <p className={styles.gameNote}>Recorded in game {story.player.gameNumber}</p> : null}
      </div>
      <div className={styles.artColumn}>
        <div className={styles.artworkFrame}>
          {image ? <img src={image} alt="Wrapped featured cutout" className={styles.artwork} /> : <div className={styles.artworkPlaceholder}><span>PNG</span><small>UPLOAD CUTOUT</small></div>}
        </div>
        <div className={styles.artGlow} />
      </div>
    </article>
  );
}

function DraftStory({ story, image, detail }: { story: Story; image?: string | null; detail: string | null }) {
  return (
    <article className={styles.storyPanel}>
      <div className={styles.copyColumn}>
        <p className={styles.eyebrow}>{story.eyebrow}</p>
        <h2 className={styles.storyTitle}>{story.title}</h2>
        <div className={styles.metricBlock}>
          <span className={styles.metricLabel}>{story.label}</span>
          <strong className={`${styles.metricValue} ${styles.nameValue}`}>{detail || "NO DATA"}</strong>
        </div>
        <div className={styles.playerLine}><span className={styles.playerDot} /><span>{story.value ? `${formatNumber(story.value)} draft selections` : "No completed draft data"}</span></div>
      </div>
      <div className={styles.artColumn}>
        <div className={styles.artworkFrame}>
          {image ? <img src={image} alt={detail || "Wrapped draft feature"} className={styles.artwork} /> : <div className={styles.artworkPlaceholder}><span>PNG</span><small>UPLOAD CUTOUT</small></div>}
        </div>
        <div className={styles.artGlow} />
      </div>
    </article>
  );
}

function Intro({ wrapped, onStart }: { wrapped: GoongingaWrapped; onStart: () => void }) {
  const teams = wrapped.snapshot.overview.teams;
  return (
    <section className={styles.introPanel}>
      <div className={styles.introCopy}>
        <p className={styles.eyebrow}>GOONGINGA LEAGUE PRESENTS</p>
        <h1>YOUR<br /><span>WRAPPED</span></h1>
        <p className={styles.introText}>In {wrapped.snapshot.overview.weeks} weeks, {wrapped.snapshot.overview.players} players turned {wrapped.snapshot.overview.games} games into a season worth replaying.</p>
        <button type="button" className={styles.startButton} onClick={onStart}>Start the story <span aria-hidden="true">&gt;</span></button>
      </div>
      <div className={styles.orbitStage} aria-label="Participating teams">
        <div className={styles.orbitRing} />
        <div className={styles.orbitRingInner} />
        <div className={styles.orbitCore}><span>GG</span><small>{wrapped.snapshot.tournament.name}</small></div>
        {teams.slice(0, 12).map((team, index) => {
          const degrees = (360 / Math.max(teams.slice(0, 12).length, 1)) * index;
          return (
            <div key={team.id} className={styles.orbitTeam} style={{ "--team-angle": `${degrees}deg`, "--team-index": index } as CSSProperties}>
              <div className={styles.teamBadge}>{team.logo ? <img src={team.logo} alt={team.name} /> : <span>{team.name.slice(0, 2).toUpperCase()}</span>}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function WrappedPage() {
  const [wrapped, setWrapped] = useState<GoongingaWrapped | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

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
    const { leaders, draft } = wrapped.snapshot;
    return [
      { key: "kills", eyebrow: "BEST PLAYERS IN", title: "The elimination artist", label: "KILLS", value: leaders.kills?.value ?? null, player: leaders.kills },
      { key: "healing", eyebrow: "BEST PLAYERS IN", title: "Keeping the squad alive", label: "HEALING", value: leaders.healing?.value ?? null, player: leaders.healing },
      { key: "assists", eyebrow: "BEST PLAYERS IN", title: "Always in the play", label: "ASSISTS", value: leaders.assists?.value ?? null, player: leaders.assists },
      { key: "lowestDeaths", eyebrow: "BEST PLAYERS IN", title: "Impossible to pin down", label: "LOWEST DEATHS", value: leaders.lowestDeaths?.value ?? null, player: leaders.lowestDeaths },
      { key: "mitigation", eyebrow: "BEST PLAYERS IN", title: "Nothing gets through", label: "MITIGATION", value: leaders.mitigation?.value ?? null, player: leaders.mitigation },
      { key: "kda", eyebrow: "BEST PLAYERS IN", title: "The cleanest K/D", label: "K/D RATIO", value: leaders.kda?.value ?? null, player: leaders.kda, suffix: " K/D" },
      { key: "totalDamage", eyebrow: "SEASON TOTALS", title: "Damage, all season long", label: "TOTAL DAMAGE", value: leaders.totalDamage?.value ?? null, player: leaders.totalDamage },
      { key: "totalHealing", eyebrow: "SEASON TOTALS", title: "Every point of recovery", label: "TOTAL HEALING", value: leaders.totalHealing?.value ?? null, player: leaders.totalHealing },
      { key: "mostBannedHero", eyebrow: "THE DRAFT HAS SPOKEN", title: "Nobody wanted this hero around", label: "MOST BANNED HERO", value: draft.mostBannedHero?.count ?? null, artwork: draft.mostBannedHero?.image },
      { key: "mostPickedMap", eyebrow: "THE DRAFT HAS SPOKEN", title: "The map we came back to", label: "MOST PICKED MAP", value: draft.mostPickedMap?.count ?? null, artwork: draft.mostPickedMap?.image },
    ];
  }, [wrapped]);

  function advance(step: number) {
    setIndex((current) => Math.min(Math.max(current + step, 0), stories.length));
  }

  if (loading) return <main className={styles.loading}>Building the season story...</main>;
  if (error || !wrapped) return <main className={styles.empty}><p>GOONGINGA WRAPPED</p><h1>{error || "No Wrapped found"}</h1></main>;

  const isIntro = index === 0;
  const story = stories[index - 1];
  const isDraftStory = story?.key === "mostBannedHero" || story?.key === "mostPickedMap";
  const draftDetail = story?.key === "mostBannedHero" ? wrapped.snapshot.draft.mostBannedHero?.name || null : wrapped.snapshot.draft.mostPickedMap?.name || null;
  const image = story ? wrapped.assets[story.key] || story.artwork || null : null;

  return (
    <main className={styles.wrapped}>
      <div className={styles.noise} />
      <div className={styles.progress} aria-hidden="true">
        {Array.from({ length: stories.length + 1 }).map((_, itemIndex) => <span key={itemIndex} className={itemIndex <= index ? styles.progressActive : ""} />)}
      </div>
      <div className={styles.storyCounter}>{String(index + 1).padStart(2, "0")} / {String(stories.length + 1).padStart(2, "0")}</div>
      <div className={styles.content}>
        {isIntro ? <Intro wrapped={wrapped} onStart={() => advance(1)} /> : isDraftStory && story ? <DraftStory story={story} image={image} detail={draftDetail} /> : story ? <PlayerStory story={story} image={image} /> : null}
      </div>
      <div className={styles.controls}>
        <button type="button" onClick={() => advance(-1)} disabled={index === 0} aria-label="Previous story">&lt;</button>
        <button type="button" onClick={() => advance(1)} disabled={index === stories.length} aria-label="Next story">&gt;</button>
      </div>
      <p className={styles.footerMark}>GOONGINGA LEAGUE · {new Date(wrapped.generatedAt).getFullYear()}</p>
    </main>
  );
}
