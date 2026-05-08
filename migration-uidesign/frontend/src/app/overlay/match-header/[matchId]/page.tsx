"use client";

import { useParams } from "next/navigation";
import { MatchHeaderOverlay } from "@/app/overlay/components/MatchHeaderOverlay";

export default function MatchHeaderOverlayPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = Number(params.matchId);

  return <MatchHeaderOverlay matchId={matchId} />;
}
