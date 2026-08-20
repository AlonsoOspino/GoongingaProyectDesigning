"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, CalendarDays, Gamepad2, Gauge, LogIn, Menu, Newspaper, Shield, Trophy, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import {
  clearNetworkSession,
  readNetworkSessionUser,
  type NetworkSessionUser,
} from "@/features/networkSession/storage";

const links = [
  { href: "/season-9", label: "Season 9", icon: Trophy },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/schedule", label: "Schedule / Results", icon: CalendarDays },
  { href: "/standings", label: "Standings", icon: Shield },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/news", label: "News", icon: Newspaper },
];

const secondaryLinks = [
  { href: "/minigames", label: "Stream Tools", icon: Gamepad2 },
];

export function Navbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [networkUser, setNetworkUser] = useState<NetworkSessionUser | null>(null);

  useEffect(() => {
    const refresh = () => setNetworkUser(readNetworkSessionUser());
    refresh();
    window.addEventListener("network-session-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("network-session-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const logout = () => {
    clearNetworkSession();
    setNetworkUser(null);
  };

  const hasProductionDashboard = networkUser?.roles.some((role) => role === "CASTER" || role === "SOCIAL_MEDIA" || role === "ADMIN");
  const archiveTab = pathname === "/history/season-8" ? searchParams.get("tab") : null;
  const isLeagueLinkActive = (href: string) => {
    if (pathname.startsWith(href)) return true;
    if (href === "/teams") return archiveTab === "teams";
    if (href === "/schedule") return archiveTab === "playoffs";
    if (href === "/standings") return archiveTab === "standings";
    if (href === "/stats") return archiveTab === "players";
    return false;
  };

  return (
    <header className={clsx("site-navbar sticky top-0 z-40 h-[68px] border-b border-border bg-surface-1/95 backdrop-blur-xl", pathname === "/" && "site-navbar-home")}>
      <div className="ow-container flex h-full items-center justify-between gap-5">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="GGL home">
          <img src="/winton.jpg" alt="" className="h-10 w-10 rounded-sm bg-surface-1 object-contain" />
          <div className="hidden leading-none sm:block">
            <span className="block font-display text-display-m uppercase text-text-primary">Overtime Productions</span>
            <span className="mt-0.5 block text-label font-extrabold uppercase text-ggl">GGL</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 xl:flex" aria-label="League navigation">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isLeagueLinkActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "nav-league-link flex h-10 items-center gap-2 rounded-sm px-2.5 text-label font-bold transition-colors duration-fast ease-out",
                  active ? "bg-surface-1 text-text-primary shadow-[inset_0_-2px_var(--color-brand-bright)]" : "text-text-muted hover:bg-surface-3 hover:text-text-primary"
                )}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
          <span className="nav-mode-divider" aria-hidden="true" />
          {secondaryLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="nav-secondary-link flex h-10 items-center gap-2 rounded-sm px-2.5 text-label font-bold transition-colors duration-fast ease-out"
              aria-label={`${label}, secondary OTP production utility`}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {networkUser ? (
            <div className="hidden items-center gap-2 sm:flex">
              {hasProductionDashboard ? (
                <Link href="/social-media-dashboard" className="ow-icon-button" title="Production control" aria-label="Open production control">
                  <Gauge size={17} />
                </Link>
              ) : null}
              <Avatar size="sm" src={networkUser.avatarUrl || undefined} fallback={networkUser.username} />
              <span className="max-w-28 truncate text-body-s font-bold">{networkUser.username}</span>
              <button type="button" onClick={logout} className="ow-icon-button" title="Log out" aria-label="Log out">
                <X size={17} />
              </button>
            </div>
          ) : (
            <Link href="/login" className="nav-auth-button hidden sm:inline-flex">
              <LogIn size={17} />
              Register / Log in
            </Link>
          )}
          <button type="button" className="ow-icon-button nav-mobile-toggle" onClick={() => setOpen((value) => !value)} aria-label="Toggle menu" aria-expanded={open}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-border bg-surface-1 p-3 shadow-lg xl:hidden" aria-label="Mobile league navigation">
          <div className="ow-container grid gap-1">
            <Link href="/" onClick={() => setOpen(false)} className="mobile-nav-home">
              GGL home
            </Link>
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className={clsx("flex items-center gap-3 rounded-sm px-3 py-3 text-body-s font-bold hover:bg-surface-3", isLeagueLinkActive(href) && "mobile-nav-active")}>
                <Icon size={18} />
                {label}
              </Link>
            ))}
            <div className="mobile-nav-secondary">
              <span>OTP production tools</span>
              {secondaryLinks.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-sm px-3 py-3 text-body-s font-bold hover:bg-surface-3">
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
            </div>
            {!networkUser && (
              <Link href="/login" onClick={() => setOpen(false)} className="nav-auth-button mt-2">
                <LogIn size={17} />
                Register / Log in
              </Link>
            )}
            {networkUser && hasProductionDashboard ? (
              <Link href="/social-media-dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-sm px-3 py-3 text-body-s font-bold hover:bg-surface-3">
                <Gauge size={18} />
                Production control
              </Link>
            ) : null}
          </div>
        </nav>
      )}
    </header>
  );
}
