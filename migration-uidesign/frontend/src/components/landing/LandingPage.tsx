"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SeasonArchiveCard from "./SeasonArchiveCard";
import TournamentMode, { type TournamentAnnouncementData } from "./TournamentMode";
import GridFigure from "./GridFigure";
import WhoWeAre from "./WhoWeAre";
import BrandField from "./atmosphere/BrandField";
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

function MemberAvatar({ member }: { member: NetworkMember }) {
  const [failed, setFailed] = useState(false);

  if (!member.avatarUrl || failed) {
    return (
      <span
        className={styles.memberAvatar}
        data-fallback="true"
        role="img"
        aria-label={`${member.username}'s profile image is unavailable`}
      >
        {Array.from(member.username.trim())[0]?.toUpperCase() || "?"}
      </span>
    );
  }

  return (
    <img
      className={styles.memberAvatar}
      src={member.avatarUrl}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function CommunityMembers({ members }: { members: NetworkMember[] }) {
  const visible = members.slice(0, 5);

  return (
    <aside className={styles.joinedRail} aria-label="Newest community members">
      <p className={styles.joinedLabel}>
        <span className={styles.liveDot} aria-hidden="true" />
        Newest members
      </p>
      <ul className={styles.memberList}>
        {visible.map((member) => (
          <li key={member.id} className={styles.memberRow}>
            <MemberAvatar key={member.avatarUrl || member.id} member={member} />
            <span className={styles.memberName} title={member.username}>{member.username}</span>
          </li>
        ))}
      </ul>
    </aside>
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

export function LandingPage({ tournamentPreview }: { tournamentPreview?: TournamentAnnouncementData }) {
  const preview = process.env.NODE_ENV === "development" ? tournamentPreview : undefined;
  const [announcements, setAnnouncements] = useState<ActiveAnnouncements | null>(null);
  const [recentMembers, setRecentMembers] = useState<NetworkMember[] | null>(null);



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

  return (
    <div className={styles.landing} data-landing-root>

      <main id="top">
        <div className={styles.brandZone}>
          <BrandField variant="zone" className={styles.heroField} intensity={0.85} ground={false} motion="calm" />

        <section className={styles.hero} data-hero>
          <div className={styles.heroArt} aria-hidden="true">
            <GridFigure
              src="/REINHARD.jpg"
              alt=""
              width={1920}
              height={823}
              motion={false}
              eager
            />
          </div>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>TOGETHER SINCE 2022</p>
              <h1 className={styles.h1}>
                <span className={styles.heroLine}>overtime</span>
                <span className={styles.heroLine}>productions</span>
              </h1>
              <p className={styles.heroSub}>
                Overwatch tournaments, live casts and game nights.
                Home of GGL Tournament.
              </p>
              <div className={styles.heroCtas}>
                <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className={styles.btnPrimary}>
                  Join the Discord <ArrowIcon />
                </a>
                <a href={TWITCH_URL} target="_blank" rel="noopener noreferrer" className={styles.heroWatch}>
                  <TwitchIcon /> Watch on Twitch
                </a>
              </div>
              <div className={styles.scrollCue} aria-hidden="true">
                <span>Explore Overtime</span>
                <i />
              </div>
            </div>
          </div>
        </section>

        <section className={styles.announceSection} id="announcements" aria-label="Announcements">
          <div className={styles.announceInner}>
            <div className={styles.announceStream}>
            {preview ? <TournamentMode previewData={preview} /> : announcements?.enabled === false ? null : announcements?.mode === "CUSTOM" && builderCards.length > 0 ? (
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

            {recentMembers && recentMembers.length > 0 ? <CommunityMembers members={recentMembers} /> : null}
          </div>
        </section>
        </div>

        <WhoWeAre />

        <section className={styles.gglSection} id="about" data-chapter="ggl">
          <BrandField variant="section" className={styles.fieldGgl} intensity={1} ground={false} motion="calm" seedOffset={101} />
          <div className={styles.gglInner}>
            <div className={styles.gglCopy} data-motion-copy>
              <p className={styles.lightEyebrow}>OUR BIGGEST PROJECT</p>
              <h2 className={styles.lightH2}>OVERTIME GGL</h2>
              <p className={styles.lightParagraph}>
                Our biggest event brings the whole community together for a competitive Overwatch
                5v5 tournament. Teams play every week, with each match organized, cast, and streamed
                live by our staff.
              </p>
              <a href={TWITCH_URL} target="_blank" rel="noopener noreferrer" className={styles.twitchLink}>
                <TwitchIcon /> Watch the stream
              </a>
              <div className={styles.gglCardSlot}>
                <SeasonArchiveCard />
              </div>
            </div>
            <div className={`${styles.figureStage} ${styles.gglStage}`}>
              <GridFigure
                src="/ggl-lineup.png"
                alt="GGL Tournament heroes artwork"
                width={1920}
                height={1080}
                motion={false}
                className={styles.gglBox}
                imgClassName={styles.gglFigure}
              />
            </div>
          </div>
        </section>

        <section className={styles.gamesSection} data-chapter="games">
          <BrandField variant="section" className={styles.fieldGames} intensity={1} ground={false} motion="calm" seedOffset={202} />
          <div className={styles.gamesInner}>
            <div className={`${styles.figureStage} ${styles.gamesStage}`}>
              <GridFigure
                src="/game-nights.png"
                alt="Overwatch heroes posing for a group selfie"
                width={1672}
                height={941}
                motion={false}
                className={styles.gamesBox}
                imgClassName={styles.gamesFigure}
              />
            </div>
            <div className={styles.gamesCopy} data-motion-copy>
              <h2 className={styles.gamesH2}>Game nights</h2>
              <p className={styles.heroSub}>
                Deadlock, League of Legends, trivia and open lobbies.
                Check Discord for the next one.
              </p>
              <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className={styles.sectionLink}>
                Find the next event <ArrowIcon />
              </a>
            </div>
          </div>
        </section>

        <section className={styles.discordSection} data-chapter="discord">
          <BrandField variant="section" className={styles.fieldDiscord} intensity={1} ground={false} motion="calm" seedOffset={303} />
          <div className={styles.discordInner}>
            <div className={styles.discordCopy} data-motion-copy>
              <h2 className={styles.lightH2}>IT ALL RUNS IN THE DISCORD</h2>
              <div className={styles.discordDetails}>
                <p className={`${styles.lightParagraph} ${styles.discordLead}`}>
                  Get tournament announcements, meet the community, join events and find out when we go live.
                </p>
                <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className={styles.discordJoin}>
                  <DiscordIcon size={18} /> Join the Discord
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <BrandField variant="footer" intensity={0.45} ground={false} motion="calm" />
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <div className={styles.footerBrandRow}>
              <span className={styles.brandMark}>OT</span>
              <span className={styles.brandWord}>
                <b>Overtime</b> <span>Productions</span>
              </span>
            </div>
            <p className={styles.footerTagline}>The official home of GGL Tournament.</p>
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
