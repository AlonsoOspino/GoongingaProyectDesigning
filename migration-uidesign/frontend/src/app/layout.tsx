import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "@/features/session/SessionProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TournamentTimer } from "@/components/layout/TournamentTimer";
import { NewNewsNotifier } from "@/components/news/NewNewsNotifier";
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
    default: "Goonginga League",
    template: "%s | Goonginga League",
  },
  description: "The premier competitive Overwatch league. Track teams, matches, stats, and participate in live drafts.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} bg-background`}>
      <body className="min-h-screen flex flex-col font-sans antialiased">
        <SessionProvider>
          <TournamentTimer />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <NewNewsNotifier />
        </SessionProvider>
      </body>
    </html>
  );
}
