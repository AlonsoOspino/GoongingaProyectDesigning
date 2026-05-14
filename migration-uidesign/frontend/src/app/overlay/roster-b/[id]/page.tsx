"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { RosterOverlay } from "@/app/overlay/components/RosterOverlay";

export default function RosterBOverlayPage() {
  const params = useParams<{ id: string }>();
  const matchId = Number(params.id);

  useEffect(() => {
    const root = document.documentElement;
    const prevWidth = root.style.getPropertyValue("--overlay-width");
    const prevHeight = root.style.getPropertyValue("--overlay-height");

    root.style.setProperty("--overlay-width", "1920px");
    root.style.setProperty("--overlay-height", "1080px");

    return () => {
      if (prevWidth) {
        root.style.setProperty("--overlay-width", prevWidth);
      } else {
        root.style.removeProperty("--overlay-width");
      }

      if (prevHeight) {
        root.style.setProperty("--overlay-height", prevHeight);
      } else {
        root.style.removeProperty("--overlay-height");
      }
    };
  }, []);

  return <RosterOverlay matchId={matchId} side="B" />;
}
