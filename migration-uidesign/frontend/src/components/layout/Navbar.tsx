"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import { useSession } from "@/features/session/SessionProvider";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/teams", label: "Teams" },
  { href: "/standings", label: "Standings" },
  { href: "/draft", label: "Draft" },
  { href: "/schedule", label: "Schedule" },
  { href: "/news", label: "News" },
  { href: "/stats", label: "Stats" },
];

export function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated, user, clearSession } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="font-bold text-primary-foreground text-sm">GL</span>
            </div>
            <span className="font-bold text-lg text-foreground hidden sm:block">
              Goonginga League
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
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
            {isAuthenticated && user ? (
              <div className="hidden md:flex items-center gap-3">
                <Link
                  href="/my-team"
                  className={clsx(
                    "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    pathname === "/my-team"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  )}
                >
                  My Team
                </Link>
                <div className="flex items-center gap-2">
                  <Avatar size="sm" fallback={user.nickname} />
                  <span className="text-sm text-foreground">{user.nickname}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={clearSession}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Register</Button>
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
              {navLinks.map((link) => {
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
                  <Link
                    href="/my-team"
                    className={clsx(
                      "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      pathname === "/my-team"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted hover:text-foreground hover:bg-surface"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    My Team
                  </Link>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Avatar size="sm" fallback={user.nickname} />
                    <span className="text-sm text-foreground">{user.nickname}</span>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-2 text-sm font-medium text-left text-danger hover:bg-surface rounded-md"
                    onClick={() => {
                      clearSession();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 pt-2 border-t border-border mt-2">
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button size="sm" className="w-full">
                      Register
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
