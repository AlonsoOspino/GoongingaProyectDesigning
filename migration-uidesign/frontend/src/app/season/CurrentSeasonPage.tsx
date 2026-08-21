"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, Check, MessageCircle, Users } from "lucide-react";
import { TournamentTimer } from "@/components/layout/TournamentTimer";
import { resolveSeasonLabel, resolveSeasonStatusLabel } from "@/features/tournament/seasonIdentity";
import { useCurrentTournament } from "@/features/tournament/useCurrentTournament";

export function CurrentSeasonPage() {
  const tournament = useCurrentTournament();
  const seasonLabel = resolveSeasonLabel(tournament);
  const hasSeason = Boolean(tournament);
  const statusLabel = resolveSeasonStatusLabel(tournament?.state);

  return (
    <div>
      <TournamentTimer />
      <section className="season-nine-hero">
        <div className="ow-container season-nine-grid">
          <div>
            <h1 className="font-display text-7xl uppercase md:text-8xl">{seasonLabel}</h1>
            <p className="mt-3 text-body-s text-text-secondary">GGL · {statusLabel}</p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary">
              {hasSeason
                ? "Registration dates, captain selection, team draft information, and the match calendar will be published here as they are confirmed."
                : "The next GGL season is being prepared. Its name, registration dates, and competitive schedule will appear here once they are confirmed."}
            </p>
            <Link href="/login" className="ow-button mt-7">Join GGL <ArrowRight size={18} /></Link>
          </div>
          <div className="season-nine-number" aria-hidden="true">GGL</div>
        </div>
      </section>
      <section className="ow-section"><div className="ow-container grid gap-4 md:grid-cols-3">{[
        { icon: MessageCircle, title: "Discord registration", copy: "One Network Member profile for registration and community roles." },
        { icon: Users, title: "Teams coming soon", copy: "Rosters will appear after registration and team formation are complete." },
        { icon: CalendarClock, title: "Dates being finalized", copy: "The schedule and match windows will be posted before the season begins." },
      ].map(({ icon: Icon, title, copy }) => <article className="ow-panel p-6" key={title}><Icon className="text-brand-bright" size={24} /><h2 className="mt-5 text-lg font-extrabold">{title}</h2><p className="mt-2 text-sm leading-6 text-text-secondary">{copy}</p></article>)}</div></section>
      <section className="border-y border-border bg-surface-1 py-12"><div className="ow-container"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-center"><div><h2 className="font-display text-5xl uppercase">2 bans per map</h2><p className="mt-2 text-body-s text-text-secondary">Confirmed rule · Two bans maximum per role between both teams.</p></div><div className="flex items-center gap-3 text-sm font-bold text-success"><Check size={20} /> Included in the {seasonLabel} format</div></div></div></section>
    </div>
  );
}
