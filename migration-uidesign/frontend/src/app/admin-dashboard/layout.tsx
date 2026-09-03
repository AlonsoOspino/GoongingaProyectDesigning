"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Swords, Trophy, Users } from "lucide-react";
import { getCurrentNetworkMember } from "@/lib/api/networkMember";
import type { NetworkMember } from "@/lib/api/types";
import { readNetworkSessionToken } from "@/features/networkSession/storage";

/*
 * El shell de administración. Antes cada página de /admin-dashboard vivía suelta
 * y se enlazaban entre sí a mano; esto les da una barra común para que el panel
 * se lea como una sola herramienta. La verificación de rol de cada página se
 * mantiene intacta — esta capa solo decide qué pestañas mostrar.
 */

interface AdminTab {
  href: string;
  label: string;
  icon: typeof Users;
  /** Network Members lo ven ADMIN y DEVELOPER; el resto es solo-ADMIN. */
  adminOnly: boolean;
}

const TABS: AdminTab[] = [
  { href: "/admin-dashboard/season", label: "Season Control", icon: Trophy, adminOnly: true },
  { href: "/admin-dashboard/roster", label: "Season Roster", icon: ClipboardList, adminOnly: true },
  { href: "/admin-dashboard", label: "Network Members", icon: Users, adminOnly: false },
  { href: "/admin-dashboard/overwatch-content", label: "Overwatch Content", icon: Swords, adminOnly: true },
];

function isTabActive(pathname: string, href: string): boolean {
  // Network Members es la raíz, así que solo coincide exacto; el resto no tiene
  // subrutas, pero startsWith deja sitio por si más adelante las tienen.
  return href === "/admin-dashboard" ? pathname === href : pathname.startsWith(href);
}

function AdminNav({ member }: { member: NetworkMember | null }) {
  const pathname = usePathname() || "";
  const isAdmin = Boolean(member?.roles?.includes("ADMIN"));
  const visible = TABS.filter((tab) => !tab.adminOnly || isAdmin);

  if (!member || visible.length === 0) return null;

  return (
    <div className="mb-8 border-b border-border-subtle">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.32em] text-accent">
        Overtime · Control room
      </p>
      <nav
        aria-label="Admin sections"
        className="mt-3 flex gap-1 overflow-x-auto pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {visible.map((tab) => {
          const active = isTabActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={[
                "group relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "text-text-primary"
                  : "text-muted hover:text-text-primary",
              ].join(" ")}
            >
              <Icon
                size={16}
                className={active ? "text-accent" : "text-muted group-hover:text-text-primary"}
              />
              {tab.label}
              <span
                aria-hidden
                className={[
                  "absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors",
                  active ? "bg-accent" : "bg-transparent group-hover:bg-border-strong",
                ].join(" ")}
              />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  // undefined = comprobando; null = no autenticado / no cargó.
  const [member, setMember] = useState<NetworkMember | null | undefined>(undefined);

  useEffect(() => {
    const token = readNetworkSessionToken();
    if (!token) {
      setMember(null);
      return;
    }
    let mounted = true;
    getCurrentNetworkMember(token)
      .then((current) => {
        if (mounted) setMember(current);
      })
      .catch(() => {
        if (mounted) setMember(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const nav = useMemo(
    () => <AdminNav member={member ?? null} />,
    [member]
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {nav}
      {children}
    </div>
  );
}
