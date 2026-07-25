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

type MetricCard = {
  key: WrappedAssetKey;
  label: string;
  value: WrappedPlayerLeader | null;
  precision?: number;
  suffix?: string;
};

type Story = {
  key: string;
  kind: "overview" | "matrix" | "performance" | "draft" | "ranking";
  eyebrow: string;
  title: string;
  deck: string;
  summary?: string;
  cards?: MetricCard[];
  lead?: WrappedPlayerLeader | null;
  leadLabel?: string;
  leadSuffix?: string;
  artKey?: WrappedAssetKey;
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

function LayoutShell({
  story,
  chapter,
  children,
  className,
}: {
  story: Story;
  chapter: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`${styles.storyPanel} ${className || ""}`} data-story-kind={story.kind}>
      <div className={styles.storyFrame}>
        <div className={styles.chapterBar}>
          <span>CHAPTER {String(chapter).padStart(2, "0")}</span>
          <span>{story.deck}</span>
        </div>
        <p className={styles.eyebrow}>{story.eyebrow}</p>
        <h2 className={styles.storyTitle}>{story.title}</h2>
      </div>
      <div className={styles.storyContent}>{children}</div>
    </article>
  );
}

function MetricCardView({ card, image }: { card: MetricCard; image?: string | null }) {
  const hasData = card.value !== null && card.value !== undefined;
  const precision = card.precision ?? 0;
  const displayValue = hasData ? formatNumber(card.value.value, precision) : "NO DATA";
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricCardBody}>
        <span className={styles.metricLabel}>{card.label}</span>
        <strong className={styles.metricValue}>{displayValue}{hasData && card.suffix ? <small>{card.suffix}</small> : null}</strong>
        <div className={styles.playerLine}>
          <span className={styles.playerDot} />
          <span>{card.value?.player || "Awaiting results"}</span>
          {card.value?.team ? <em>{card.value.team}</em> : null}
        </div>
        {card.value?.gameNumber ? <p className={styles.gameNote}>Recorded in game {card.value.gameNumber}</p> : null}
      </div>
      <div className={styles.metricCutout}>
        {image ? <img src={image} alt={card.label} className={styles.cutoutImage} /> : <div className={styles.metricPlaceholder}><span>PNG</span><small>RECORTADO</small></div>}
      </div>
    </article>
  );
}

function MatrixSlide({ story, wrapped, chapter, cards, reverse = false }: {
  story: Story;
  wrapped: GoongingaWrapped;
  chapter: number;
  cards: MetricCard[];
  reverse?: boolean;
}) {
  return (
    <LayoutShell story={story} chapter={chapter} className={`${styles.matrixShell} ${reverse ? styles.matrixReverse : ""}`}>
      <div className={styles.matrixHeader}>
        <p className={styles.slideKicker}>{story.deck}</p>
        <p className={styles.slideSummary}>{story.summary}</p>
        <div className={styles.slideStats}>
          <div><span>TEAMS</span><strong>{wrapped.snapshot.overview.teams.length}</strong></div>
          <div><span>GAMES</span><strong>{wrapped.snapshot.overview.games}</strong></div>
          <div><span>PLAYERS</span><strong>{wrapped.snapshot.overview.players}</strong></div>
        </div>
      </div>
      <div className={styles.matrixGrid}>
        {cards.map((card) => (
          <MetricCardView key={card.key} card={card} image={getImage(wrapped, card.key)} />
        ))}
      </div>
    </LayoutShell>
  );
}

function PerformanceSlide({ story, wrapped, chapter }: { story: Story; wrapped: GoongingaWrapped; chapter: number }) {
  const kda = wrapped.snapshot.performance.kda;
  return (
    <LayoutShell story={story} chapter={chapter} className={styles.performanceShell}>
      <div className={styles.performanceCopy}>
        <p className={styles.slideKicker}>{story.deck}</p>
        <p className={styles.slideSummary}>{story.summary}</p>
        <div className={styles.kdaBignumWrap}>
          <span className={styles.kdaLabel}>BEST KDA</span>
          <strong className={styles.kdaBignum}>{kda ? formatNumber(kda.value, 2) : "--"}<small> K/D</small></strong>
        </div>
        <div className={styles.playerLine}>
          <span className={styles.playerDot} />
          <span>{kda?.player || "Awaiting results"}</span>
          {kda?.team ? <em>{kda.team}</em> : null}
        </div>
      </div>
      <div className={styles.performanceVisual}>
        <div className={styles.performanceGlyph}>K/D</div>
        <div className={styles.cutoutStage}>
          {getImage(wrapped, "performanceKda") || getImage(wrapped, "kda") ? (
            <img src={getImage(wrapped, "performanceKda") || getImage(wrapped, "kda") || undefined} alt="Best KDA cutout" className={styles.cutoutImageLarge} />
          ) : (
            <div className={styles.metricPlaceholder}><span>KDA</span><small>EPIC CUTOUT</small></div>
          )}
        </div>
      </div>
    </LayoutShell>
  );
}

