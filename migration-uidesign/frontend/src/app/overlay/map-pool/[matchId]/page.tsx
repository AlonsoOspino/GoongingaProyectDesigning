"use client";

import { useParams } from "next/navigation";
import { MapPoolOverlay } from "@/app/overlay/components/MapPoolOverlay";

export default function MapPoolOverlayPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = Number(params.matchId);

  return <MapPoolOverlay matchId={matchId} variant="classic" />;
}
