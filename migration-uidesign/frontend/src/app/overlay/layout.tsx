import type { Metadata } from "next";
import "./overlay.css";

export const metadata: Metadata = {
  title: "Match Overlay",
  description: "Live esports overlay for streaming",
};

export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "transparent", overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}
