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
          <Suspense fallback={null}>
            <RouteAwareShell>{children}</RouteAwareShell>
          </Suspense>
        </SessionProvider>
      </body>
    </html>
  );
}
