import { Suspense, type ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "@/features/session/SessionProvider";
import { RouteAwareShell } from "@/components/layout/RouteAwareShell";
import "./globals.css";
import "../components/landing/ggl/GglTournament.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Overtime Productions",
    template: "%s | Overtime Productions",
  },
  description: "Overtime Productions organizes GGL, short tournaments, live broadcasts, and community game nights.",
};

export const viewport: Viewport = {
  themeColor: "#090c0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geist.variable} ${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} bg-background`}
    >
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
