import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./overlay.css";
import "./components/overlay-theme.css";

export const metadata: Metadata = {
  title: "OBS Overlays",
  description: "Overlay pages for OBS browser sources",
};

export default function OverlayLayout({ children }: { children: ReactNode }) {
  return (
    <div className="overlay-root">
      <div className="overlay-stage">{children}</div>
    </div>
  );
}
