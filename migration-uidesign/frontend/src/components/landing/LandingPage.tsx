"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SeasonArchiveCard from "./SeasonArchiveCard";
import WhoWeAre from "./WhoWeAre";
import TournamentMode from "./TournamentMode";
import GridFigure, { type FigureEdge } from "./GridFigure";
import BrandField from "./atmosphere/BrandField";
import { useStoryMotion } from "@/components/story/useStoryMotion";
import {
  ChapterIndex,
  RevealWords,
  Story,
  type Chapter,
} from "@/components/story/StoryParts";
import { getRecentNetworkMembers } from "@/lib/api/networkMember";
import type { NetworkMember } from "@/lib/api/types";
import { getActiveAnnouncements } from "@/lib/api/announcement";
import type { ActiveAnnouncements } from "@/announcements/types";
import styles from "./landing.module.css";
import {
  ArrowIcon,
  DISCORD_INVITE,
  DiscordIcon,
  TWITCH_URL,
  TwitchIcon,
} from "./brandAssets";

const GGL_EDGES: FigureEdge[] = ["left", "right", "top", "bottom"];
const GAME_NIGHT_EDGES: FigureEdge[] = ["left", "right", "top", "bottom"];

const chapters: Chapter[] = [
  { id: "ggl", label: "GGL" },
  { id: "games", label: "Game night" },
  { id: "discord", label: "Discord" },
];

