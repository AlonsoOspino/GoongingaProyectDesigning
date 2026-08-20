import Link from "next/link";
import { MessageCircle, Play } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface-inset text-text-primary">
      <div className="ow-container flex flex-col gap-8 py-10 md:flex-row md:items-center md:justify-between">
        <div className="max-w-md">
          <p className="font-display text-display-l uppercase">Overtime Productions</p>
          <p className="mt-2 text-body-s leading-6 text-text-secondary">Community Overwatch competition with drafted rosters, live broadcasts, standings, and season archives.</p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-body-s font-bold" aria-label="Footer navigation">
          <Link href="/season-9" className="hover:text-brand-bright">Season 9</Link>
          <Link href="/history" className="hover:text-brand-bright">History</Link>
          <Link href="/news" className="hover:text-brand-bright">News</Link>
        </nav>
        <div className="flex gap-2">
          <a className="ow-icon-button" href="https://discord.gg/QMukTWr32f" aria-label="Discord" title="Discord"><MessageCircle size={19} /></a>
          <a className="ow-icon-button" href="https://www.instagram.com/goongingatournament/" aria-label="Instagram" title="Instagram"><img src="/icons/social/instagram.svg" alt="" /></a>
          <a className="ow-icon-button" href="https://www.twitch.tv/goongingatournament" aria-label="Twitch" title="Twitch"><img src="/icons/social/twitch.svg" alt="" /></a>
          <a className="ow-icon-button" href="https://www.tiktok.com/@goongingatournament" aria-label="TikTok" title="TikTok"><img src="/icons/social/tiktok.svg" alt="" /></a>
          <a className="ow-icon-button" href="https://www.youtube.com/@goongingatournament" aria-label="YouTube" title="YouTube"><Play size={19} /></a>
        </div>
      </div>
    </footer>
  );
}
