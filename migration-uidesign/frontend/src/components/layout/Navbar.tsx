"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  clearNetworkSession,
  readNetworkSessionToken,
  readNetworkSessionUser,
  type NetworkSessionUser,
} from "@/features/networkSession/storage";
import {
  getNetworkMemberCapabilities,
  type NetworkMemberCapabilities,
} from "@/lib/api/networkMember";

const projectImage = "/landing/realtime.webp";
const headerSocialLinks = [
  { label: "Discord", icon: "discord", href: "https://discord.gg/QMukTWr32f" },
  {
    label: "Twitch",
    icon: "twitch",
    href: "https://www.twitch.tv/goongingatournament",
  },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [networkUser, setNetworkUser] = useState<NetworkSessionUser | null>(null);
  const [capabilities, setCapabilities] = useState<NetworkMemberCapabilities | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const refreshSession = () => {
      setNetworkUser(readNetworkSessionUser());
      setSessionReady(true);
    };

    refreshSession();
    window.addEventListener("network-session-changed", refreshSession);
    window.addEventListener("storage", refreshSession);

    return () => {
      window.removeEventListener("network-session-changed", refreshSession);
      window.removeEventListener("storage", refreshSession);
    };
  }, []);

  useEffect(() => {
    if (!networkUser) {
      setCapabilities(null);
      return;
    }

    const token = readNetworkSessionToken();
    if (!token) {
      setCapabilities(null);
      return;
    }

    let active = true;
    getNetworkMemberCapabilities(token)
      .then((nextCapabilities) => {
        if (active) setCapabilities(nextCapabilities);
      })
      .catch(() => {
        if (active) setCapabilities(null);
      });

    return () => {
      active = false;
    };
  }, [networkUser]);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!profileOpen) return;

    const closeOutside = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
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

  const isAdmin = capabilities?.isAdmin ?? networkUser?.roles.includes("ADMIN") ?? false;
  const isCaster = capabilities?.isCaster ?? networkUser?.roles.includes("CASTER") ?? false;
  const isCaptain = capabilities?.isCaptain ?? false;
  const displayName = networkUser?.nickname || networkUser?.username || "";
  const profileLinks = [
    { href: "/profile", label: "Profile", show: Boolean(networkUser) },
    { href: "/admin-dashboard", label: "Admin Dashboard", show: isAdmin },
    { href: "/casting-dashboard", label: "Casting Dashboard", show: isCaster },
    { href: "/captain-dashboard", label: "Captain Dashboard", show: isCaptain },
  ].filter((link) => link.show);

  return (
    <header className={`otp-header ${isLanding ? "otp-header-landing" : ""}`}>
      <div className="otp-header-inner">
        <Link href="/" className="otp-brand" aria-label="Overtime Productions home">
          <span className="otp-brand-image">
            <Image src={projectImage} alt="" fill sizes="40px" priority />
          </span>
          <span>Overtime Productions</span>
        </Link>

        <nav className="otp-primary-nav" aria-label="Primary navigation">
          <Link href="/#ggl">GGL</Link>
          <Link href="/#about">About</Link>
          <Link href="/news">News</Link>
        </nav>

        <div className="otp-account">
          <nav className="otp-header-socials" aria-label="Community channels">
            {headerSocialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
              >
                <span
                  className={`otp-social-icon otp-social-icon--${social.icon}`}
                  aria-hidden="true"
                />
              </a>
            ))}
          </nav>

          {!sessionReady ? (
            <span className="otp-account-placeholder" aria-hidden="true" />
          ) : networkUser ? (
            <div className="otp-profile" ref={profileMenuRef}>
              <button
                ref={profileTriggerRef}
                type="button"
                className="otp-profile-trigger"
                aria-expanded={profileOpen}
                aria-controls="otp-profile-menu"
                aria-haspopup="menu"
                onClick={() => setProfileOpen((open) => !open)}
              >
                <span>{displayName}</span>
                <img
                  src={networkUser.avatarUrl || projectImage}
                  alt={`${displayName}'s profile`}
                  onError={(event) => {
                    event.currentTarget.src = projectImage;
                  }}
                />
              </button>

              <div
                id="otp-profile-menu"
                role="menu"
                aria-hidden={!profileOpen}
                className={`otp-profile-menu ${profileOpen ? "otp-profile-menu-open" : ""}`}
              >
                <div className="otp-profile-menu-name">
                  <span>Signed in as</span>
                  <strong>{displayName}</strong>
                </div>
                {profileLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    role="menuitem"
                    tabIndex={profileOpen ? 0 : -1}
                    onClick={() => setProfileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={profileOpen ? 0 : -1}
                  onClick={logout}
                >
                  Log out
                </button>
              </div>
            </div>
          ) : (
            <Link href="/login" className="otp-login" aria-label="Log in with Discord">
              <span>Login</span>
            </Link>
          )}

          <button
            type="button"
            className="otp-mobile-toggle"
            aria-expanded={mobileOpen}
            aria-controls="otp-mobile-nav"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      <nav
        id="otp-mobile-nav"
        className={`otp-mobile-nav ${mobileOpen ? "otp-mobile-nav-open" : ""}`}
        aria-hidden={!mobileOpen}
        aria-label="Mobile navigation"
      >
        <Link href="/#ggl" tabIndex={mobileOpen ? 0 : -1} onClick={() => setMobileOpen(false)}>GGL</Link>
        <Link href="/#about" tabIndex={mobileOpen ? 0 : -1} onClick={() => setMobileOpen(false)}>About</Link>
        <Link href="/news" tabIndex={mobileOpen ? 0 : -1} onClick={() => setMobileOpen(false)}>News</Link>
      </nav>
    </header>
  );
}
