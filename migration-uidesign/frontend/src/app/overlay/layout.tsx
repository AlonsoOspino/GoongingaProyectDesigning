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
  return <>{children}</>;
}
