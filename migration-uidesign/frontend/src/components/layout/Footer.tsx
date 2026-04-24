import Link from "next/link";

const footerLinks = [
  {
    title: "League",
    links: [
      { href: "/teams", label: "Teams" },
      { href: "/standings", label: "Standings" },
      { href: "/schedule", label: "Schedule" },
      { href: "/draft", label: "Draft" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/news", label: "News" },
      { href: "/stats", label: "Stats" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface mt-auto relative overflow-hidden">
      {/* Decorative grid pattern */}
      <div className="absolute inset-0 bg-grid-pattern-subtle opacity-30 pointer-events-none" />
      
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      
      {/* Corner accent decorations */}
      <div className="absolute top-0 left-0 w-48 h-48 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-gradient-to-tl from-accent/10 to-transparent pointer-events-none" />
      
      {/* Floating orbs */}
      <div className="absolute top-10 right-1/4 w-2 h-2 bg-primary/40 rounded-full animate-pulse" />
      <div className="absolute bottom-16 left-1/3 w-1.5 h-1.5 bg-accent/40 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 right-1/3 w-1 h-1 bg-primary/30 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      
      <div className="container mx-auto px-4 py-12 relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-accent/30 rounded-full blur" />
                <div className="relative w-12 h-12 rounded-full bg-white overflow-hidden flex items-center justify-center ring-2 ring-primary/20">
                  <img src="/winton.jpg" alt="Goonginga League Logo" className="w-full h-full object-contain" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-foreground">Goonginga League</span>
                <span className="text-xs text-primary/70 font-medium">EST. 2022</span>
              </div>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              The premier competitive gaming league for Overwatch enthusiasts. Join our community of passionate players.
            </p>
            
            {/* Twitch Link */}
            <a 
              href="https://www.twitch.tv/goongingatournament" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-md bg-[#9146FF]/10 border border-[#9146FF]/20 text-[#9146FF] hover:bg-[#9146FF]/20 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
              </svg>
              Watch Live
            </a>
          </div>

          {/* Links */}
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-gradient-to-b from-primary to-accent rounded-full" />
                {group.title}
              </h3>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground hover:translate-x-1 transition-all group"
                    >
                      <span className="w-0 group-hover:w-2 h-px bg-primary transition-all" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Social/Contact */}
          <div>
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-gradient-to-b from-primary to-accent rounded-full" />
              Connect
            </h3>
            <p className="text-sm text-muted mb-4">Join our gaming community</p>
            <div className="flex gap-2">
              <a
                href="https://discord.gg/FysfwrjK8b"
                className="p-2.5 rounded-lg bg-surface-elevated border border-border hover:border-[#5865F2]/50 hover:bg-[#5865F2]/10 text-muted hover:text-[#5865F2] transition-all"
                aria-label="Discord"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </a>
              <a
                href="https://www.youtube.com/@goongingatournament"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-lg bg-surface-elevated border border-border hover:border-[#FF0000]/50 hover:bg-[#FF0000]/10 text-muted hover:text-[#FF0000] transition-all"
                aria-label="YouTube"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M23.498 6.186a2.994 2.994 0 0 0-2.107-2.117C19.379 3.5 12 3.5 12 3.5s-7.379 0-9.391.569A2.994 2.994 0 0 0 .502 6.186C0 8.207 0 12 0 12s0 3.793.502 5.814a2.994 2.994 0 0 0 2.107 2.117C4.621 20.5 12 20.5 12 20.5s7.379 0 9.391-.569a2.994 2.994 0 0 0 2.107-2.117C24 15.793 24 12 24 12s0-3.793-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              <a
                href="https://www.twitch.tv/goongingatournament"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-lg bg-surface-elevated border border-border hover:border-[#9146FF]/50 hover:bg-[#9146FF]/10 text-muted hover:text-[#9146FF] transition-all"
                aria-label="Twitch"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border">
          {/* Decorative divider */}
          <div className="flex items-center justify-center gap-3 -mt-9 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
            <div className="w-2 h-2 rotate-45 border border-primary/50 bg-surface" />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-muted">
              <span>{new Date().getFullYear()} Goonginga League</span>
              <span className="w-1 h-1 rounded-full bg-muted/50" />
              <span>All rights reserved</span>
            </div>
            <Link
              href="/dev"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-surface-elevated to-surface border border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all group"
            >
              <svg 
                className="w-4 h-4 text-primary transition-transform group-hover:scale-110" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="text-muted group-hover:text-foreground transition-colors">Developer</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
