"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { MapPoolOverlay } from "@/app/overlay/components/MapPoolOverlay";

export default function MapPoolOverlayPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = Number(params.matchId);

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

  return <MapPoolOverlay matchId={matchId} variant="clean" />;
}
