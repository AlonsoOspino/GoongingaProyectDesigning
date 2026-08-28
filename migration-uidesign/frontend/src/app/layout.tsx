import { Suspense, type ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Barlow, Bebas_Neue, Chakra_Petch, Geist, JetBrains_Mono, League_Gothic } from "next/font/google";
import { SessionProvider } from "@/features/session/SessionProvider";
import { RouteAwareShell } from "@/components/layout/RouteAwareShell";
import "./globals.css";
import "../components/layout/header.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

// The announcement voice, and nothing else. Exposed as `--font-accent` rather
// than `--font-display` on purpose: `--font-display` is read by the overlays,
// minigames and announcement studio, and this face is only meant to appear in
// three places on the draft table.
const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas-neue",
  display: "swap",
});

/* Las tres voces de OTP. Vivían dentro de la landing, así que fuera de ella las
   variables no existían: el header compartido y la página de temporada se
   quedaban sin ellas. Declaradas aquí las tiene todo el sitio. */
const leagueGothic = League_Gothic({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-otp-display",
  display: "swap",
});

const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-otp-heading",
  display: "swap",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-otp-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Overtime Productions",
    template: "%s | Overtime Productions",
  },
  description: "The official home of Goonginga League.",
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
      className={`${geist.variable} ${jetbrainsMono.variable} ${bebasNeue.variable} ${leagueGothic.variable} ${chakraPetch.variable} ${barlow.variable} bg-background`}
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
