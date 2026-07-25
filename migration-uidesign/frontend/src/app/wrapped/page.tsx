"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  getGoongingaWrapped,
  type GoongingaWrapped,
  type WrappedAssetKey,
  type WrappedMapRanking,
  type WrappedPlayerLeader,
} from "@/lib/api/wrapped";
import styles from "./wrapped.module.css";

type Story = {
  key: string;
  kind: "metric" | "draft" | "ranking";
  eyebrow: string;
  title: string;
  deck: string;
  summary: string;
  side: "left" | "right";
  metric?: WrappedPlayerLeader | null;
  metricLabel?: string;
  precision?: number;
  suffix?: string;
  imageKey?: WrappedAssetKey;
  draftHero?: WrappedMapRanking | null;
  draftMap?: WrappedMapRanking | null;
  ranking?: WrappedMapRanking[];
};

function formatNumber(value: number | null, decimals = 0) {
  if (value === null || value === undefined) return "--";
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function getImage(wrapped: GoongingaWrapped, key?: WrappedAssetKey | null) {
  if (!key) return null;
  return wrapped.assets[key] || null;
}

function animatedHeadline(text: string) {
  return text.split(/(\s+)/).map((part, wordIndex) => {
    if (/^\s+$/.test(part)) return part;
    return (
      <span key={`${part}-${wordIndex}`} className={styles.headlineWord}>
        {part.split("").map((char, charIndex) => (
          <span key={`${char}-${charIndex}`} className={styles.headlineChar} style={{ "--char-index": charIndex } as CSSProperties}>
            {char}
          </span>
        ))}
      </span>
    );
  });
}

function LayoutShell({ story, chapter, children, className }: { story: Story; chapter: number; children: ReactNode; className?: string; }) {
  return (
    <article className={`${styles.storyPanel} ${story.side === "right" ? styles.alignRight : styles.alignLeft} ${className || ""}`} data-story-kind={story.kind}>
      <div className={styles.storyFrame}>
        <div className={styles.chapterBar}>
          <span>CHAPTER {String(chapter).padStart(2, "0")}</span>
          <span>{story.deck}</span>
        </div>
        <p className={styles.eyebrow}>{story.eyebrow}</p>
        <h2 className={styles.storyTitle}>{animatedHeadline(story.title)}</h2>
        <p className={styles.slideSummary}>{story.summary}</p>
      </div>
      <div className={styles.storyContent}>{children}</div>
    </article>
  );
}

function MetricSlide({ story, wrapped, chapter }: { story: Story; wrapped: GoongingaWrapped; chapter: number }) {
  const hasData = story.metric !== null && story.metric !== undefined;
  const image = getImage(wrapped, story.imageKey);
  return (
    <LayoutShell story={story} chapter={chapter} className={styles.metricShell}>
      <div className={styles.metricCopy}>
        <div className={styles.metricLabel}>{story.metricLabel}</div>
        <strong className={styles.metricValue}>{hasData ? formatNumber(story.metric!.value, story.precision ?? 0) : "NO DATA"}{hasData && story.suffix ? <small>{story.suffix}</small> : null}</strong>
        <div className={styles.playerLine}>
          <span className={styles.playerDot} />
          <span>{story.metric?.player || "Awaiting results"}</span>
          {story.metric?.team ? <em>{story.metric.team}</em> : null}
        </div>
        {story.metric?.gameNumber ? <p className={styles.gameNote}>Recorded in game {story.metric.gameNumber}</p> : null}
      </div>
      <div className={styles.stageVisual}>
        <div className={styles.visualGlyph}>{story.deck}</div>
        <div className={`${styles.heroCutout} ${story.side === "right" ? styles.heroCutoutRight : styles.heroCutoutLeft}`}>
          {image ? <img src={image} alt={story.metricLabel || story.title} className={styles.cutoutImage} /> : <div className={styles.metricPlaceholder}><span>PNG</span><small>NO FRAME</small></div>}
        </div>
      </div>
    </LayoutShell>
  );
}

function DraftSlide({ story, wrapped, chapter }: { story: Story; wrapped: GoongingaWrapped; chapter: number }) {
  const imageHero = getImage(wrapped, "mostBannedHero");
  const imageMap = getImage(wrapped, "mostPickedMap");
  return (
    <LayoutShell story={story} chapter={chapter} className={styles.draftShell}>
      <div className={styles.draftStrip}>
        <article className={styles.draftCard}>
          <span className={styles.slideKicker}>MOST BANNED HERO</span>
          <h3 className={styles.draftTitle}>{story.draftHero?.name || "NO DATA"}</h3>
          <p className={styles.draftCount}>{story.draftHero ? `${story.draftHero.count} bans` : "No banned hero data"}</p>
          <div className={styles.heroCutout}><img src={imageHero || undefined} alt="Most banned hero" className={styles.cutoutImage} /></div>
        </article>
        <article className={styles.draftCard}>
          <span className={styles.slideKicker}>MOST PICKED MAP</span>
          <h3 className={styles.draftTitle}>{story.draftMap?.name || "NO DATA"}</h3>
          <p className={styles.draftCount}>{story.draftMap ? `${story.draftMap.count} picks` : "No picked map data"}</p>
          <div className={styles.heroCutout}><img src={imageMap || undefined} alt="Most picked map" className={styles.cutoutImage} /></div>
        </article>
      </div>
    </LayoutShell>
  );
}

function LeastMapsSlide({ story, wrapped, chapter }: { story: Story; wrapped: GoongingaWrapped; chapter: number }) {
  const mapKeys: Array<WrappedAssetKey> = ["leastPickedMap1", "leastPickedMap2", "leastPickedMap3"];
  return (
    <LayoutShell story={story} chapter={chapter} className={styles.rankingShell}>
      <div className={styles.rankingGrid}>
        {(story.ranking || []).map((item, index) => (
          <article className={styles.rankingCard} key={`${item.name}-${index}`}>
            <span className={styles.rankIndex}>0{index + 1}</span>
            <div className={styles.rankArt}>
              {getImage(wrapped, mapKeys[index]) ? <img src={getImage(wrapped, mapKeys[index]) || undefined} alt={item.name} className={styles.rankImage} /> : <div className={styles.metricPlaceholder}><span>MAP</span><small>LOW PICK</small></div>}
            </div>
            <div className={styles.rankText}>
              <h3>{item.name}</h3>
              <strong>{item.count}</strong>
              <span>plays</span>
            </div>
          </article>
        ))}
      </div>
    </LayoutShell>
  );
}

function Intro({ wrapped, onStart }: { wrapped: GoongingaWrapped; onStart: () => void }) {
  const teams = wrapped.snapshot.overview.teams;
  return (
    <section className={styles.introPanel}>
      <div className={styles.introCopy}>
        <div className={styles.heroBanner}>
          <span>OVERWATCH LEAGUE ARCHIVE</span>
          <span>POWERED BY GOONGINGA</span>
        </div>
        <p className={styles.eyebrow}>GOONGINGA LEAGUE PRESENTS</p>
        <h1>{animatedHeadline("YOUR WRAPPED")}</h1>
        <p className={styles.introText}>In {wrapped.snapshot.overview.weeks} weeks, {wrapped.snapshot.overview.players} players turned {wrapped.snapshot.overview.games} games into a season worth replaying.</p>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}><span>TEAMS</span><strong>{teams.length}</strong></div>
          <div className={styles.heroStat}><span>GAMES</span><strong>{wrapped.snapshot.overview.games}</strong></div>
          <div className={styles.heroStat}><span>PLAYERS</span><strong>{wrapped.snapshot.overview.players}</strong></div>
        </div>
        <button type="button" className={styles.startButton} onClick={onStart}>Start the story <span aria-hidden="true">&gt;</span></button>
      </div>
      <div className={styles.orbitStage} aria-label="Participating teams">
        <div className={styles.stageHeader}><span>ARENA ROSTER</span><strong>{teams.length}</strong></div>
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
    const { averagesPer10, totals, performance, draft } = wrapped.snapshot;
    return [
      {
        key: "bestAverageKills",
        kind: "metric",
        eyebrow: "BEST AVERAGES PER 10 MIN",
        title: "Best Average Kills",
        deck: "AVERAGE KILLS",
        summary: "The player with the sharpest kill production every 10 minutes.",
        side: "left",
        metric: averagesPer10.kills,
        metricLabel: "Best Average Kills",
        precision: 2,
        imageKey: "bestAverageKills",
      },
      {
        key: "bestAverageDamage",
        kind: "metric",
        eyebrow: "BEST AVERAGES PER 10 MIN",
        title: "Best Average Damage",
        deck: "AVERAGE DAMAGE",
        summary: "The damage leader who dictated the pace every 10 minutes.",
        side: "right",
        metric: averagesPer10.damage,
        metricLabel: "Best Average Damage",
        precision: 2,
        imageKey: "bestAverageDamage",
      },
      {
        key: "bestAverageMitigation",
        kind: "metric",
        eyebrow: "BEST AVERAGES PER 10 MIN",
        title: "Best Average Mitigation",
        deck: "AVERAGE MITIGATION",
        summary: "The player who absorbed the most pressure every 10 minutes.",
        side: "left",
        metric: averagesPer10.mitigation,
        metricLabel: "Best Average Mitigation",
        precision: 2,
        imageKey: "bestAverageMitigation",
      },
      {
        key: "bestAverageHealing",
        kind: "metric",
        eyebrow: "BEST AVERAGES PER 10 MIN",
        title: "Best Average Healing",
        deck: "AVERAGE HEALING",
        summary: "The healer keeping the team alive with the cleanest output per 10.",
        side: "right",
        metric: averagesPer10.healing,
        metricLabel: "Best Average Healing",
        precision: 2,
        imageKey: "bestAverageHealing",
      },
      {
        key: "bestAverageAssists",
        kind: "metric",
        eyebrow: "BEST AVERAGES PER 10 MIN",
        title: "Best Average Assists",
        deck: "AVERAGE ASSISTS",
        summary: "The player enabling fights every 10 minutes with constant playmaking.",
        side: "left",
        metric: averagesPer10.assists,
        metricLabel: "Best Average Assists",
        precision: 2,
        imageKey: "bestAverageAssists",
      },
      {
        key: "bestAverageLowestDeaths",
        kind: "metric",
        eyebrow: "BEST AVERAGES PER 10 MIN",
        title: "Best Average Lowest Deaths",
        deck: "AVERAGE SURVIVAL",
        summary: "The safest player per 10, surviving fights at the highest rate.",
        side: "right",
        metric: averagesPer10.lowestDeaths,
        metricLabel: "Best Average Lowest Deaths",
        precision: 2,
        imageKey: "bestAverageLowestDeaths",
        suffix: " LOW",
      },
      {
        key: "mostDamageDealt",
        kind: "metric",
        eyebrow: "SEASON SUMS",
        title: "Most Damage Dealt",
        deck: "TOTAL DAMAGE",
        summary: "The raw damage stack after the season-long grind.",
        side: "left",
        metric: totals.damage,
        metricLabel: "Most Damage Dealt",
        imageKey: "mostDamageDealt",
      },
      {
        key: "biggestHealingOutput",
        kind: "metric",
        eyebrow: "SEASON SUMS",
        title: "Biggest Healing Output",
        deck: "TOTAL HEALING",
        summary: "The healing total that carried the longest.",
        side: "right",
        metric: totals.healing,
        metricLabel: "Biggest Healing Output",
        imageKey: "biggestHealingOutput",
      },
      {
        key: "mitigationTotal",
        kind: "metric",
        eyebrow: "SEASON SUMS",
        title: "Mitigation",
        deck: "TOTAL MITIGATION",
        summary: "The full-season mitigation total, no filters.",
        side: "left",
        metric: totals.mitigation,
        metricLabel: "Mitigation",
        imageKey: "mitigationTotal",
      },
      {
        key: "bestIndividualPerformanceKda",
        kind: "metric",
        eyebrow: "BEST PERFORMANCE",
        title: "Best Individual Perfomance (KDA)",
        deck: "KDA",
        summary: "The cleanest individual K/D performance of the season.",
        side: "right",
        metric: performance.kda,
        metricLabel: "Best Individual Perfomance (KDA)",
        precision: 2,
        imageKey: "bestIndividualPerformanceKda",
        suffix: " K/D",
      },
      {
        key: "mostBannedHero",
        kind: "draft",
        eyebrow: "THE DRAFT HAS SPOKEN",
        title: "Most banned Hero",
        deck: "DRAFT BAN",
        summary: "The hero that got removed from the pool over and over.",
        side: "left",
        draftHero: draft.mostBannedHero,
      },
      {
        key: "mostPickedMap",
        kind: "draft",
        eyebrow: "THE DRAFT HAS SPOKEN",
        title: "Most picked Map",
        deck: "DRAFT PICK",
        summary: "The map the season kept choosing again and again.",
        side: "right",
        draftMap: draft.mostPickedMap,
      },
      {
        key: "leastPickedMaps",
        kind: "ranking",
        eyebrow: "LEAST PICKED MAPS",
        title: "Least picked maps",
        deck: "LOW ROTATION",
        summary: "The three maps that stayed on the floor the most.",
        side: "left",
        ranking: draft.leastPlayedMaps,
      },
    ];
  }, [wrapped]);

  function advance(step: number) {
    setIndex((current) => Math.min(Math.max(current + step, 0), stories.length));
  }

  if (loading) return <main className={styles.loading}>Building the season story...</main>;
  if (error || !wrapped) return <main className={styles.empty}><p>GOONGINGA WRAPPED</p><h1>{error || "No Wrapped found"}</h1></main>;

  const isIntro = index === 0;
  const story = stories[index - 1];

  return (
    <main className={styles.wrapped}>
      <div className={styles.noise} />
      <div className={styles.heroBackdrop} aria-hidden="true" />
      <div className={styles.progress} aria-hidden="true">
        {Array.from({ length: stories.length + 1 }).map((_, itemIndex) => <span key={itemIndex} className={itemIndex <= index ? styles.progressActive : ""} />)}
      </div>
      <div className={styles.storyCounter}>{String(index + 1).padStart(2, "0")} / {String(stories.length + 1).padStart(2, "0")}</div>
      <div className={styles.content}>
        {isIntro ? (
          <Intro wrapped={wrapped} onStart={() => advance(1)} />
        ) : story?.kind === "metric" ? (
          <MetricSlide story={story} wrapped={wrapped} chapter={index} />
        ) : story?.kind === "draft" ? (
          <DraftSlide story={story} wrapped={wrapped} chapter={index} />
        ) : story?.kind === "ranking" ? (
          <LeastMapsSlide story={story} wrapped={wrapped} chapter={index} />
        ) : null}
      </div>
      <div className={styles.controls}>
        <button type="button" onClick={() => advance(-1)} disabled={index === 0} aria-label="Previous story">&lt;</button>
        <button type="button" onClick={() => advance(1)} disabled={index === stories.length} aria-label="Next story">&gt;</button>
      </div>
      <p className={styles.footerMark}>GOONGINGA LEAGUE · {new Date(wrapped.generatedAt).getFullYear()}</p>
    </main>
  );
}
