"use client";

import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { useSession } from "@/features/session/SessionProvider";

export function RouteAwareShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const { user } = useSession();

  const isOverlayRoute = pathname.startsWith("/overlay");
  const isLandingRoute = pathname === "/";
  const isWrappedRoute = pathname.startsWith("/wrapped") || pathname.startsWith("/history/season-8/wrapped");
  const isDraftTableRoute = pathname.startsWith("/draft-table");
  const isDraftTableDevRoute = pathname === "/draft-table-dev";
  const isMinigamesRoute = pathname.startsWith("/minigames");
  const isEmbeddedManager = pathname === "/manager-dashboard" && searchParams?.get("embedded") === "1";
  const hasDraftAccessKey = isDraftTableRoute && Boolean(searchParams?.get("key"));
  const isKeyViewerMode = hasDraftAccessKey && user?.role !== "MANAGER";

  if (isOverlayRoute || isWrappedRoute || isDraftTableDevRoute || isMinigamesRoute || isEmbeddedManager || hasDraftAccessKey || isKeyViewerMode) {
    return <>{children}</>;
  }

  /*
    La landing sí lleva header: es el mismo de todo el sitio, que era el punto —
    antes tenía uno propio y coexistían dos headers distintos. Lo que no recibe
    es el <main> del shell, porque la landing ya trae el suyo y anidar dos
    landmarks main no es válido.
  */
  if (isLandingRoute) {
    return (
      <>
        <SiteHeader />
        {children}
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
    </>
  );
}
