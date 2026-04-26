"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import { useSession } from "@/features/session/SessionProvider";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

const publicNavLinks = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/news", label: "News" },
  { href: "/standings", label: "Leaderboard" },
  { href: "/stats", label: "Top Players" },
  { href: "/teams", label: "Teams" },
];

export function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated, user, clearSession, isHydrated } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Get role-based dashboard link
  const getDashboardLink = () => {
    if (!user) return null;
    switch (user.role) {
      case "ADMIN":
        return { href: "/admin-dashboard", label: "Admin Dashboard" };
      case "MANAGER":
        return { href: "/manager-dashboard", label: "Manager Dashboard" };
      case "CAPTAIN":
        return { href: "/captain-dashboard", label: "Captain Dashboard" };
      case "EDITOR":
        return { href: "/editor-dashboard", label: "Editor Dashboard" };
      default:
        return null;
    }
  };

  const dashboardLink = getDashboardLink();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative">
      {/* Decorative top accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
      {/* Subtle corner accents */}
      <div className="absolute top-0 left-0 w-32 h-16 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-16 bg-gradient-to-bl from-accent/10 to-transparent pointer-events-none" />
      
      <div className="container mx-auto px-4 relative">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-accent/50 rounded-full blur opacity-0 group-hover:opacity-75 transition-opacity" />
              <div className="relative w-12 h-12 rounded-full bg-white overflow-hidden flex items-center justify-center ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all">
                <img src="/winton.jpg" alt="Goonginga League Logo" className="w-full h-full object-contain" />
              </div>
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-xl text-foreground leading-tight">
                Goonginga League
              </span>
              <span className="text-xs text-primary/80 font-medium tracking-wide">COMPETITIVE OVERWATCH</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full bg-surface/50 border border-border/50">
            {publicNavLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "relative px-4 py-1.5 text-sm font-medium rounded-full transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                      : "text-muted hover:text-foreground hover:bg-surface-elevated"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Auth Section */}
          <div className="flex items-center gap-3">
            {!isHydrated ? (
              <div className="w-20 h-8 bg-surface animate-pulse rounded-md" />
            ) : isAuthenticated && user ? (
              <div className="hidden md:flex items-center gap-3">
                {/* Role-based dashboard button */}
                {dashboardLink && (
                  <Link
                    href={dashboardLink.href}
                    className={clsx(
                      "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      pathname.startsWith(dashboardLink.href)
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent/20 text-accent hover:bg-accent/30"
                    )}
                  >
                    {dashboardLink.label}
                  </Link>
                )}
                
                {/* Profile shortcut with profile picture of the user */}
                <Link
                  href="/profile"
                  className={clsx(
                    "flex items-center gap-2 px-2 py-1 rounded-md transition-colors",
                    pathname.startsWith("/profile")
                      ? "bg-primary/15"
                      : "bg-surface hover:bg-surface-elevated"
                  )}
                >
                  <Avatar size="sm" src={user.profilePic || undefined} fallback={user.nickname} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{user.nickname}</span>
                    <span className="text-xs text-muted capitalize">{user.role.toLowerCase()}</span>
                  </div>
                </Link>
                <Button variant="ghost" size="sm" onClick={clearSession}>
                  Logout
                </Button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/login">
                  <Button size="sm">Login</Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="md:hidden p-2 rounded-md text-muted hover:text-foreground hover:bg-surface"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-1">
              {publicNavLinks.map((link) => {
                const isActive =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={clsx(
                      "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-surface-elevated text-foreground"
                        : "text-muted hover:text-foreground hover:bg-surface"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                );
              })}

              {isAuthenticated && user ? (
                <>
                  {dashboardLink && (
                    <Link
                      href={dashboardLink.href}
                      className={clsx(
                        "px-3 py-2 text-sm font-medium rounded-md transition-colors mt-2",
                        pathname.startsWith(dashboardLink.href)
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent/20 text-accent hover:bg-accent/30"
                      )}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {dashboardLink.label}
                    </Link>
                  )}
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-3 py-2 mt-2 border-t border-border rounded-md hover:bg-surface"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Avatar size="sm" src={user.profilePic || undefined} fallback={user.nickname} />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{user.nickname}</span>
                      <span className="text-xs text-muted capitalize">{user.role.toLowerCase()}</span>
                    </div>
                  </Link>
                  <button
                    type="button"
                    className="px-3 py-2 text-sm font-medium text-left text-danger hover:bg-surface rounded-md"
                    onClick={() => {
                      clearSession();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 pt-2 border-t border-border mt-2">
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button size="sm" className="w-full">
                      Login
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
