"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, CalendarDays, ChevronDown, Crown, Gamepad2, Gauge, LogIn, LogOut, Menu, Newspaper, Shield, Trophy, UserRound, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import {
  clearNetworkSession,
  readNetworkSessionUser,
  readNetworkSessionToken,
  type NetworkSessionUser,
} from "@/features/networkSession/storage";
import { resolveSeasonLabel } from "@/features/tournament/seasonIdentity";
import { useCurrentTournament } from "@/features/tournament/useCurrentTournament";
import { getNetworkMemberCapabilities, type NetworkMemberCapabilities } from "@/lib/api/networkMember";

const leagueLinks = (seasonLabel: string) => [
  { href: "/season", label: seasonLabel, icon: Trophy },
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
  const routeQuery = searchParams.toString();
  const [open, setOpen] = useState(false);
  const [leagueOpen, setLeagueOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [networkUser, setNetworkUser] = useState<NetworkSessionUser | null>(null);
  const [capabilities, setCapabilities] = useState<NetworkMemberCapabilities | null>(null);
  const leagueMenuRef = useRef<HTMLDivElement>(null);
  const leagueTriggerRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const currentTournament = useCurrentTournament();
  const seasonLabel = resolveSeasonLabel(currentTournament);
  const links = leagueLinks(seasonLabel);

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

  useEffect(() => {
    if (!networkUser) {
      setCapabilities(null);
      return;
    }
    const token = readNetworkSessionToken();
    if (!token) return;
    let mounted = true;
    getNetworkMemberCapabilities(token)
      .then((result) => { if (mounted) setCapabilities(result); })
      .catch(() => { if (mounted) setCapabilities(null); });
    return () => { mounted = false; };
  }, [networkUser]);

  useEffect(() => {
    setOpen(false);
    setLeagueOpen(false);
    setProfileOpen(false);
  }, [pathname, routeQuery]);

  useEffect(() => {
    if (!leagueOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!leagueMenuRef.current?.contains(event.target as Node)) setLeagueOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setLeagueOpen(false);
      leagueTriggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [leagueOpen]);

  useEffect(() => {
    if (!profileOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setProfileOpen(false);
      profileTriggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [profileOpen]);

  const logout = () => {
    clearNetworkSession();
    setNetworkUser(null);
    setCapabilities(null);
    setProfileOpen(false);
  };

  const archiveTab = pathname === "/history/season-8" ? searchParams.get("tab") : null;
  const isLeagueLinkActive = (href: string) => {
    if (pathname.startsWith(href)) return true;
    if (href === "/teams") return archiveTab === "teams";
    if (href === "/schedule") return archiveTab === "playoffs";
    if (href === "/standings") return archiveTab === "standings";
    if (href === "/stats") return archiveTab === "players";
    return false;
  };
  const leagueActive = links.some(({ href }) => isLeagueLinkActive(href));
  const hasSeasonTeam = networkUser?.teamId !== null && networkUser?.teamId !== undefined;
  const canOpenCasting = Boolean(
    capabilities?.isCaster ||
    capabilities?.isAdmin ||
    networkUser?.roles.includes("SOCIAL_MEDIA"),
  );
  const profileLinks = networkUser ? [
    { href: "/profile", label: "Profile", icon: UserRound, show: true },
    { href: "/my-team", label: "My Team", icon: Users, show: Boolean(capabilities?.isCaptain || hasSeasonTeam) },
    { href: "/captain-dashboard", label: "Captain Dashboard", icon: Crown, show: Boolean(capabilities?.isCaptain) },
    { href: "/casting-dashboard", label: "Casting Dashboard", icon: Gauge, show: canOpenCasting },
    { href: "/admin-dashboard", label: "Admin Dashboard", icon: Shield, show: Boolean(capabilities?.isAdmin) },
  ].filter((entry) => entry.show) : [];

  return (
    <header className={clsx("site-navbar sticky top-0 z-40 h-[68px] border-b border-border bg-surface-1/95 backdrop-blur-xl", pathname === "/" && "site-navbar-home")}>
      <div className="ow-container flex h-full items-center justify-between gap-5">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Overtime Productions home">
          <img src="/winton.jpg" alt="" className="h-10 w-10 rounded-sm bg-surface-1 object-contain" />
          <div className="hidden leading-none sm:block">
            <span className="block font-display text-display-m uppercase text-text-primary">Overtime Productions</span>
            <span className="mt-0.5 block text-label font-extrabold uppercase text-ggl">GGL · Overwatch league</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 xl:flex" aria-label="Primary navigation">
          <div className="relative" ref={leagueMenuRef}>
            <button
              ref={leagueTriggerRef}
              type="button"
              className={clsx("nav-ggl-trigger", leagueActive && "nav-ggl-trigger-active")}
              aria-expanded={leagueOpen}
              aria-controls="ggl-navigation-menu"
              aria-haspopup="menu"
              onClick={() => setLeagueOpen((value) => !value)}
            >
              <Trophy size={16} aria-hidden="true" />
              GGL
              <ChevronDown size={15} aria-hidden="true" className={clsx("nav-ggl-chevron", leagueOpen && "nav-ggl-chevron-open")} />
            </button>
            <div
              id="ggl-navigation-menu"
              role="menu"
              aria-hidden={!leagueOpen}
              className={clsx("nav-ggl-menu", leagueOpen && "nav-ggl-menu-open")}
            >
              {links.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  tabIndex={leagueOpen ? 0 : -1}
                  onClick={() => setLeagueOpen(false)}
                  className={clsx("nav-ggl-item", isLeagueLinkActive(href) && "nav-ggl-item-active")}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </Link>
              ))}
            </div>
          </div>
          <span className="nav-mode-divider" aria-hidden="true" />
          {secondaryLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="nav-secondary-link flex h-10 items-center gap-2 rounded-sm px-2.5 text-label font-bold transition-colors duration-fast ease-out"
              aria-label={`${label}, Overtime Productions production utility`}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {networkUser ? (
            <div className="relative hidden sm:block" ref={profileMenuRef}>
              <button
                ref={profileTriggerRef}
                type="button"
                className="nav-profile-trigger"
                aria-expanded={profileOpen}
                aria-controls="profile-navigation-menu"
                aria-haspopup="menu"
                onClick={() => setProfileOpen((value) => !value)}
              >
                <Avatar size="sm" src={networkUser.avatarUrl || undefined} fallback={networkUser.username} />
                <span className="max-w-28 truncate">{networkUser.username}</span>
                <ChevronDown size={15} aria-hidden="true" className={clsx("nav-ggl-chevron", profileOpen && "nav-ggl-chevron-open")} />
              </button>
              <div
                id="profile-navigation-menu"
                role="menu"
                aria-hidden={!profileOpen}
                className={clsx("nav-profile-menu", profileOpen && "nav-profile-menu-open")}
              >
                <div className="nav-profile-identity" role="presentation">
                  <Avatar size="sm" src={networkUser.avatarUrl || undefined} fallback={networkUser.username} />
                  <div><strong>{networkUser.username}</strong><span>Overtime Productions member</span></div>
                </div>
                {profileLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} role="menuitem" tabIndex={profileOpen ? 0 : -1} onClick={() => setProfileOpen(false)} className="nav-profile-item">
                    <Icon size={17} aria-hidden="true" /> {label}
                  </Link>
                ))}
                <button type="button" role="menuitem" tabIndex={profileOpen ? 0 : -1} onClick={logout} className="nav-profile-item nav-profile-logout">
                  <LogOut size={17} aria-hidden="true" /> Log out
                </button>
              </div>
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
        <nav className="border-t border-border bg-surface-1 p-3 shadow-lg xl:hidden" aria-label="Mobile navigation">
          <div className="ow-container grid gap-1">
            <Link href="/" onClick={() => setOpen(false)} className="mobile-nav-home">
              Overtime Productions home
            </Link>
            <div className="mobile-nav-group">
              <span>GGL</span>
              {links.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setOpen(false)} className={clsx("flex items-center gap-3 rounded-sm px-3 py-3 text-body-s font-bold hover:bg-surface-3", isLeagueLinkActive(href) && "mobile-nav-active")}>
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </div>
            <div className="mobile-nav-secondary">
              <span>Overtime Productions tools</span>
              {secondaryLinks.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-sm px-3 py-3 text-body-s font-bold hover:bg-surface-3">
                  <Icon size={18} aria-hidden="true" />
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
            {networkUser ? (
              <div className="mobile-nav-account">
                <span>{networkUser.username}</span>
                {profileLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-sm px-3 py-3 text-body-s font-bold hover:bg-surface-3">
                    <Icon size={18} aria-hidden="true" /> {label}
                  </Link>
                ))}
                <button type="button" onClick={logout} className="flex items-center gap-3 rounded-sm px-3 py-3 text-left text-body-s font-bold hover:bg-surface-3">
                  <LogOut size={18} aria-hidden="true" /> Log out
                </button>
              </div>
            ) : null}
          </div>
        </nav>
      )}
    </header>
  );
}
