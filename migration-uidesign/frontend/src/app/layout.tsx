import { Suspense, type ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "Overtime Productions",
    template: "%s | Overtime Productions",
  },
  description: "Overtime Productions creates community events and live broadcasts, including GGL, its Overwatch league with drafted rosters, scheduled matches, standings, and playoffs.",
};

export const viewport: Viewport = {
  themeColor: "#0D0F0E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${jetbrainsMono.variable} bg-background`}>
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
