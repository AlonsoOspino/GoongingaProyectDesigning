import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { MinigamesHeader } from "@/components/MinigamesHeader";
import { SessionProvider } from "@/features/session/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Goonginga Minigames", template: "%s | Goonginga Minigames" },
  description: "Live games, player experiences, and stream boards for Goonginga.",
};

export const viewport: Viewport = { themeColor: "#050d20", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <MinigamesHeader />
          <main>{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
