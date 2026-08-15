import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { MinigamesHeader } from "@/components/MinigamesHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OTP Stream Tools", template: "%s | OTP Stream Tools" },
  description: "Player join, host control, and OBS program output for OTP Productions minigames.",
  icons: { icon: "/winton.jpg", shortcut: "/winton.jpg" },
};

export const viewport: Viewport = { themeColor: "#050d20", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* THESIS: Family Feud is a three-surface stream machine, not a standalone game ecosystem. OWN-WORLD: warm brass stage framing, television blue answer boards, cream lamps, red/blue team placards, and restrained production controls. STORY: players join from an invitation, the host runs one authoritative state, and OBS receives a stable program frame. FIRST VIEWPORT: the broadcast opens on a full 16:9 physical answer board with scores and round state at broadcast distance. FORM: Product Demo, pinned classic television direction, seed 194. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md */}
        <span hidden data-design-contract="Family Feud stream machine; classic television stage; Product Demo; seed 194; finish review and DESIGN.md required" />
        <MinigamesHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
