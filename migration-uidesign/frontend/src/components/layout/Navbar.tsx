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
      {/* Subtle gradient accent line at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-white overflow-hidden flex items-center justify-center">
              <img src="/winton.jpg" alt="Goonginga League Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-xl text-foreground hidden sm:block">
              Goonginga League
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
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
                
                {/* Profile dropdown */}
                <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-surface">
                  <Avatar size="sm" fallback={user.nickname} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{user.nickname}</span>
                    <span className="text-xs text-muted capitalize">{user.role.toLowerCase()}</span>
                  </div>
                </div>
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
                  <div className="flex items-center gap-2 px-3 py-2 mt-2 border-t border-border">
                    <Avatar size="sm" fallback={user.nickname} />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{user.nickname}</span>
                      <span className="text-xs text-muted capitalize">{user.role.toLowerCase()}</span>
                    </div>
                  </div>
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
