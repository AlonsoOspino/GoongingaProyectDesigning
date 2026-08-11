import { Suspense, type ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, League_Gothic, Bebas_Neue } from "next/font/google";
import { SessionProvider } from "@/features/session/SessionProvider";
import { RouteAwareShell } from "@/components/layout/RouteAwareShell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

const leagueGothic = League_Gothic({
  subsets: ["latin"],
  variable: "--font-league-gothic",
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-overlay-display",
});

export const metadata: Metadata = {
  title: {
    default: "Goonginga | Overwatch League",
    template: "%s | Goonginga",
  },
  description: "Goonginga is a community Overwatch league with drafted rosters, scheduled matches, live broadcasts, standings, and playoffs.",
};

export const viewport: Viewport = {
  themeColor: "#172532",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${jetbrainsMono.variable} ${leagueGothic.variable} ${bebasNeue.variable} bg-background`}>
      <body className="min-h-screen flex flex-col font-sans antialiased">
        <SessionProvider>
          <Suspense fallback={null}>
            <RouteAwareShell>{children}</RouteAwareShell>
          </Suspense>
        </SessionProvider>
      </body>
    </html>
  );
}
