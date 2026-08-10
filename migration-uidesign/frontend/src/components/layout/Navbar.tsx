"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, History, Home, LogIn, Menu, Newspaper, Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import {
  clearNetworkSession,
  readNetworkSessionUser,
  type NetworkSessionUser,
} from "@/features/networkSession/storage";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/season-9", label: "Season 9", icon: Trophy },
  { href: "/history", label: "History", icon: History },
  { href: "/news", label: "News", icon: Newspaper },
];

export function Navbar() {
  const pathname = usePathname();
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

  const hasSocialDashboard = networkUser?.roles.some((role) => role === "SOCIAL_MEDIA" || role === "ADMIN");

  return (
    <header className="sticky top-0 z-40 h-[68px] border-b border-border bg-surface/95 backdrop-blur-xl">
      <div className="ow-container flex h-full items-center justify-between gap-5">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Goonginga home">
          <img src="/winton.jpg" alt="" className="h-10 w-10 rounded-sm bg-white object-contain" />
          <div className="hidden leading-none sm:block">
            <span className="block font-display text-[1.5rem] uppercase text-foreground">Overtime Productions</span>
            <span className="mt-0.5 block text-[0.62rem] font-extrabold uppercase text-accent">Goonginga Season</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex h-10 items-center gap-2 rounded-sm px-3 text-sm font-bold transition-colors",
                  active ? "bg-bg-primary text-white shadow-[inset_0_-2px_var(--color-accent)]" : "text-muted hover:bg-surface-elevated hover:text-foreground"
                )}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {networkUser ? (
            <div className="hidden items-center gap-2 sm:flex">
              {hasSocialDashboard ? (
                <Link href="/social-media-dashboard" className="ow-icon-button" title="Production control" aria-label="Open production control">
                  <Gauge size={17} />
                </Link>
              ) : null}
              <Avatar size="sm" src={networkUser.avatarUrl || undefined} fallback={networkUser.username} />
              <span className="max-w-28 truncate text-sm font-bold">{networkUser.username}</span>
              <button type="button" onClick={logout} className="ow-icon-button" title="Log out" aria-label="Log out">
                <X size={17} />
              </button>
            </div>
          ) : (
            <Link href="/login" className="nav-auth-button hidden sm:inline-flex">
              <LogIn size={17} />
              Register / Login
            </Link>
          )}
          <button type="button" className="ow-icon-button nav-mobile-toggle" onClick={() => setOpen((value) => !value)} aria-label="Toggle menu" aria-expanded={open}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-border bg-surface p-3 shadow-lg md:hidden" aria-label="Mobile navigation">
          <div className="ow-container grid gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-sm px-3 py-3 text-sm font-bold hover:bg-surface-elevated">
                <Icon size={18} />
                {label}
              </Link>
            ))}
            {!networkUser && (
              <Link href="/login" onClick={() => setOpen(false)} className="nav-auth-button mt-2">
                <LogIn size={17} />
                Register / Login
              </Link>
            )}
            {networkUser && hasSocialDashboard ? (
              <Link href="/social-media-dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-sm px-3 py-3 text-sm font-bold hover:bg-surface-elevated">
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
