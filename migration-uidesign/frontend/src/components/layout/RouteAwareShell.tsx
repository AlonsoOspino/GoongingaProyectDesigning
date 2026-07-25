"use client";

import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TournamentTimer } from "@/components/layout/TournamentTimer";
import { useSession } from "@/features/session/SessionProvider";

export function RouteAwareShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const { user } = useSession();
  const isOverlayRoute = pathname.startsWith("/overlay");
  const isWrappedRoute = pathname.startsWith("/wrapped");
  const isDraftTableRoute = pathname.startsWith("/draft-table");
  const hasDraftAccessKey = isDraftTableRoute && Boolean(searchParams?.get("key"));
  const isKeyViewerMode = hasDraftAccessKey && user?.role !== "MANAGER";

  if (isOverlayRoute || isWrappedRoute || hasDraftAccessKey || isKeyViewerMode) {
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
