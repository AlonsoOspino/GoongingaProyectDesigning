"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TournamentTimer } from "@/components/layout/TournamentTimer";

export function RouteAwareShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const isOverlayRoute = pathname.startsWith("/overlay");
  const isDraftTableRoute = pathname.startsWith("/draft-table");

  if (isOverlayRoute) {
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
