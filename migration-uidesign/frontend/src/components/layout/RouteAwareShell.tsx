"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TournamentTimer } from "@/components/layout/TournamentTimer";
import { useSession } from "@/features/session/SessionProvider";

export function RouteAwareShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const { user } = useSession();
  const [shellReady, setShellReady] = useState(false);

  // During hydration Next can briefly return an empty pathname. Rendering the
  // route-aware shell only after mount prevents the server's Wrapped-only tree
  // from being reconciled against a client tree containing Navbar/Footer.
  useEffect(() => setShellReady(true), []);
  if (!shellReady) return <>{children}</>;

  const isOverlayRoute = pathname.startsWith("/overlay");
  const isFinalsRoute = pathname.startsWith("/finals") || pathname.startsWith("/wrapped");
  const isDraftTableRoute = pathname.startsWith("/draft-table");
  const isMinigamesRoute = pathname.startsWith("/minigames");
  const hasDraftAccessKey = isDraftTableRoute && Boolean(searchParams?.get("key"));
  const isKeyViewerMode = hasDraftAccessKey && user?.role !== "MANAGER";

  if (isOverlayRoute || isFinalsRoute || isMinigamesRoute || hasDraftAccessKey || isKeyViewerMode) {
    return <>{children}</>;
  }

  return (
    <>
      {!isDraftTableRoute && <TournamentTimer />}
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
