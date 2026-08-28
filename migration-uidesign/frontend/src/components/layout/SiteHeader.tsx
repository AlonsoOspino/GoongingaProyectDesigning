"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "@/components/landing/landing.module.css";
import { CaretIcon, DISCORD_INVITE, DiscordIcon } from "@/components/landing/brandAssets";
import BrandField from "@/components/landing/atmosphere/BrandField";
import SeasonMenu from "@/components/landing/SeasonMenu";
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

/* EL HEADER DEL SITIO.
 *
 * Hasta ahora había dos: éste, que vivía dentro de LandingPage, y un Navbar
 * distinto en las rutas internas — otra maquetación, otro sistema de estilos y
 * hasta otros enlaces. Ahora existe uno solo y es éste.
 *
 * Usa el módulo CSS de la landing a propósito, en vez de copiar sus 300 líneas
 * de estilo a otro archivo. Los tokens llegan por `.otpSurface`, que es la clase
 * que la landing compone: así el header los tiene fuera de `.landing` sin
 * heredar su fondo ni su altura, y sin duplicar un solo valor.
 */

const MOBILE_LINKS = [
  { href: "/#about", label: "About" },
  { href: "/news", label: "News" },
  { href: "/history", label: "GGL History" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [sessionReady, setSessionReady] = useState(false);
  const [networkUser, setNetworkUser] = useState<NetworkSessionUser | null>(null);
  const [capabilities, setCapabilities] = useState<NetworkMemberCapabilities | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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
      .then((next) => {
        if (active) setCapabilities(next);
      })
      .catch(() => {
        if (active) setCapabilities(null);
      });

    return () => {
      active = false;
    };
  }, [networkUser]);

  // Ahora que el header sobrevive a la navegación, los menús tienen que cerrarse
  // solos al cambiar de ruta. Dentro de la landing esto no hacía falta.
  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

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

  /*
    Las capacidades se acumulan: un miembro puede ser caster, capitán, manager y
    admin a la vez, así que se listan todos los paneles que tenga.
  */
  const isAdmin = capabilities?.isAdmin ?? networkUser?.roles.includes("ADMIN") ?? false;
  const isCaster = capabilities?.isCaster ?? networkUser?.roles.includes("CASTER") ?? false;
  const isCaptain = capabilities?.isCaptain ?? false;
  const isManager = networkUser?.role === "MANAGER";
  const displayName = networkUser?.nickname || networkUser?.username || "";
  const avatarUrl = networkUser?.avatarUrl || networkUser?.profilePic || "";

  const dashboards = [
    { href: "/casting-dashboard", label: "Casting Dashboard", chip: "Caster", show: isCaster },
    { href: "/captain-dashboard", label: "Captain Dashboard", chip: "Captain", show: isCaptain },
    { href: "/manager-dashboard", label: "Manager Dashboard", chip: "Manager", show: isManager },
    { href: "/admin-dashboard", label: "Admin Dashboard", chip: "Admin", show: isAdmin },
  ].filter((entry) => entry.show);

  return (
    <header className={`${styles.otpSurface} ${styles.header}`}>
      <BrandField variant="bar" />

      <div className={styles.headerInner}>
        <Link href="/" className={styles.brand} aria-label="Overtime Productions">
          <span className={styles.brandMark}>OT</span>
          <span className={styles.brandWord}>
            <b>Overtime</b> <span>Productions</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Primary navigation">
          <Link href="/#about" className={styles.navLink}>
            About
          </Link>
          <Link
            href="/news"
            className={styles.navLink}
            aria-current={pathname?.startsWith("/news") ? "page" : undefined}
          >
            News
          </Link>
          <Link
            href="/history"
            className={styles.navLink}
            aria-current={pathname?.startsWith("/history") ? "page" : undefined}
          >
            GGL History
          </Link>
        </nav>

        <div className={styles.actions}>
          <SeasonMenu triggerClassName={styles.btnSecondary} />
        </div>

        <div className={styles.accountZone}>
          {!sessionReady ? (
            <span className={styles.accountPlaceholder} aria-hidden="true" />
          ) : networkUser ? (
            <div className={styles.profileWrap} ref={profileMenuRef}>
              <button
                ref={profileTriggerRef}
                type="button"
                className={`${styles.avatarButton} ${profileOpen ? styles.avatarButtonOpen : ""}`}
                aria-expanded={profileOpen}
                aria-controls="otp-profile-menu"
                aria-haspopup="menu"
                onClick={() => setProfileOpen((open) => !open)}
              >
                {avatarUrl ? (
                  <img
                    className={styles.avatarImg}
                    src={avatarUrl}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span className={styles.avatarFallback} aria-hidden="true">
                    {displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span>{displayName}</span>
                <span className={`${styles.caret} ${profileOpen ? styles.caretOpen : ""}`} aria-hidden="true">
                  <CaretIcon />
                </span>
              </button>

              <div
                id="otp-profile-menu"
                role="menu"
                aria-hidden={!profileOpen}
                className={`${styles.profileMenu} ${profileOpen ? styles.profileMenuOpen : ""}`}
              >
                <div className={styles.menuHeader}>
                  <strong className={styles.menuName}>{displayName}</strong>
                  <div className={styles.roleChips}>
                    <span className={styles.roleChip}>Member</span>
                    {dashboards.map((entry) => (
                      <span key={entry.chip} className={styles.roleChip}>
                        {entry.chip}
                      </span>
                    ))}
                  </div>
                </div>

                <Link
                  href="/profile"
                  role="menuitem"
                  tabIndex={profileOpen ? 0 : -1}
                  className={styles.menuItem}
                  onClick={() => setProfileOpen(false)}
                >
                  Profile
                </Link>
                {dashboards.map((entry) => (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    role="menuitem"
                    tabIndex={profileOpen ? 0 : -1}
                    className={styles.menuItem}
                    onClick={() => setProfileOpen(false)}
                  >
                    {entry.label}
                  </Link>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={profileOpen ? 0 : -1}
                  className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  onClick={logout}
                >
                  Log out
                </button>
              </div>
            </div>
          ) : (
            <>
              <a
                href={DISCORD_INVITE}
                target="_blank"
                rel="noopener noreferrer"
                title="Discord"
                aria-label="Discord"
                className={styles.iconButton}
              >
                <DiscordIcon />
              </a>
              <Link href="/login" className={styles.loginLink}>
                Log in
              </Link>
            </>
          )}

          <button
            type="button"
            className={styles.mobileToggle}
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
        className={`${styles.mobileNav} ${mobileOpen ? styles.mobileNavOpen : ""}`}
        aria-hidden={!mobileOpen}
        aria-label="Mobile navigation"
      >
        {MOBILE_LINKS.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className={styles.mobileNavLink}
            tabIndex={mobileOpen ? 0 : -1}
            onClick={() => setMobileOpen(false)}
          >
            {link.label}
          </Link>
        ))}
        <div className={styles.mobileNavButtons}>
          <SeasonMenu
            layout="inline"
            triggerClassName={styles.btnSecondary}
            reachable={mobileOpen}
            onNavigate={() => setMobileOpen(false)}
          />
          {!sessionReady || !networkUser ? (
            <Link
              href="/login"
              className={styles.btnSecondary}
              tabIndex={mobileOpen ? 0 : -1}
              onClick={() => setMobileOpen(false)}
            >
              Log in
            </Link>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