function CommunityCarousel({ members }: { members: NetworkMember[] }) {
  // Mapped vertically, one per row, big enough to actually see who joined.
  const visible = members.slice(0, 6);

  return (
    <div className={styles.joinedRail} aria-label="Newest community members">
      <p className={styles.joinedLabel}>
        <span className={styles.liveDot} aria-hidden="true" />
        Newest members
      </p>
      <ul className={styles.memberList}>
        {visible.map((member, index) => (
          <li
            key={member.id}
            className={styles.memberRow}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            {member.avatarUrl ? (
              <img
                className={styles.memberAvatar}
                src={member.avatarUrl}
                alt=""
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className={styles.memberAvatar} data-fallback="true">
                {member.username.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className={styles.memberName}>{member.username}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}


interface BuilderCard {
  id: number;
  eyebrow?: string;
  headline: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  countdownAt?: string | null;
}

export function LandingPage() {
  const landingRef = useRef<HTMLDivElement | null>(null);
  const [announcements, setAnnouncements] = useState<ActiveAnnouncements | null>(null);
  const [recentMembers, setRecentMembers] = useState<NetworkMember[] | null>(null);

  useStoryMotion(landingRef);



  useEffect(() => {
    let mounted = true;
    const load = () => {
      getActiveAnnouncements()
        .then((next) => {
          if (mounted) setAnnouncements(next);
        })
        .catch(() => undefined);
    };
    load();
    const poll = window.setInterval(load, 12000);
    return () => {
      mounted = false;
      window.clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getRecentNetworkMembers()
      .then((members) => {
        if (mounted) setRecentMembers(members.slice(0, 8));
      })
      .catch(() => {
        if (mounted) setRecentMembers([]);
      });
    return () => {
      mounted = false;
    };
  }, []);




  /*
    The landing renders the free-form announcement voices (form + custom).
    Tournament announcements keep their dedicated surface.
  */
  const builderCards: BuilderCard[] =
    announcements?.enabled && announcements.announcements.length > 0
      ? announcements.announcements.flatMap((entry) => {
          const content = entry.content;
          if ("formUrl" in content) {
            return [
              {
                id: entry.id,
                headline: content.headline,
                body: content.body,
                ctaLabel: content.ctaLabel || "Open form",
                ctaHref: content.formUrl,
                countdownAt: entry.countdownAt,
              },
            ];
          }
          if ("ctaHref" in content) {
            return [
              {
                id: entry.id,
                eyebrow: content.eyebrow,
                headline: content.headline,
                body: content.body,
                ctaLabel: content.ctaLabel || "Learn more",
                ctaHref: content.ctaHref,
                countdownAt: entry.countdownAt,
              },
            ];
          }
          return [];
        })
      : [];

  const footerLeagueLinks = [
    { href: "/season-9", label: "Season 9" },
    { href: "/wrapped", label: "Wrapped" },
    { href: "/history", label: "GGL History" },
    { href: "/standings", label: "Standings" },
    { href: "/teams", label: "Teams" },
    { href: "/schedule", label: "Schedule" },
    { href: "/stats", label: "Stats" },
  ];

  const mobileLinks = [
    { href: "/#about", label: "About" },
    { href: "/news", label: "News" },
    { href: "/history", label: "GGL History" },
    { href: "/season-9", label: "Season 9" },
  ];

  return (
    <div ref={landingRef} className={styles.landing} data-landing-root>

      <main id="top">
        <div className={styles.brandZone}>
          <BrandField variant="zone" />

        <section className={styles.hero} data-hero>

          <div className={styles.heroInner}>
            <div className={styles.heroCopy} data-hero-copy>
              <div className={styles.heroRule} aria-hidden="true" />
              <p className={styles.eyebrow}>ON AIR SINCE 2023</p>
              <h1 className={styles.h1}>
                <span className={styles.heroLine}>overtime</span>
                <span className={styles.heroLine}>productions</span>
              </h1>
              <p className={styles.heroSub}>
                A very active community that hosts streams &amp; events of many games like Overwatch,
                Deadlock, League of Legends and more!
              </p>
              <div className={styles.heroCtas}>
                <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className={styles.btnPrimary}>
                  Join the Discord <ArrowIcon />
                </a>
              </div>
              <div className={styles.scrollCue} aria-hidden="true">
                <span>Scroll to tune in</span>
                <i />
              </div>
            </div>
          </div>
        </section>

        <section className={styles.announceSection} id="announcements" aria-label="Announcements">
          <div className={styles.announceInner}>
            <div className={styles.announceStream}>
            {announcements?.mode === "CUSTOM" && builderCards.length > 0 ? (
              builderCards.slice(0, 2).map((card) => {
                const expired = card.countdownAt
                  ? new Date(card.countdownAt).getTime() <= Date.now()
                  : false;
                return (
                  <article key={card.id} className={styles.announceCard}>
                    <div className={styles.announceBody}>
                      <div className={styles.announceLabelRow}>
                        <span className={styles.liveDot} aria-hidden="true" />
                        <span className={styles.announceLabel}>{card.eyebrow || "Announcement"}</span>
                      </div>
                      <div className={styles.announceMain}>
                        <div>
                          <h2 className={styles.announceHeadline}>{card.headline}</h2>
                          {card.body ? <p className={styles.announceText}>{card.body}</p> : null}
                        </div>
                        <div className={styles.announceActions}>
                          {expired ? (
                            <span className={styles.closedNotice}>Closed</span>
                          ) : card.ctaHref ? (
                            <Link
                              href={card.ctaHref}
                              className={styles.btnPrimary}
                              target={card.ctaHref.startsWith("http") ? "_blank" : undefined}
                              rel={card.ctaHref.startsWith("http") ? "noopener noreferrer" : undefined}
                            >
                              {card.ctaLabel}
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              // Tournament mode (the default) draws its own block from the live
              // season; a custom mode with nothing chosen falls through to it too.
              <TournamentMode />
            )}
            </div>

            {recentMembers && recentMembers.length > 0 ? <CommunityCarousel members={recentMembers} /> : null}
          </div>
        </section>
        </div>


        <WhoWeAre />

        <Story>
          <ChapterIndex chapters={chapters} />

        <section className={styles.gglSection} id="about" data-chapter="ggl">
          <BrandField variant="section" className={styles.fieldGgl} intensity={0.9} ground={false} seedOffset={101} />
          <div className={styles.gglCopy} data-motion-copy>
            <p className={styles.lightEyebrow}>OUR BIGGEST PROJECT!</p>
            <h2 className={styles.lightH2}>OVERTIME GGL</h2>
            <RevealWords className={styles.lightParagraph}>
              Our biggest event brings the whole community together for a competitive Overwatch
              5v5 tournament. Teams play every week, with each match organized, cast, and streamed
              live by our staff.
            </RevealWords>
            <RevealWords className={styles.lightParagraph}>
              Eight seasons have already brought players and spectators together this way, and
              Season 9 is on the way — new teams, new matchups, new stories.
            </RevealWords>
            <a href={TWITCH_URL} target="_blank" rel="noopener noreferrer" className={styles.twitchLink}>
              <TwitchIcon /> Watch the stream
            </a>
          </div>
          <div className={`${styles.figureStage} ${styles.gglStage}`}>
            <GridFigure
              src="/ggl-lineup.png"
              alt="Goonginga League heroes artwork"
              width={1920}
              height={1080}
              edges={GGL_EDGES}
              cols={36}
              className={styles.gglBox}
              imgClassName={styles.gglFigure}
            />
            <div className={styles.gglCardSlot}>
              <SeasonArchiveCard />
            </div>
          </div>
        </section>

        <section className={styles.gamesSection} data-chapter="games">
          <BrandField variant="section" className={styles.fieldGames} intensity={0.9} ground={false} seedOffset={202} />
          <div className={styles.gamesInner}>
            <div className={`${styles.figureStage} ${styles.gamesStage}`}>
              <GridFigure
                src="/game-nights.png"
                alt="Overwatch heroes posing for a group selfie"
                width={1672}
                height={941}
                edges={GAME_NIGHT_EDGES}
                cols={36}
                className={styles.gamesBox}
                imgClassName={styles.gamesFigure}
              />
            </div>
            <div className={styles.gamesCopy} data-motion-copy>
              <p className={styles.amberEyebrow}>Events</p>
              <h2 className={styles.gamesH2}>Game-night events, any game</h2>
              <RevealWords className={styles.heroSub}>
                Outside the league we run events designed to start and finish in a single day — a
                different game, format, or challenge each time. They are open to whoever signs up,
                organized through the community, and streamed from the same production room.
              </RevealWords>
              <RevealWords className={styles.heroSub}>
                These nights give us room to experiment, bring new players on stream, and play with
                the community instead of simply broadcasting to it.
              </RevealWords>
            </div>
          </div>
        </section>

        <section className={styles.discordSection} data-chapter="discord">
          <BrandField variant="section" className={styles.fieldDiscord} intensity={0.9} ground={false} seedOffset={303} />
          <div className={styles.discordInner}>
            <div className={styles.discordCopy} data-motion-copy>
              <p className={styles.lightEyebrow}>The Discord</p>
              <h2 className={styles.lightH2}>It all runs in the Discord</h2>
              <RevealWords className={`${styles.lightParagraph} ${styles.discordLead}`}>
                Sign-ups, drafts, event days and the league itself are organised in one server. If you
                want in on Season 9, that is where to go.
              </RevealWords>
              <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className={styles.discordJoin}>
                <DiscordIcon size={18} /> Join the Discord
              </a>
            </div>
          </div>
        </section>
        </Story>
      </main>

      <footer className={styles.footer}>
        <BrandField variant="footer" />
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <div className={styles.footerBrandRow}>
              <span className={styles.brandMark}>OT</span>
              <span className={styles.brandWord}>
                <b>Overtime</b> <span>Productions</span>
              </span>
            </div>
            <p className={styles.footerTagline}>The official home of Goonginga League.</p>
          </div>

          <div className={styles.footerColumn}>
            <p className={styles.footerHeading}>League</p>
            {footerLeagueLinks.map((link) => (
              <Link key={link.href} href={link.href} className={styles.footerLink}>
                {link.label}
              </Link>
            ))}
          </div>

          <div className={styles.footerColumn}>
            <p className={styles.footerHeading}>Follow</p>
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
              <DiscordIcon size={18} /> Discord
            </a>
            <a href={TWITCH_URL} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
              <TwitchIcon /> Twitch
            </a>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <div className={styles.footerDivider} />
          <p className={styles.footerCopyright}>© Overtime Productions.</p>
        </div>
      </footer>
    </div>
  );
}
