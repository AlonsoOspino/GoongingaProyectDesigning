import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bebas_Neue, Oswald } from "next/font/google";
import "./overlay.css";

const bebasNeue = Bebas_Neue({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-overlay-display",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-overlay-body",
});

export const metadata: Metadata = {
  title: "OBS Overlays",
  description: "Overlay pages for OBS browser sources",
};

export default function OverlayLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${bebasNeue.variable} ${oswald.variable} overlay-root`}>
      <div className="overlay-stage">{children}</div>
    </div>
  );
}
