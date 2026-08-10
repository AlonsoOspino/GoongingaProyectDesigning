import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { MinigamesHeader } from "@/components/MinigamesHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Goonginga Game Nights", template: "%s | Goonginga Game Nights" },
  description: "Live games, player experiences, and stream boards for Goonginga.",
  icons: { icon: "/winton.jpg", shortcut: "/winton.jpg" },
};

export const viewport: Viewport = { themeColor: "#050d20", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MinigamesHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