function DraftSlide({ story, wrapped, chapter }: { story: Story; wrapped: GoongingaWrapped; chapter: number }) {
  return (
    <LayoutShell story={story} chapter={chapter} className={styles.draftShell}>
      <div className={styles.draftGrid}>
        <article className={styles.draftPanel}>
          <p className={styles.slideKicker}>MOST BANNED HERO</p>
          <h3 className={styles.draftTitle}>{story.draftHero?.name || "NO DATA"}</h3>
          <p className={styles.draftCount}>{story.draftHero ? `${story.draftHero.count} bans` : "No banned hero data"}</p>
          <div className={styles.cutoutStage}>
            {getImage(wrapped, "mostBannedHero") ? <img src={getImage(wrapped, "mostBannedHero") || undefined} alt="Most banned hero" className={styles.cutoutImageLarge} /> : <div className={styles.metricPlaceholder}><span>HERO</span><small>NO BACKGROUND</small></div>}
          </div>
        </article>
        <article className={styles.draftPanel}>
          <p className={styles.slideKicker}>MOST PICKED MAP</p>
          <h3 className={styles.draftTitle}>{story.draftMap?.name || "NO DATA"}</h3>
          <p className={styles.draftCount}>{story.draftMap ? `${story.draftMap.count} picks` : "No picked map data"}</p>
          <div className={styles.cutoutStage}>
            {getImage(wrapped, "mostPickedMap") ? <img src={getImage(wrapped, "mostPickedMap") || undefined} alt="Most picked map" className={styles.cutoutImageLarge} /> : <div className={styles.metricPlaceholder}><span>MAP</span><small>NO BACKGROUND</small></div>}
          </div>
        </article>
      </div>
    </LayoutShell>
  );
}

function RankingSlide({ story, chapter }: { story: Story; chapter: number }) {
  return (
    <LayoutShell story={story} chapter={chapter} className={styles.rankingShell}>
      <div className={styles.rankingHeader}>
        <p className={styles.slideKicker}>{story.deck}</p>
        <p className={styles.slideSummary}>{story.summary}</p>
      </div>
      <div className={styles.rankingGrid}>
        {(story.ranking || []).map((item, index) => (
          <article className={styles.rankingCard} key={`${item.name}-${index}`}>
            <span className={styles.rankIndex}>0{index + 1}</span>
            <div className={styles.rankArt}>
              {item.image ? <img src={item.image} alt={item.name} className={styles.rankImage} /> : <div className={styles.metricPlaceholder}><span>MAP</span><small>LOW PLAY</small></div>}
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
        <h1>YOUR<br /><span>WRAPPED</span></h1>
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
        key: "averages",
        kind: "matrix",
        eyebrow: "BEST AVERAGES PER 10 MIN",
        title: "Season tempo leaders",
        deck: "AVERAGE TEMPO",
        summary: "The players who controlled fights every 10 minutes, not just across the whole season.",
        cards: [
          { key: "damagePer10", label: "Damage / 10", value: averagesPer10.damage, precision: 2 },
          { key: "healingPer10", label: "Healing / 10", value: averagesPer10.healing, precision: 2 },
          { key: "killsPer10", label: "Kills / 10", value: averagesPer10.kills, precision: 2 },
          { key: "assistsPer10", label: "Assists / 10", value: averagesPer10.assists, precision: 2 },
          { key: "mitigationPer10", label: "Mitigation / 10", value: averagesPer10.mitigation, precision: 2 },
          { key: "lowestDeathsPer10", label: "Deaths / 10", value: averagesPer10.lowestDeaths, precision: 2, suffix: " LOW" },
        ],
      },
      {
        key: "totals",
        kind: "matrix",
        eyebrow: "TOTAL SEASON SUMS",
        title: "The big numbers",
        deck: "SEASON TOTALS",
        summary: "Absolute production after the full season, summed across every finished match.",
        cards: [
          { key: "damageTotal", label: "Total Damage", value: totals.damage },
          { key: "healingTotal", label: "Total Healing", value: totals.healing },
          { key: "killsTotal", label: "Total Kills", value: totals.kills },
          { key: "assistsTotal", label: "Total Assists", value: totals.assists },
          { key: "mitigationTotal", label: "Total Mitigation", value: totals.mitigation },
        ],
      },
      {
        key: "kda",
        kind: "performance",
        eyebrow: "BEST PERFORMANCE",
        title: "Cleanest K/D in the league",
        deck: "KDA",
        summary: "The season's sharpest performance index, built on the full stat trail.",
        lead: performance.kda,
      },
      {
        key: "draft",
        kind: "draft",
        eyebrow: "THE DRAFT HAS SPOKEN",
        title: "Ban pressure and map control",
        deck: "DRAFT POWER",
        summary: "The hero nobody wanted and the map everybody trusted.",
        draftHero: draft.mostBannedHero,
        draftMap: draft.mostPickedMap,
      },
      {
        key: "leastMaps",
        kind: "ranking",
        eyebrow: "MAPS LESS PLAYED",
        title: "The quiet corners of the pool",
        deck: "LOW USAGE MAPS",
        summary: "The maps that stayed at the bottom of the rotation.",
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
  const reverseLayout = Boolean((index - 1) % 2);

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
        ) : story?.kind === "matrix" && story.cards ? (
          <MatrixSlide story={story} wrapped={wrapped} chapter={index} cards={story.cards} reverse={reverseLayout} />
        ) : story?.kind === "performance" ? (
          <PerformanceSlide story={story} wrapped={wrapped} chapter={index} />
        ) : story?.kind === "draft" ? (
          <DraftSlide story={story} wrapped={wrapped} chapter={index} />
        ) : story?.kind === "ranking" ? (
          <RankingSlide story={story} chapter={index} />
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
