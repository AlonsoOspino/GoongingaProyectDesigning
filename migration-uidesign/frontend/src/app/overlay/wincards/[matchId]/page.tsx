"use client";

import { useParams } from "next/navigation";
import { WincardsOverlay } from "@/app/overlay/components/WincardsOverlay";

export default function WincardsOverlayPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = Number(params.matchId);

  return <WincardsOverlay matchId={matchId} />;
}
